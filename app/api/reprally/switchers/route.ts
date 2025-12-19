import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type MatchMode = 'strict' | 'loose';

function normalizeName(name: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(llc|inc|co|company|corp|corporation|ltd|store|smoke\s*shop|vape\s*shop)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAddress(addr: string): string {
  return String(addr || '')
    .toLowerCase()
    .replace(/\r\n|\r/g, '\n')
    .replace(/\n+/g, ' ')
    .replace(/\b(in\s*store)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(ste|suite)\b/g, 'suite')
    .replace(/\b(apt|apartment)\b/g, 'apt')
    .replace(/\b(rd|road)\b/g, 'rd')
    .replace(/\b(st|street)\b/g, 'st')
    .replace(/\b(ave|avenue)\b/g, 'ave')
    .replace(/\b(blvd|boulevard)\b/g, 'blvd')
    .replace(/\b(dr|drive)\b/g, 'dr')
    .replace(/\b(hwy|highway)\b/g, 'hwy')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCity(v: string): string {
  return String(v || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function normalizeState(v: string): string {
  return String(v || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function normalizeZip(v: string): string {
  return String(v || '').replace(/[^0-9]/g, '').slice(0, 5);
}

function toNumber(value: any): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? '0'));
  return Number.isFinite(n) ? n : 0;
}

function safeDate(value: any): Date | null {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

interface DirectAgg {
  customerId: string;
  customerName: string;
  billingAddress: string;
  billingCity: string;
  billingState: string;
  billingZip: string;
  originalSalesRep: string;
  firstDirectOrder: Date | null;
  lastDirectOrder: Date | null;
  directOrders: number;
  directRevenue: number;
}

interface RepAgg {
  rrCustomerId: string;
  businessName: string;
  billingAddress: string;
  billingCity: string;
  billingState: string;
  billingZip: string;
  firstRepRallyOrder: Date | null;
  lastRepRallyOrder: Date | null;
  repRallyOrders: number;
  repRallyRevenue: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode: MatchMode = (searchParams.get('mode') as MatchMode) || 'strict';
    const limit = Math.min(parseInt(searchParams.get('limit') || '200', 10) || 200, 2000);
    const writeBack = (searchParams.get('write') ?? '0') === '1';

    console.log('🔁 RepRally switcher analysis: loading data...');

    // 1) Load RepRally customers (source of truth for RepRally side)
    const rrSnap = await adminDb.collection('reprally_customers').get();
    const repCustomers: RepAgg[] = [];

    for (const doc of rrSnap.docs) {
      const c = doc.data();
      const businessName = String(c.businessName || '').trim();
      const billingAddress = String(c.billingAddress || '').trim();
      const billingCity = String(c.billingCity || '').trim();
      const billingState = String(c.billingState || '').trim();
      const billingZip = String(c.billingZip || '').trim();

      // Skip legacy placeholder entries
      if (!billingAddress && businessName.toLowerCase() === 'shopify customer') continue;

      repCustomers.push({
        rrCustomerId: doc.id,
        businessName,
        billingAddress,
        billingCity,
        billingState,
        billingZip,
        firstRepRallyOrder: safeDate(c.firstOrderDate),
        lastRepRallyOrder: safeDate(c.lastOrderDate),
        repRallyOrders: toNumber(c.totalOrders ?? 0),
        repRallyRevenue: toNumber(c.lifetimeValue ?? 0)
      });
    }

    // 2) Load direct customers (Fishbowl/Copper side)
    // NOTE: We do NOT trust fishbowl_customers summary fields for revenue/order counts.
    // We aggregate direct order stats from fishbowl_sales_orders below.
    const fbSnap = await adminDb.collection('fishbowl_customers').get();
    const directCustomers: DirectAgg[] = [];

    // Pre-aggregate direct orders from sales orders collection (exclude RepRally orders)
    console.log('📦 Aggregating direct order stats from fishbowl_sales_orders...');
    const ordersSnap = await adminDb.collection('fishbowl_sales_orders').get();

    const directAggByCustomerId = new Map<
      string,
      { first: Date | null; last: Date | null; orders: number; revenue: number; lastDirectSalesRep: string }
    >();

    for (const doc of ordersSnap.docs) {
      const o = doc.data();
      const customerId = String(o.customerId || '').trim();
      if (!customerId) continue;

      const customerName = String(o.customerName || '').toLowerCase();
      const salesRep = String(o.salesRep || o.salesPerson || '').toLowerCase();
      const orderNum = String(o.fishbowlNum || o.salesOrderNum || o.num || '').trim();

      // RepRally detection (match the patterns we use elsewhere)
      const isRepRallyOrder =
        customerName.includes('shopify') ||
        salesRep.includes('robert farias') ||
        salesRep.includes('farias') ||
        orderNum.startsWith('#') ||
        orderNum.includes('qpq') ||
        orderNum.includes('000000');

      if (isRepRallyOrder) continue;

      const postingDate = safeDate(o.postingDate) || safeDate(o.postingDateStr);
      if (!postingDate) continue;

      const revenue = toNumber(o.revenue ?? o.orderValue ?? o.totalAmount ?? 0);
      if (!directAggByCustomerId.has(customerId)) {
        directAggByCustomerId.set(customerId, {
          first: postingDate,
          last: postingDate,
          orders: 0,
          revenue: 0,
          lastDirectSalesRep: ''
        });
      }

      const agg = directAggByCustomerId.get(customerId)!;
      agg.orders += 1;
      agg.revenue += revenue;
      if (!agg.first || postingDate.getTime() < agg.first.getTime()) agg.first = postingDate;
      if (!agg.last || postingDate.getTime() > agg.last.getTime()) {
        agg.last = postingDate;
        agg.lastDirectSalesRep = String(o.salesRep || o.salesPerson || '').trim();
      }
    }

    for (const doc of fbSnap.docs) {
      const c = doc.data();
      const billingAddress = String(c.billingAddress || c.shippingAddress || '').trim();
      const billingCity = String(c.billingCity || c.shippingCity || '').trim();
      const billingState = String(c.billingState || c.shippingState || '').trim();
      const billingZip = String(c.billingZip || c.shippingZip || '').trim();

      if (!billingAddress || !billingCity || !billingState) continue;

      const agg = directAggByCustomerId.get(doc.id);

      directCustomers.push({
        customerId: doc.id,
        customerName: String(c.name || c.customerName || '').trim(),
        billingAddress,
        billingCity,
        billingState,
        billingZip,
        originalSalesRep: String(c.originalOwner || c.salesPerson || agg?.lastDirectSalesRep || '').trim(),
        firstDirectOrder: agg?.first ?? null,
        lastDirectOrder: agg?.last ?? null,
        directOrders: agg?.orders ?? 0,
        directRevenue: agg?.revenue ?? 0
      });
    }

    // 3) Build indexes for matching
    const fbByStrictKey = new Map<string, DirectAgg[]>();
    const fbByLooseKey = new Map<string, DirectAgg[]>();

    for (const fb of directCustomers) {
      const strictKey = [
        normalizeAddress(fb.billingAddress),
        normalizeCity(fb.billingCity),
        normalizeState(fb.billingState),
        normalizeZip(fb.billingZip)
      ].join('|');

      const looseKey = [
        normalizeCity(fb.billingCity),
        normalizeState(fb.billingState),
        normalizeZip(fb.billingZip)
      ].join('|');

      if (!fbByStrictKey.has(strictKey)) fbByStrictKey.set(strictKey, []);
      fbByStrictKey.get(strictKey)!.push(fb);

      if (!fbByLooseKey.has(looseKey)) fbByLooseKey.set(looseKey, []);
      fbByLooseKey.get(looseKey)!.push(fb);
    }

    // 4) Match and classify switchers
    const matches: any[] = [];
    const switchers: any[] = [];
    const seenSwitcherKeys = new Set<string>(); // Track unique switchers to avoid duplicates

    for (const rr of repCustomers) {
      const rrStrictKey = [
        normalizeAddress(rr.billingAddress),
        normalizeCity(rr.billingCity),
        normalizeState(rr.billingState),
        normalizeZip(rr.billingZip)
      ].join('|');

      const rrLooseKey = [
        normalizeCity(rr.billingCity),
        normalizeState(rr.billingState),
        normalizeZip(rr.billingZip)
      ].join('|');

      let candidates: DirectAgg[] = [];
      if (mode === 'strict') {
        candidates = fbByStrictKey.get(rrStrictKey) || [];
      } else {
        candidates = fbByStrictKey.get(rrStrictKey) || fbByLooseKey.get(rrLooseKey) || [];
      }

      if (candidates.length === 0) continue;

      const rrNameNorm = normalizeName(rr.businessName);

      // Prefer name match among candidates when ambiguous
      let best = candidates[0];
      let bestScore = -1;
      for (const c of candidates) {
        const fbNameNorm = normalizeName(c.customerName);
        let score = 0;
        if (rrNameNorm && fbNameNorm) {
          if (rrNameNorm === fbNameNorm) score += 5;
          if (rrNameNorm.includes(fbNameNorm) || fbNameNorm.includes(rrNameNorm)) score += 3;
        }
        // strict address match already enforced in strict mode; reward anyway
        if (normalizeAddress(c.billingAddress) === normalizeAddress(rr.billingAddress)) score += 2;
        if (normalizeZip(c.billingZip) && normalizeZip(c.billingZip) === normalizeZip(rr.billingZip)) score += 1;

        if (score > bestScore) {
          bestScore = score;
          best = c;
        }
      }

      const match = {
        matchMode: mode,
        matchScore: bestScore,

        // RepRally side
        rrCustomerId: rr.rrCustomerId,
        rrBusinessName: rr.businessName,
        rrBillingAddress: rr.billingAddress,
        rrBillingCity: rr.billingCity,
        rrBillingState: rr.billingState,
        rrBillingZip: rr.billingZip,
        rrFirstOrder: rr.firstRepRallyOrder?.toISOString() || null,
        rrLastOrder: rr.lastRepRallyOrder?.toISOString() || null,
        rrOrders: rr.repRallyOrders,
        rrRevenue: rr.repRallyRevenue,

        // Fishbowl side
        fbCustomerId: best.customerId,
        fbBusinessName: best.customerName,
        fbBillingAddress: best.billingAddress,
        fbBillingCity: best.billingCity,
        fbBillingState: best.billingState,
        fbBillingZip: best.billingZip,
        fbOriginalSalesRep: best.originalSalesRep,
        fbFirstOrder: best.firstDirectOrder?.toISOString() || null,
        fbLastOrder: best.lastDirectOrder?.toISOString() || null,
        fbDirectOrders: best.directOrders,
        fbDirectRevenue: best.directRevenue,

        alternatives: Math.max(candidates.length - 1, 0)
      };

      matches.push(match);

      // switcher logic: last direct order < first rep rally order
      const lastDirect = best.lastDirectOrder;
      const firstRR = rr.firstRepRallyOrder;
      if (lastDirect && firstRR && firstRR.getTime() > lastDirect.getTime()) {
        // Create unique key to prevent duplicates (same FB customer matched multiple times)
        const switcherKey = `${best.customerId}|${normalizeAddress(rr.billingAddress)}|${normalizeCity(rr.billingCity)}`;
        
        if (!seenSwitcherKeys.has(switcherKey)) {
          seenSwitcherKeys.add(switcherKey);
          const daysBetween = Math.floor((firstRR.getTime() - lastDirect.getTime()) / (1000 * 60 * 60 * 24));
          switchers.push({
            ...match,
            isSwitcher: true,
            switchDate: firstRR.toISOString(),
            daysBetween
          });
        }
      }
    }

    // Sort biggest rep rally revenue first
    switchers.sort((a, b) => (b.rrRevenue || 0) - (a.rrRevenue || 0));

    const resultSwitchers = switchers.slice(0, limit);

    // summary
    const totalSwitcherRevenue = switchers.reduce((s, x) => s + toNumber(x.rrRevenue), 0);
    const totalLostDirectRevenue = switchers.reduce((s, x) => s + toNumber(x.fbDirectRevenue), 0);

    // Optional: persist match/switcher fields onto reprally_customers docs
    if (writeBack) {
      console.log(`✍️ Writing switcher metadata back to reprally_customers for ${resultSwitchers.length} rows...`);
      let batch = adminDb.batch();
      let batchCount = 0;

      for (const s of resultSwitchers) {
        const ref = adminDb.collection('reprally_customers').doc(String(s.rrCustomerId));
        batch.set(
          ref,
          {
            match: {
              fbCustomerId: s.fbCustomerId,
              fbBusinessName: s.fbBusinessName,
              fbOriginalSalesRep: s.fbOriginalSalesRep,
              matchMode: s.matchMode,
              matchScore: s.matchScore,
              alternatives: s.alternatives
            },
            switcher: {
              isSwitcher: true,
              switchDate: s.switchDate,
              daysBetween: s.daysBetween,
              direct: {
                lastDirectOrder: s.fbLastOrder,
                directOrders: s.fbDirectOrders,
                directRevenue: s.fbDirectRevenue
              },
              reprally: {
                firstRepRallyOrder: s.rrFirstOrder,
                repRallyOrders: s.rrOrders,
                repRallyRevenue: s.rrRevenue
              }
            }
          },
          { merge: true }
        );
        batchCount++;

        if (batchCount >= 400) {
          await batch.commit();
          batch = adminDb.batch();
          batchCount = 0;
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }
    }

    return NextResponse.json({
      success: true,
      mode,
      stats: {
        rrCustomersScanned: repCustomers.length,
        fbCustomersScanned: directCustomers.length,
        matchesFound: matches.length,
        switchersFound: switchers.length,
        totalSwitcherRepRallyRevenue: totalSwitcherRevenue,
        totalLostDirectRevenue
      },
      switchers: resultSwitchers
    });
  } catch (error: any) {
    console.error('❌ RepRally switcher analysis error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

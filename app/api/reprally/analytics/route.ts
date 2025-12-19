import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type MonthKey = string; // YYYY-MM

function monthKeyFromDate(d: Date): MonthKey {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function safeDate(value: any): Date | null {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function toNumber(value: any): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? '0'));
  return Number.isFinite(n) ? n : 0;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const includeTimeSeries = (searchParams.get('timeSeries') ?? '1') !== '0';
    const includeTopCustomers = (searchParams.get('topCustomers') ?? '1') !== '0';
    const includeGeo = (searchParams.get('geo') ?? '1') !== '0';

    const startStr = searchParams.get('start');
    const endStr = searchParams.get('end');
    const startDate = startStr ? safeDate(startStr) : null;
    const endDate = endStr ? safeDate(endStr) : null;

    console.log('📊 RepRally analytics: loading reprally_customers...');
    const customersSnap = await adminDb.collection('reprally_customers').get();

    const customers: any[] = [];
    let totalRevenue = 0;
    let totalOrders = 0;
    let repeatCustomers = 0;
    let customersIncluded = 0;

    const stateRevenue = new Map<string, number>();
    const stateCustomers = new Map<string, number>();
    const cityRevenue = new Map<string, number>();

    for (const doc of customersSnap.docs) {
      const c = doc.data();
      const lifetimeValue = toNumber(c.lifetimeValue ?? c.totalRepRallyRevenue ?? 0);
      const ordersCount = toNumber(c.totalOrders ?? c.totalRepRallyOrders ?? 0);
      const state = String(c.billingState || '').trim();
      const city = String(c.billingCity || '').trim();

      const businessName = String(c.businessName || c.billingName || '').trim();
      const billingAddress = String(c.billingAddress || '').trim();

      // Filter out legacy placeholder docs created before billing fields were imported correctly
      // (these tend to be "Shopify Customer" grouped by city/state with empty address)
      if (!billingAddress && businessName.toLowerCase() === 'shopify customer') {
        continue;
      }

      customersIncluded++;

      totalRevenue += lifetimeValue;
      totalOrders += ordersCount;
      if (ordersCount >= 2) repeatCustomers++;

      if (includeGeo) {
        if (state) {
          stateRevenue.set(state, (stateRevenue.get(state) || 0) + lifetimeValue);
          stateCustomers.set(state, (stateCustomers.get(state) || 0) + 1);
        }
        if (city && state) {
          const key = `${city}, ${state}`;
          cityRevenue.set(key, (cityRevenue.get(key) || 0) + lifetimeValue);
        }
      }

      customers.push({
        id: doc.id,
        customerId: c.customerId || doc.id,
        businessName,
        billingAddress,
        billingCity: c.billingCity || '',
        billingState: c.billingState || '',
        billingZip: c.billingZip || '',
        totalOrders: ordersCount,
        lifetimeValue,
        firstOrderDate: safeDate(c.firstOrderDate),
        lastOrderDate: safeDate(c.lastOrderDate)
      });
    }

    // Top customers + concentration
    let topCustomers: any[] = [];
    let top10Revenue = 0;
    if (includeTopCustomers) {
      customers.sort((a, b) => b.lifetimeValue - a.lifetimeValue);
      topCustomers = customers.slice(0, 100);
      top10Revenue = customers.slice(0, 10).reduce((s, c) => s + c.lifetimeValue, 0);
    }

    // Time series via collectionGroup(sales_orders)
    const monthly = new Map<MonthKey, { revenue: number; orders: number; customers: Set<string> }>();

    if (includeTimeSeries) {
      console.log('📈 RepRally analytics: loading sales_orders via collectionGroup...');

      const ordersSnap = await adminDb.collectionGroup('sales_orders').get();
      console.log(`   Loaded ${ordersSnap.size} RepRally sales_orders docs`);

      for (const doc of ordersSnap.docs) {
        const o = doc.data();

        const orderDate = safeDate(o.postingDate) || safeDate(o.writtenAt) || safeDate(o.createdAt);
        if (!orderDate) continue;
        if (startDate && orderDate < startDate) continue;
        if (endDate && orderDate > endDate) continue;

        const key = monthKeyFromDate(orderDate);
        const orderTotal = toNumber(o.orderTotal ?? o.revenue ?? o.totalAmount ?? 0);

        const parentCustomerId = doc.ref.parent.parent?.id || String(o.customerId || '');
        if (!monthly.has(key)) {
          monthly.set(key, { revenue: 0, orders: 0, customers: new Set() });
        }
        const bucket = monthly.get(key)!;
        bucket.revenue += orderTotal;
        bucket.orders += 1;
        if (parentCustomerId) bucket.customers.add(parentCustomerId);
      }
    }

    const timeSeries = Array.from(monthly.entries())
      .map(([month, v]) => ({
        month,
        revenue: v.revenue,
        orders: v.orders,
        uniqueCustomers: v.customers.size,
        aov: v.orders > 0 ? v.revenue / v.orders : 0
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const geoByState = Array.from(stateRevenue.entries())
      .map(([state, revenue]) => ({
        state,
        customers: stateCustomers.get(state) || 0,
        revenue
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 25);

    const geoByCity = Array.from(cityRevenue.entries())
      .map(([cityState, revenue]) => ({ cityState, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 25);

    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return NextResponse.json({
      success: true,
      filters: {
        start: startDate?.toISOString() || null,
        end: endDate?.toISOString() || null
      },
      summary: {
        customers: customersIncluded,
        orders: totalOrders,
        revenue: totalRevenue,
        avgOrderValue,
        repeatCustomers,
        repeatRate: customersIncluded > 0 ? repeatCustomers / customersIncluded : 0,
        top10Revenue,
        top10Share: totalRevenue > 0 ? top10Revenue / totalRevenue : 0
      },
      topCustomers: includeTopCustomers ? topCustomers : [],
      geo: includeGeo ? { byState: geoByState, byCity: geoByCity } : null,
      timeSeries: includeTimeSeries ? timeSeries : []
    });
  } catch (error: any) {
    console.error('❌ RepRally analytics error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

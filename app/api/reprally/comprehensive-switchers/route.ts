import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Products to EXCLUDE from revenue calculations
const EXCLUDED_PRODUCTS = ['shipping', 'cc processing', 'credit card processing', 'handling'];

function isExcludedProduct(productName: string): boolean {
  const normalized = String(productName || '').toLowerCase().trim();
  return EXCLUDED_PRODUCTS.some(ex => normalized.includes(ex));
}

// Order type classification based on sales order number pattern
type OrderType = 'reprally_b2b' | 'retail_shopify' | 'fishbowl_direct' | 'unknown';

function classifyOrder(orderNum: string): OrderType {
  const num = String(orderNum || '').trim();
  
  // Retail Shopify: starts with "Sh"
  if (num.toLowerCase().startsWith('sh')) {
    return 'retail_shopify';
  }
  
  // RepRally B2B: starts with # and has long alphanumeric code
  if (num.startsWith('#') && num.length >= 10) {
    return 'reprally_b2b';
  }
  
  // Long alphanumeric without # could also be RepRally
  if (/^[A-Z0-9]{10,}$/i.test(num.replace(/[^A-Z0-9]/gi, '')) && !num.match(/^\d+$/)) {
    return 'reprally_b2b';
  }
  
  // Fishbowl: 4-6 digit numeric
  if (/^\d{4,6}$/.test(num)) {
    return 'fishbowl_direct';
  }
  
  return 'unknown';
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

// Detect if a name looks like a business vs individual
function isBusinessName(name: string): boolean {
  const normalized = String(name || '').toLowerCase().trim();
  
  // Common business indicators
  const businessIndicators = [
    'llc', 'inc', 'corp', 'ltd', 'co.', 'company', 'store', 'shop', 'market',
    'wholesale', 'retail', 'distribution', 'supply', 'supplies', 'depot',
    'warehouse', 'outlet', 'center', 'centre', 'group', 'holdings', 'enterprises',
    'services', 'solutions', 'consulting', 'partners', 'associates', 'agency',
    'foods', 'cafe', 'restaurant', 'bar', 'grill', 'kitchen', 'bakery',
    'salon', 'spa', 'wellness', 'fitness', 'gym', 'studio', 'gallery',
    'boutique', 'emporium', 'trading', 'imports', 'exports', 'international',
    'd/b/a', 'dba', '&', 'and sons', 'and daughters', 'brothers', 'sisters'
  ];
  
  // Check for business indicators
  for (const indicator of businessIndicators) {
    if (normalized.includes(indicator)) return true;
  }
  
  // Check if it's NOT a typical "Firstname Lastname" pattern
  // Business names often have 3+ words or unusual patterns
  const words = normalized.split(/\s+/).filter(w => w.length > 1);
  
  // Typical individual names are 2-3 words with first letter capitalized
  if (words.length === 2) {
    // Check if both words look like proper names (capitalized, no numbers)
    const looksLikePersonName = words.every(w => 
      /^[a-z]+$/.test(w) && w.length >= 2 && w.length <= 15
    );
    if (looksLikePersonName) return false; // Likely an individual
  }
  
  // Has numbers (likely a business or location)
  if (/\d/.test(normalized)) return true;
  
  // Single word names are usually businesses
  if (words.length === 1 && words[0].length > 10) return true;
  
  // Default: if 4+ words, likely a business
  return words.length >= 4;
}

interface CustomerOrderHistory {
  customerId: string;
  businessName: string;
  billingAddress: string;
  billingCity: string;
  billingState: string;
  billingZip: string;
  isBusinessName: boolean;
  orders: {
    orderNum: string;
    orderType: OrderType;
    postingDate: Date | null;
    revenue: number;
  }[];
  firstRepRallyDate: Date | null;
  lastRepRallyDate: Date | null;
  firstRetailDate: Date | null;
  lastRetailDate: Date | null;
  firstDirectDate: Date | null;
  lastDirectDate: Date | null;
  repRallyRevenue: number;
  retailRevenue: number;
  directRevenue: number;
  repRallyOrders: number;
  retailOrders: number;
  directOrders: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    
    console.log('🔄 Comprehensive Switchers Analysis: Loading all line items...');
    
    // Load all line items to analyze complete order history
    const itemsSnap = await adminDb.collection('fishbowl_soitems').get();
    console.log(`   Loaded ${itemsSnap.size} line items`);
    
    // Group by customer (billing info) and track all order types
    const customersByKey = new Map<string, CustomerOrderHistory>();
    
    for (const doc of itemsSnap.docs) {
      const item = doc.data();
      const orderNum = String(item.salesOrderNum || '').trim();
      if (!orderNum) continue;
      
      const orderType = classifyOrder(orderNum);
      
      // Extract billing info
      const billingName = String(item.billingName || item.billToName || item.customerName || '').trim();
      const billingAddress = String(item.billingAddress || item.billToAddress || '').trim();
      const billingCity = String(item.billingCity || item.billToCity || item.shippingCity || '').trim();
      const billingState = String(item.billingState || item.billToState || item.shippingState || '').trim();
      const billingZip = String(item.billingZip || item.billToZip || '').trim();
      
      // Skip if no customer identification
      if (!billingName && !billingCity) continue;
      
      // Create unique customer key
      const customerKey = `${billingName}|${billingAddress}|${billingCity}|${billingState}`.toLowerCase();
      
      // Get or create customer record
      if (!customersByKey.has(customerKey)) {
        customersByKey.set(customerKey, {
          customerId: customerKey,
          businessName: billingName || `${billingCity}, ${billingState}`,
          billingAddress,
          billingCity,
          billingState,
          billingZip,
          isBusinessName: isBusinessName(billingName),
          orders: [],
          firstRepRallyDate: null,
          lastRepRallyDate: null,
          firstRetailDate: null,
          lastRetailDate: null,
          firstDirectDate: null,
          lastDirectDate: null,
          repRallyRevenue: 0,
          retailRevenue: 0,
          directRevenue: 0,
          repRallyOrders: 0,
          retailOrders: 0,
          directOrders: 0
        });
      }
      
      const customer = customersByKey.get(customerKey)!;
      const orderDate = safeDate(item.postingDate);
      
      // Check if we already have this order
      const existingOrder = customer.orders.find(o => o.orderNum === orderNum);
      
      // Calculate line revenue (excluding shipping/CC)
      const productName = String(item.productDescription || item.description || '').trim();
      const sku = String(item.productNum || item.sku || '').trim();
      const isExcluded = isExcludedProduct(productName) || isExcludedProduct(sku);
      const lineRevenue = isExcluded ? 0 : toNumber(item.revenue || item.totalPrice || 0);
      
      if (existingOrder) {
        existingOrder.revenue += lineRevenue;
      } else {
        customer.orders.push({
          orderNum,
          orderType,
          postingDate: orderDate,
          revenue: lineRevenue
        });
        
        // Update order counts by type
        if (orderType === 'reprally_b2b') customer.repRallyOrders++;
        else if (orderType === 'retail_shopify') customer.retailOrders++;
        else if (orderType === 'fishbowl_direct') customer.directOrders++;
      }
      
      // Update revenue by type
      if (orderType === 'reprally_b2b') customer.repRallyRevenue += lineRevenue;
      else if (orderType === 'retail_shopify') customer.retailRevenue += lineRevenue;
      else if (orderType === 'fishbowl_direct') customer.directRevenue += lineRevenue;
      
      // Update date ranges by type
      if (orderDate) {
        if (orderType === 'reprally_b2b') {
          if (!customer.firstRepRallyDate || orderDate < customer.firstRepRallyDate) customer.firstRepRallyDate = orderDate;
          if (!customer.lastRepRallyDate || orderDate > customer.lastRepRallyDate) customer.lastRepRallyDate = orderDate;
        } else if (orderType === 'retail_shopify') {
          if (!customer.firstRetailDate || orderDate < customer.firstRetailDate) customer.firstRetailDate = orderDate;
          if (!customer.lastRetailDate || orderDate > customer.lastRetailDate) customer.lastRetailDate = orderDate;
        } else if (orderType === 'fishbowl_direct') {
          if (!customer.firstDirectDate || orderDate < customer.firstDirectDate) customer.firstDirectDate = orderDate;
          if (!customer.lastDirectDate || orderDate > customer.lastDirectDate) customer.lastDirectDate = orderDate;
        }
      }
    }
    
    // Now identify different types of switchers
    const allCustomers = Array.from(customersByKey.values());
    
    // SWITCHER TYPE 1: Direct (Fishbowl) → RepRally B2B
    // Customer ordered direct in the past, now orders through RepRally B2B
    const directToRepRally = allCustomers.filter(c => 
      c.directOrders > 0 && 
      c.repRallyOrders > 0 && 
      c.lastDirectDate && 
      c.firstRepRallyDate &&
      c.firstRepRallyDate > c.lastDirectDate
    ).map(c => ({
      ...c,
      switchType: 'direct_to_reprally' as const,
      switchDate: c.firstRepRallyDate?.toISOString(),
      daysSinceLastDirect: c.firstRepRallyDate && c.lastDirectDate 
        ? Math.floor((c.firstRepRallyDate.getTime() - c.lastDirectDate.getTime()) / (1000 * 60 * 60 * 24))
        : null,
      lostDirectRevenue: c.directRevenue,
      gainedRepRallyRevenue: c.repRallyRevenue
    })).sort((a, b) => b.lostDirectRevenue - a.lostDirectRevenue);
    
    // SWITCHER TYPE 2: Retail Shopify → RepRally B2B
    // Customer ordered retail first, now orders through RepRally B2B (wholesale)
    const retailToRepRally = allCustomers.filter(c => 
      c.retailOrders > 0 && 
      c.repRallyOrders > 0 && 
      c.lastRetailDate && 
      c.firstRepRallyDate &&
      c.firstRepRallyDate > c.lastRetailDate
    ).map(c => ({
      ...c,
      switchType: 'retail_to_reprally' as const,
      switchDate: c.firstRepRallyDate?.toISOString(),
      daysSinceLastRetail: c.firstRepRallyDate && c.lastRetailDate 
        ? Math.floor((c.firstRepRallyDate.getTime() - c.lastRetailDate.getTime()) / (1000 * 60 * 60 * 24))
        : null,
      retailSpend: c.retailRevenue,
      repRallySpend: c.repRallyRevenue
    })).sort((a, b) => b.retailSpend - a.retailSpend);
    
    // SWITCHER TYPE 3: Any previous channel → RepRally B2B
    // Combined: anyone who has RepRally orders AND ordered from another channel before
    const anyToRepRally = allCustomers.filter(c => {
      if (c.repRallyOrders === 0) return false;
      const hasOtherOrders = c.directOrders > 0 || c.retailOrders > 0;
      if (!hasOtherOrders) return false;
      
      // Get earliest non-RepRally order date
      const earliestOther = [c.firstDirectDate, c.firstRetailDate]
        .filter(Boolean)
        .sort((a, b) => a!.getTime() - b!.getTime())[0];
      
      return earliestOther && c.firstRepRallyDate && c.firstRepRallyDate > earliestOther;
    }).map(c => ({
      ...c,
      switchType: 'any_to_reprally' as const,
      previousChannels: [
        c.directOrders > 0 ? 'Direct' : null,
        c.retailOrders > 0 ? 'Retail Shopify' : null
      ].filter(Boolean),
      totalPreviousRevenue: c.directRevenue + c.retailRevenue,
      repRallyRevenue: c.repRallyRevenue
    })).sort((a, b) => b.totalPreviousRevenue - a.totalPreviousRevenue);
    
    // BUSINESS CUSTOMERS in Retail Shopify (potential wholesale targets)
    const retailBusinessCustomers = allCustomers.filter(c => 
      c.retailOrders > 0 && 
      c.isBusinessName &&
      c.repRallyOrders === 0 // Not yet on RepRally
    ).map(c => ({
      ...c,
      customerType: 'business' as const,
      totalRetailSpend: c.retailRevenue,
      orderCount: c.retailOrders,
      firstOrder: c.firstRetailDate?.toISOString(),
      lastOrder: c.lastRetailDate?.toISOString()
    })).sort((a, b) => b.totalRetailSpend - a.totalRetailSpend);
    
    // Summary stats
    const summary = {
      totalCustomersAnalyzed: allCustomers.length,
      
      directToRepRally: {
        count: directToRepRally.length,
        totalLostDirectRevenue: directToRepRally.reduce((sum, c) => sum + c.lostDirectRevenue, 0),
        totalGainedRepRallyRevenue: directToRepRally.reduce((sum, c) => sum + c.gainedRepRallyRevenue, 0)
      },
      
      retailToRepRally: {
        count: retailToRepRally.length,
        totalRetailSpend: retailToRepRally.reduce((sum, c) => sum + c.retailSpend, 0),
        totalRepRallySpend: retailToRepRally.reduce((sum, c) => sum + c.repRallySpend, 0)
      },
      
      anyToRepRally: {
        count: anyToRepRally.length,
        totalPreviousRevenue: anyToRepRally.reduce((sum, c) => sum + c.totalPreviousRevenue, 0),
        totalRepRallyRevenue: anyToRepRally.reduce((sum, c) => sum + c.repRallyRevenue, 0)
      },
      
      retailBusinessOpportunities: {
        count: retailBusinessCustomers.length,
        totalRetailSpend: retailBusinessCustomers.reduce((sum, c) => sum + c.totalRetailSpend, 0)
      },
      
      channelBreakdown: {
        repRallyOnly: allCustomers.filter(c => c.repRallyOrders > 0 && c.retailOrders === 0 && c.directOrders === 0).length,
        retailOnly: allCustomers.filter(c => c.retailOrders > 0 && c.repRallyOrders === 0 && c.directOrders === 0).length,
        directOnly: allCustomers.filter(c => c.directOrders > 0 && c.repRallyOrders === 0 && c.retailOrders === 0).length,
        multiChannel: allCustomers.filter(c => 
          (c.repRallyOrders > 0 ? 1 : 0) + (c.retailOrders > 0 ? 1 : 0) + (c.directOrders > 0 ? 1 : 0) >= 2
        ).length
      }
    };
    
    console.log(`✅ Comprehensive switchers analysis complete:`);
    console.log(`   Direct → RepRally: ${summary.directToRepRally.count}`);
    console.log(`   Retail → RepRally: ${summary.retailToRepRally.count}`);
    console.log(`   Any → RepRally: ${summary.anyToRepRally.count}`);
    console.log(`   Business opportunities: ${summary.retailBusinessOpportunities.count}`);
    
    // Format dates for JSON
    const formatCustomer = (c: any) => ({
      ...c,
      firstRepRallyDate: c.firstRepRallyDate?.toISOString() || null,
      lastRepRallyDate: c.lastRepRallyDate?.toISOString() || null,
      firstRetailDate: c.firstRetailDate?.toISOString() || null,
      lastRetailDate: c.lastRetailDate?.toISOString() || null,
      firstDirectDate: c.firstDirectDate?.toISOString() || null,
      lastDirectDate: c.lastDirectDate?.toISOString() || null,
      orders: c.orders?.map((o: any) => ({
        ...o,
        postingDate: o.postingDate?.toISOString() || null
      }))
    });
    
    return NextResponse.json({
      success: true,
      summary,
      directToRepRally: directToRepRally.slice(0, limit).map(formatCustomer),
      retailToRepRally: retailToRepRally.slice(0, limit).map(formatCustomer),
      anyToRepRally: anyToRepRally.slice(0, limit).map(formatCustomer),
      retailBusinessOpportunities: retailBusinessCustomers.slice(0, limit).map(formatCustomer)
    });
  } catch (error: any) {
    console.error('❌ Comprehensive switchers error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

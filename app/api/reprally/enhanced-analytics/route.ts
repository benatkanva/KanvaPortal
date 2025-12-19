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
type OrderType = 'reprally' | 'retail_shopify' | 'fishbowl' | 'unknown';

function classifyOrder(orderNum: string): OrderType {
  const num = String(orderNum || '').trim();
  
  // Retail Shopify: starts with "Sh"
  if (num.toLowerCase().startsWith('sh')) {
    return 'retail_shopify';
  }
  
  // RepRally B2B: starts with # and has long alphanumeric code
  if (num.startsWith('#') && num.length >= 10) {
    return 'reprally';
  }
  
  // Fishbowl: 4-6 digit numeric
  if (/^\d{4,6}$/.test(num)) {
    return 'fishbowl';
  }
  
  // Long alphanumeric without # could also be RepRally
  if (/^[A-Z0-9]{10,}$/i.test(num.replace(/[^A-Z0-9]/gi, ''))) {
    return 'reprally';
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

interface CustomerAggregate {
  customerId: string;
  businessName: string;
  billingAddress: string;
  billingCity: string;
  billingState: string;
  billingZip: string;
  orders: Map<string, OrderAggregate>;
  totalRevenue: number;
  totalOrders: number;
  skuMix: Map<string, { sku: string; productName: string; qty: number; revenue: number }>;
  firstOrderDate: Date | null;
  lastOrderDate: Date | null;
}

interface OrderAggregate {
  orderNum: string;
  orderType: OrderType;
  postingDate: Date | null;
  postingDateStr: string | null;
  revenue: number;
  lineItems: any[];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderTypeFilter = searchParams.get('orderType') as OrderType | 'all' | null;
    const limitParam = searchParams.get('limit');
    const itemLimit = limitParam ? parseInt(limitParam, 10) : 50000; // Default limit to prevent timeout
    
    console.log('📊 Enhanced RepRally Analytics: Loading line items...');
    
    // Load line items with limit to prevent timeout
    // Filter for likely RepRally/Shopify orders by checking salesOrderNum patterns
    const itemsSnap = await adminDb.collection('fishbowl_soitems')
      .limit(itemLimit)
      .get();
    console.log(`   Loaded ${itemsSnap.size} line items (limit: ${itemLimit})`);
    
    // Group by billing key to properly identify unique customers
    const customersByKey = new Map<string, CustomerAggregate>();
    
    // Track overall stats by order type
    const statsByType = {
      reprally: { orders: new Set<string>(), revenue: 0, customers: new Set<string>() },
      retail_shopify: { orders: new Set<string>(), revenue: 0, customers: new Set<string>() },
      fishbowl: { orders: new Set<string>(), revenue: 0, customers: new Set<string>() },
      unknown: { orders: new Set<string>(), revenue: 0, customers: new Set<string>() }
    };
    
    // SKU mix across all orders
    const globalSkuMix = new Map<string, { sku: string; productName: string; qty: number; revenue: number }>();
    
    for (const doc of itemsSnap.docs) {
      const item = doc.data();
      const orderNum = String(item.salesOrderNum || '').trim();
      const orderType = classifyOrder(orderNum);
      
      // Skip if filtering by order type
      if (orderTypeFilter && orderTypeFilter !== 'all' && orderType !== orderTypeFilter) {
        continue;
      }
      
      // Only process RepRally and Retail Shopify for this analysis
      if (orderType !== 'reprally' && orderType !== 'retail_shopify') {
        continue;
      }
      
      // Extract billing info
      const billingName = String(item.billingName || item.billToName || item.customerName || '').trim();
      const billingAddress = String(item.billingAddress || item.billToAddress || '').trim();
      const billingCity = String(item.billingCity || item.billToCity || item.shippingCity || '').trim();
      const billingState = String(item.billingState || item.billToState || item.shippingState || '').trim();
      const billingZip = String(item.billingZip || item.billToZip || '').trim();
      
      // Create unique customer key
      const customerKey = `${billingName}|${billingAddress}|${billingCity}|${billingState}`.toLowerCase();
      
      // Skip if no customer identification
      if (!billingName && !billingCity) continue;
      
      // Get or create customer aggregate
      if (!customersByKey.has(customerKey)) {
        customersByKey.set(customerKey, {
          customerId: customerKey,
          businessName: billingName || `${billingCity}, ${billingState}`,
          billingAddress,
          billingCity,
          billingState,
          billingZip,
          orders: new Map(),
          totalRevenue: 0,
          totalOrders: 0,
          skuMix: new Map(),
          firstOrderDate: null,
          lastOrderDate: null
        });
      }
      
      const customer = customersByKey.get(customerKey)!;
      
      // Get or create order aggregate
      if (!customer.orders.has(orderNum)) {
        const orderDate = safeDate(item.postingDate);
        customer.orders.set(orderNum, {
          orderNum,
          orderType,
          postingDate: orderDate,
          postingDateStr: orderDate?.toISOString() || null,
          revenue: 0,
          lineItems: []
        });
        customer.totalOrders++;
        statsByType[orderType].orders.add(orderNum);
        statsByType[orderType].customers.add(customerKey);
      }
      
      const order = customer.orders.get(orderNum)!;
      
      // Extract product info
      const sku = String(item.productNum || item.sku || item.partNumber || '').trim();
      const productName = String(item.productDescription || item.description || item.product || sku).trim();
      const qty = toNumber(item.qtyOrdered || item.quantity || 1);
      const lineRevenue = toNumber(item.revenue || item.totalPrice || item.lineTotal || 0);
      
      // Skip excluded products from revenue
      const isExcluded = isExcludedProduct(productName) || isExcludedProduct(sku);
      
      // Add line item to order
      order.lineItems.push({
        id: doc.id,
        sku,
        productName,
        qty,
        revenue: lineRevenue,
        excluded: isExcluded
      });
      
      // Only count revenue for non-excluded products
      if (!isExcluded) {
        order.revenue += lineRevenue;
        customer.totalRevenue += lineRevenue;
        statsByType[orderType].revenue += lineRevenue;
        
        // Update SKU mix
        if (sku) {
          if (!customer.skuMix.has(sku)) {
            customer.skuMix.set(sku, { sku, productName, qty: 0, revenue: 0 });
          }
          const skuData = customer.skuMix.get(sku)!;
          skuData.qty += qty;
          skuData.revenue += lineRevenue;
          
          // Global SKU mix
          if (!globalSkuMix.has(sku)) {
            globalSkuMix.set(sku, { sku, productName, qty: 0, revenue: 0 });
          }
          const globalSku = globalSkuMix.get(sku)!;
          globalSku.qty += qty;
          globalSku.revenue += lineRevenue;
        }
      }
      
      // Update order date range
      const orderDate = safeDate(item.postingDate);
      if (orderDate) {
        if (!customer.firstOrderDate || orderDate < customer.firstOrderDate) {
          customer.firstOrderDate = orderDate;
        }
        if (!customer.lastOrderDate || orderDate > customer.lastOrderDate) {
          customer.lastOrderDate = orderDate;
        }
      }
    }
    
    // Convert to arrays and sort
    const customers = Array.from(customersByKey.values())
      .map(c => ({
        ...c,
        orders: Array.from(c.orders.values())
          .map(o => ({
            ...o,
            postingDate: o.postingDateStr // Use string version for JSON
          }))
          .sort((a, b) => {
            const dateA = new Date(a.postingDate || 0).getTime();
            const dateB = new Date(b.postingDate || 0).getTime();
            return dateB - dateA; // Most recent first
          }),
        skuMix: Array.from(c.skuMix.values()).sort((a, b) => b.revenue - a.revenue),
        firstOrderDate: c.firstOrderDate?.toISOString() || null,
        lastOrderDate: c.lastOrderDate?.toISOString() || null
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
    
    // Top SKUs globally
    const topSkus = Array.from(globalSkuMix.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 50);
    
    // Summary stats
    const summary = {
      totalCustomers: customers.length,
      totalOrders: customers.reduce((sum, c) => sum + c.totalOrders, 0),
      totalRevenue: customers.reduce((sum, c) => sum + c.totalRevenue, 0),
      byOrderType: {
        reprally: {
          customers: statsByType.reprally.customers.size,
          orders: statsByType.reprally.orders.size,
          revenue: statsByType.reprally.revenue
        },
        retail_shopify: {
          customers: statsByType.retail_shopify.customers.size,
          orders: statsByType.retail_shopify.orders.size,
          revenue: statsByType.retail_shopify.revenue
        }
      },
      avgOrderValue: customers.reduce((sum, c) => sum + c.totalRevenue, 0) / 
        Math.max(1, customers.reduce((sum, c) => sum + c.totalOrders, 0))
    };
    
    console.log(`✅ Enhanced analytics: ${summary.totalCustomers} customers, ${summary.totalOrders} orders, $${summary.totalRevenue.toLocaleString()} revenue`);
    console.log(`   RepRally B2B: ${summary.byOrderType.reprally.customers} customers, ${summary.byOrderType.reprally.orders} orders`);
    console.log(`   Retail Shopify: ${summary.byOrderType.retail_shopify.customers} customers, ${summary.byOrderType.retail_shopify.orders} orders`);
    
    return NextResponse.json({
      success: true,
      summary,
      topCustomers: customers.slice(0, 100),
      topSkus,
      excludedProducts: EXCLUDED_PRODUCTS
    });
  } catch (error: any) {
    console.error('❌ Enhanced analytics error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

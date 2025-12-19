import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

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

interface CustomerCache {
  customerId: string;
  businessName: string;
  billingAddress: string;
  billingCity: string;
  billingState: string;
  billingZip: string;
  totalRevenue: number;
  totalOrders: number;
  reprallyRevenue: number;
  reprallyOrders: number;
  retailRevenue: number;
  retailOrders: number;
  firstOrderDate: string | null;
  lastOrderDate: string | null;
  topSkus: { sku: string; productName: string; qty: number; revenue: number }[];
  isSwitcher: boolean;
  lat?: number;
  lng?: number;
}

interface SwitcherCache {
  customerId: string;
  businessName: string;
  billingCity: string;
  billingState: string;
  directRevenue: number;
  directOrders: number;
  reprallyRevenue: number;
  reprallyOrders: number;
  lastDirectDate: string | null;
  firstReprallyDate: string | null;
  daysBetweenSwitch: number;
  originalSalesRep: string;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('🔄 Starting RepRally cache rebuild...');
    
    // Step 1: Load line items with limit to prevent timeout
    // Firebase Cloud Functions have 60s timeout, so we limit to prevent issues
    console.log('📦 Loading line items (limited to prevent timeout)...');
    const itemsSnap = await adminDb.collection('fishbowl_soitems')
      .limit(80000) // Limit to prevent timeout
      .get();
    console.log(`   Loaded ${itemsSnap.size} line items`);
    
    // Step 2: Load sales orders with limit
    console.log('📦 Loading sales orders...');
    const ordersSnap = await adminDb.collection('fishbowl_sales_orders')
      .limit(50000)
      .get();
    console.log(`   Loaded ${ordersSnap.size} sales orders`);
    
    // Step 3: Load existing customer geocoding data
    console.log('📦 Loading existing RepRally customers for geocoding...');
    const existingReprallySnap = await adminDb.collection('reprally_customers')
      .limit(10000)
      .get();
    const existingGeoData = new Map<string, { lat: number; lng: number }>();
    existingReprallySnap.forEach(doc => {
      const data = doc.data();
      if (data.lat && data.lng) {
        const key = `${data.businessName}|${data.billingCity}|${data.billingState}`.toLowerCase();
        existingGeoData.set(key, { lat: data.lat, lng: data.lng });
      }
    });
    console.log(`   Found ${existingGeoData.size} geocoded customers`);
    
    // Group data by customer
    const customersByKey = new Map<string, {
      customerId: string;
      businessName: string;
      billingAddress: string;
      billingCity: string;
      billingState: string;
      billingZip: string;
      orders: Map<string, { orderNum: string; orderType: OrderType; postingDate: Date | null; revenue: number }>;
      totalRevenue: number;
      reprallyRevenue: number;
      retailRevenue: number;
      skuMix: Map<string, { sku: string; productName: string; qty: number; revenue: number }>;
      firstOrderDate: Date | null;
      lastOrderDate: Date | null;
    }>();
    
    // Process line items
    console.log('⚙️ Processing line items...');
    let processedItems = 0;
    
    for (const doc of itemsSnap.docs) {
      const item = doc.data();
      const orderNum = String(item.salesOrderNum || '').trim();
      const orderType = classifyOrder(orderNum);
      
      // Only process RepRally and Retail Shopify
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
      
      if (!billingName && !billingCity) continue;
      
      // Get or create customer
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
          reprallyRevenue: 0,
          retailRevenue: 0,
          skuMix: new Map(),
          firstOrderDate: null,
          lastOrderDate: null
        });
      }
      
      const customer = customersByKey.get(customerKey)!;
      
      // Track order
      if (!customer.orders.has(orderNum)) {
        customer.orders.set(orderNum, {
          orderNum,
          orderType,
          postingDate: safeDate(item.postingDate),
          revenue: 0
        });
      }
      
      const order = customer.orders.get(orderNum)!;
      
      // Process line item
      const sku = String(item.productNum || item.sku || item.partNumber || '').trim();
      const productName = String(item.productDescription || item.description || item.product || sku).trim();
      const qty = toNumber(item.qtyOrdered || item.quantity || 1);
      const lineRevenue = toNumber(item.revenue || item.totalPrice || item.lineTotal || 0);
      
      const isExcluded = isExcludedProduct(productName) || isExcludedProduct(sku);
      
      if (!isExcluded) {
        order.revenue += lineRevenue;
        customer.totalRevenue += lineRevenue;
        
        if (orderType === 'reprally') {
          customer.reprallyRevenue += lineRevenue;
        } else if (orderType === 'retail_shopify') {
          customer.retailRevenue += lineRevenue;
        }
        
        // Track SKU
        if (sku) {
          if (!customer.skuMix.has(sku)) {
            customer.skuMix.set(sku, { sku, productName, qty: 0, revenue: 0 });
          }
          const skuData = customer.skuMix.get(sku)!;
          skuData.qty += qty;
          skuData.revenue += lineRevenue;
        }
      }
      
      // Update date range
      const orderDate = safeDate(item.postingDate);
      if (orderDate) {
        if (!customer.firstOrderDate || orderDate < customer.firstOrderDate) {
          customer.firstOrderDate = orderDate;
        }
        if (!customer.lastOrderDate || orderDate > customer.lastOrderDate) {
          customer.lastOrderDate = orderDate;
        }
      }
      
      processedItems++;
    }
    
    console.log(`   Processed ${processedItems} relevant line items`);
    console.log(`   Found ${customersByKey.size} unique customers`);
    
    // Step 4: Identify switchers from sales orders
    console.log('⚙️ Analyzing switchers from sales orders...');
    const directOrdersByCustomer = new Map<string, { 
      orders: number; 
      revenue: number; 
      lastDate: Date | null;
      salesRep: string;
    }>();
    
    for (const doc of ordersSnap.docs) {
      const order = doc.data();
      const orderNum = String(order.salesOrderNum || order.orderNum || '').trim();
      const orderType = classifyOrder(orderNum);
      
      // Only track direct (fishbowl) orders for switcher analysis
      if (orderType !== 'fishbowl') continue;
      
      const customerId = String(order.customerId || '').trim();
      if (!customerId) continue;
      
      const postingDate = safeDate(order.postingDate || order.dateScheduled);
      const revenue = toNumber(order.revenue || order.totalAmount || 0);
      const salesRep = String(order.salesPerson || order.salesRep || '').trim();
      
      if (!directOrdersByCustomer.has(customerId)) {
        directOrdersByCustomer.set(customerId, { 
          orders: 0, 
          revenue: 0, 
          lastDate: null,
          salesRep: salesRep
        });
      }
      
      const stats = directOrdersByCustomer.get(customerId)!;
      stats.orders++;
      stats.revenue += revenue;
      if (postingDate && (!stats.lastDate || postingDate > stats.lastDate)) {
        stats.lastDate = postingDate;
        if (salesRep) stats.salesRep = salesRep;
      }
    }
    
    // Step 5: Build cache documents
    console.log('💾 Building cache documents...');
    const customerCacheDocs: CustomerCache[] = [];
    const switcherCacheDocs: SwitcherCache[] = [];
    
    // Summary stats
    const summary = {
      totalCustomers: 0,
      totalRevenue: 0,
      reprallyCustomers: 0,
      reprallyRevenue: 0,
      reprallyOrders: 0,
      retailCustomers: 0,
      retailRevenue: 0,
      retailOrders: 0,
      switcherCount: 0,
      topStates: new Map<string, { count: number; revenue: number }>(),
      topSkus: new Map<string, { sku: string; productName: string; qty: number; revenue: number }>()
    };
    
    for (const [key, customer] of customersByKey) {
      const reprallyOrders = Array.from(customer.orders.values()).filter(o => o.orderType === 'reprally').length;
      const retailOrders = Array.from(customer.orders.values()).filter(o => o.orderType === 'retail_shopify').length;
      
      // Check if this is a switcher (had direct orders before RepRally)
      let isSwitcher = false;
      let switcherData: SwitcherCache | null = null;
      
      // Try to match with direct order customers
      for (const [directCustomerId, directStats] of directOrdersByCustomer) {
        // Match by name similarity
        const directName = directCustomerId.toLowerCase();
        const reprallyName = customer.businessName.toLowerCase();
        
        if (directName.includes(reprallyName) || reprallyName.includes(directName) ||
            (customer.billingCity && directName.includes(customer.billingCity.toLowerCase()))) {
          
          const firstReprallyDate = Array.from(customer.orders.values())
            .filter(o => o.orderType === 'reprally' && o.postingDate)
            .sort((a, b) => (a.postingDate?.getTime() || 0) - (b.postingDate?.getTime() || 0))[0]?.postingDate;
          
          if (directStats.lastDate && firstReprallyDate && directStats.lastDate < firstReprallyDate) {
            isSwitcher = true;
            const daysBetween = Math.round((firstReprallyDate.getTime() - directStats.lastDate.getTime()) / (1000 * 60 * 60 * 24));
            
            switcherData = {
              customerId: key,
              businessName: customer.businessName,
              billingCity: customer.billingCity,
              billingState: customer.billingState,
              directRevenue: directStats.revenue,
              directOrders: directStats.orders,
              reprallyRevenue: customer.reprallyRevenue,
              reprallyOrders: reprallyOrders,
              lastDirectDate: directStats.lastDate.toISOString(),
              firstReprallyDate: firstReprallyDate.toISOString(),
              daysBetweenSwitch: daysBetween,
              originalSalesRep: directStats.salesRep
            };
            break;
          }
        }
      }
      
      // Get geocoding data if available
      const geoKey = `${customer.businessName}|${customer.billingCity}|${customer.billingState}`.toLowerCase();
      const geoData = existingGeoData.get(geoKey);
      
      const customerDoc: CustomerCache = {
        customerId: key,
        businessName: customer.businessName,
        billingAddress: customer.billingAddress,
        billingCity: customer.billingCity,
        billingState: customer.billingState,
        billingZip: customer.billingZip,
        totalRevenue: customer.totalRevenue,
        totalOrders: customer.orders.size,
        reprallyRevenue: customer.reprallyRevenue,
        reprallyOrders: reprallyOrders,
        retailRevenue: customer.retailRevenue,
        retailOrders: retailOrders,
        firstOrderDate: customer.firstOrderDate?.toISOString() || null,
        lastOrderDate: customer.lastOrderDate?.toISOString() || null,
        topSkus: Array.from(customer.skuMix.values())
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 10),
        isSwitcher,
        ...(geoData && { lat: geoData.lat, lng: geoData.lng })
      };
      
      customerCacheDocs.push(customerDoc);
      
      if (switcherData) {
        switcherCacheDocs.push(switcherData);
        summary.switcherCount++;
      }
      
      // Update summary stats
      summary.totalCustomers++;
      summary.totalRevenue += customer.totalRevenue;
      
      if (reprallyOrders > 0) {
        summary.reprallyCustomers++;
        summary.reprallyRevenue += customer.reprallyRevenue;
        summary.reprallyOrders += reprallyOrders;
      }
      
      if (retailOrders > 0) {
        summary.retailCustomers++;
        summary.retailRevenue += customer.retailRevenue;
        summary.retailOrders += retailOrders;
      }
      
      // State stats
      if (customer.billingState) {
        if (!summary.topStates.has(customer.billingState)) {
          summary.topStates.set(customer.billingState, { count: 0, revenue: 0 });
        }
        const stateStats = summary.topStates.get(customer.billingState)!;
        stateStats.count++;
        stateStats.revenue += customer.totalRevenue;
      }
      
      // Global SKU stats
      for (const [sku, skuData] of customer.skuMix) {
        if (!summary.topSkus.has(sku)) {
          summary.topSkus.set(sku, { ...skuData });
        } else {
          const globalSku = summary.topSkus.get(sku)!;
          globalSku.qty += skuData.qty;
          globalSku.revenue += skuData.revenue;
        }
      }
    }
    
    // Sort customers by revenue
    customerCacheDocs.sort((a, b) => b.totalRevenue - a.totalRevenue);
    switcherCacheDocs.sort((a, b) => b.reprallyRevenue - a.reprallyRevenue);
    
    // Step 6: Write to Firestore cache collections
    console.log('💾 Writing to Firestore cache...');
    const batch = adminDb.batch();
    
    // Write summary document
    const summaryDoc = {
      totalCustomers: summary.totalCustomers,
      totalRevenue: summary.totalRevenue,
      reprallyCustomers: summary.reprallyCustomers,
      reprallyRevenue: summary.reprallyRevenue,
      reprallyOrders: summary.reprallyOrders,
      retailCustomers: summary.retailCustomers,
      retailRevenue: summary.retailRevenue,
      retailOrders: summary.retailOrders,
      switcherCount: summary.switcherCount,
      avgOrderValue: summary.totalRevenue / Math.max(1, summary.reprallyOrders + summary.retailOrders),
      topStates: Array.from(summary.topStates.entries())
        .map(([state, stats]) => ({ state, ...stats }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 20),
      topSkus: Array.from(summary.topSkus.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 50),
      updatedAt: FieldValue.serverTimestamp(),
      buildDurationMs: Date.now() - startTime
    };
    
    batch.set(adminDb.collection('cache_reprally').doc('summary'), summaryDoc);
    
    // Write top 200 customers (for quick loading)
    batch.set(adminDb.collection('cache_reprally').doc('top_customers'), {
      customers: customerCacheDocs.slice(0, 200),
      updatedAt: FieldValue.serverTimestamp()
    });
    
    // Write switchers
    batch.set(adminDb.collection('cache_reprally').doc('switchers'), {
      switchers: switcherCacheDocs,
      count: switcherCacheDocs.length,
      updatedAt: FieldValue.serverTimestamp()
    });
    
    // Write all customers in chunks (for map/full list)
    const chunkSize = 500;
    for (let i = 0; i < customerCacheDocs.length; i += chunkSize) {
      const chunk = customerCacheDocs.slice(i, i + chunkSize);
      const chunkNum = Math.floor(i / chunkSize);
      batch.set(adminDb.collection('cache_reprally').doc(`customers_chunk_${chunkNum}`), {
        customers: chunk,
        chunkIndex: chunkNum,
        totalChunks: Math.ceil(customerCacheDocs.length / chunkSize),
        updatedAt: FieldValue.serverTimestamp()
      });
    }
    
    await batch.commit();
    
    const duration = Date.now() - startTime;
    console.log(`✅ Cache rebuild complete in ${duration}ms`);
    console.log(`   ${summary.totalCustomers} customers, ${summary.reprallyOrders + summary.retailOrders} orders, $${summary.totalRevenue.toLocaleString()} revenue`);
    console.log(`   ${summary.switcherCount} switchers identified`);
    
    return NextResponse.json({
      success: true,
      message: 'Cache rebuilt successfully',
      stats: {
        customers: summary.totalCustomers,
        orders: summary.reprallyOrders + summary.retailOrders,
        revenue: summary.totalRevenue,
        switchers: summary.switcherCount,
        durationMs: duration
      }
    });
    
  } catch (error: any) {
    console.error('❌ Cache rebuild error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

// GET endpoint to check cache status
export async function GET() {
  try {
    const summaryDoc = await adminDb.collection('cache_reprally').doc('summary').get();
    
    if (!summaryDoc.exists) {
      return NextResponse.json({
        success: true,
        cached: false,
        message: 'No cache exists. Run POST to rebuild.'
      });
    }
    
    const data = summaryDoc.data();
    return NextResponse.json({
      success: true,
      cached: true,
      updatedAt: data?.updatedAt?.toDate?.()?.toISOString() || null,
      stats: {
        customers: data?.totalCustomers,
        orders: data?.reprallyOrders + data?.retailOrders,
        revenue: data?.totalRevenue,
        switchers: data?.switcherCount,
        lastBuildDurationMs: data?.buildDurationMs
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

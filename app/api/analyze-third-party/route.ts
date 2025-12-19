import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

interface ThirdPartyOrder {
  orderNum: string;
  postingDate: Date;
  salesRep: string;
  totalAmount: number;
  billingName?: string;
  customerId: string;
}

interface CustomerAnalysis {
  customerId: string;
  customerName: string;
  billingName?: string;
  
  // Direct orders (before RepRally)
  firstDirectOrder?: Date;
  lastDirectOrder?: Date;
  directOrderCount: number;
  directRevenue: number;
  originalSalesRep?: string;
  
  // RepRally orders
  firstRepRallyOrder?: Date;
  lastRepRallyOrder?: Date;
  repRallyOrderCount: number;
  repRallyRevenue: number;
  
  // Switch analysis
  isSwitcher: boolean;
  daysBetweenSwitch?: number;
  switchDate?: Date;
  
  // Current status
  status: 'direct_only' | 'reprally_only' | 'switched_to_reprally' | 'mixed';
}

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Starting 3rd party sales analysis...');
    
    const { searchParams } = new URL(request.url);
    const analysisType = searchParams.get('type') || 'switchers'; // switchers | all | reprally_only
    const orderLimit = parseInt(searchParams.get('limit') || '30000', 10); // Limit to prevent timeout
    
    // Step 1: Load customers first to get billing info
    console.log('📦 Loading customer data...');
    const customersSnap = await adminDb.collection('fishbowl_customers').limit(5000).get();
    const customersById = new Map();
    for (const doc of customersSnap.docs) {
      const customer = doc.data();
      customersById.set(doc.id, {
        name: customer.name || customer.customerName,
        billingAddress: customer.billingAddress || customer.shippingAddress,
        billingCity: customer.billingCity || customer.shippingCity,
        billingState: customer.billingState || customer.shippingState,
        billingZip: customer.billingZip || customer.shippingZip
      });
    }
    console.log(`   Loaded ${customersById.size} customers with address data`);
    
    // Step 2: Get SALES ORDERS with limit to prevent timeout
    const ordersSnap = await adminDb
      .collection('fishbowl_sales_orders')
      .limit(orderLimit)
      .get();
    
    console.log(`📦 Analyzing ${ordersSnap.size} sales orders...`);
    
    // Track all RepRally orders for detailed view
    const allRepRallyOrders: any[] = [];
    let repRallyOrderCount = 0;
    let directOrderCount = 0;
    
    // Group by customer and order type
    const customerMap = new Map<string, CustomerAnalysis>();
    
    for (const doc of ordersSnap.docs) {
      const order = doc.data();
      const customerId = String(order.customerId || '');
      const customerName = String(order.customerName || '');
      const salesRep = String(order.salesRep || order.salesPerson || '');
      const orderNum = String(order.fishbowlNum || order.salesOrderNum || order.num || '');
      const postingDate = order.postingDate?.toDate?.() || new Date(order.postingDateStr || '');
      const totalAmount = parseFloat(order.revenue || order.orderValue || order.totalAmount || 0);
      
      // JOIN: Get customer billing info
      const customerInfo = customersById.get(customerId);
      
      // IMPORTANT: Use actual customer name from customer record, NOT "Shopify Customer"
      const actualBusinessName = customerInfo?.name || '';
      const billingAddress = customerInfo?.billingAddress || '';
      const billingCity = customerInfo?.billingCity || '';
      const billingState = customerInfo?.billingState || '';
      const billingZip = customerInfo?.billingZip || '';
      
      // Skip invalid data or orders without customer match
      if (!customerId || !customerInfo || !postingDate || isNaN(postingDate.getTime())) continue;
      
      // Identify RepRally orders - MORE COMPREHENSIVE DETECTION
      const isRepRallyOrder = 
        customerName.toLowerCase().includes('shopify') ||
        customerName.toLowerCase() === 'shopify customer' ||
        salesRep.toLowerCase().includes('robert farias') ||
        salesRep.toLowerCase().includes('farias') ||
        orderNum.startsWith('#') ||
        orderNum.includes('QPQ') || // Shopify order pattern from your screenshot
        orderNum.includes('000000');
      
      // Log first 10 RepRally orders for debugging
      if (isRepRallyOrder && repRallyOrderCount < 10) {
        console.log(`   🛍️ RepRally order: ${orderNum}`);
        console.log(`      Generic Name: ${customerName} (Shopify Customer)`);
        console.log(`      ACTUAL Business: ${actualBusinessName}`);
        console.log(`      Address: ${billingAddress}, ${billingCity}, ${billingState} ${billingZip}`);
        console.log(`      Amount: $${totalAmount}`);
      }
      
      if (isRepRallyOrder) {
        repRallyOrderCount++;
        allRepRallyOrders.push({
          orderNum,
          customerName: actualBusinessName, // Use actual business name
          businessName: actualBusinessName,
          billingAddress,
          billingCity,
          billingState,
          billingZip,
          salesRep,
          postingDate,
          totalAmount,
          customerId
        });
      } else {
        directOrderCount++;
      }
      
      // Get or create customer analysis
      if (!customerMap.has(customerId)) {
        customerMap.set(customerId, {
          customerId,
          customerName: actualBusinessName,
          billingName: actualBusinessName,
          directOrderCount: 0,
          directRevenue: 0,
          repRallyOrderCount: 0,
          repRallyRevenue: 0,
          isSwitcher: false,
          status: 'direct_only'
        });
      }
      
      const analysis = customerMap.get(customerId)!;
      
      if (isRepRallyOrder) {
        // RepRally order
        analysis.repRallyOrderCount++;
        analysis.repRallyRevenue += totalAmount;
        
        if (!analysis.firstRepRallyOrder || postingDate < analysis.firstRepRallyOrder) {
          analysis.firstRepRallyOrder = postingDate;
        }
        if (!analysis.lastRepRallyOrder || postingDate > analysis.lastRepRallyOrder) {
          analysis.lastRepRallyOrder = postingDate;
        }
      } else {
        // Direct order
        analysis.directOrderCount++;
        analysis.directRevenue += totalAmount;
        
        if (!analysis.firstDirectOrder || postingDate < analysis.firstDirectOrder) {
          analysis.firstDirectOrder = postingDate;
        }
        if (!analysis.lastDirectOrder || postingDate > analysis.lastDirectOrder) {
          analysis.lastDirectOrder = postingDate;
          analysis.originalSalesRep = salesRep;
        }
      }
    }
    
    // Step 2: Classify customers and identify switchers
    const switchers: CustomerAnalysis[] = [];
    const repRallyOnly: CustomerAnalysis[] = [];
    const directOnly: CustomerAnalysis[] = [];
    const mixed: CustomerAnalysis[] = [];
    
    for (const [customerId, analysis] of customerMap.entries()) {
      // Determine status
      if (analysis.directOrderCount > 0 && analysis.repRallyOrderCount > 0) {
        // Has both - check if they switched
        if (analysis.lastDirectOrder && analysis.firstRepRallyOrder) {
          if (analysis.firstRepRallyOrder > analysis.lastDirectOrder) {
            // Switched from direct to RepRally
            analysis.isSwitcher = true;
            analysis.status = 'switched_to_reprally';
            analysis.switchDate = analysis.firstRepRallyOrder;
            analysis.daysBetweenSwitch = Math.floor(
              (analysis.firstRepRallyOrder.getTime() - analysis.lastDirectOrder.getTime()) / (1000 * 60 * 60 * 24)
            );
            switchers.push(analysis);
          } else {
            // Mixed - both types but not a clear switch
            analysis.status = 'mixed';
            mixed.push(analysis);
          }
        }
      } else if (analysis.repRallyOrderCount > 0) {
        // RepRally only
        analysis.status = 'reprally_only';
        repRallyOnly.push(analysis);
      } else {
        // Direct only
        analysis.status = 'direct_only';
        directOnly.push(analysis);
      }
    }
    
    // Sort switchers by switch date (most recent first)
    switchers.sort((a, b) => {
      const dateA = a.switchDate?.getTime() || 0;
      const dateB = b.switchDate?.getTime() || 0;
      return dateB - dateA;
    });
    
    // Calculate summary stats
    const totalSwitchers = switchers.length;
    const totalLostRevenue = switchers.reduce((sum, s) => sum + s.directRevenue, 0);
    const totalRepRallyRevenue = switchers.reduce((sum, s) => sum + s.repRallyRevenue, 0);
    
    // Group by original sales rep
    const repImpact = new Map<string, { lostCustomers: number; lostRevenue: number }>();
    for (const switcher of switchers) {
      const rep = switcher.originalSalesRep || 'Unknown';
      if (!repImpact.has(rep)) {
        repImpact.set(rep, { lostCustomers: 0, lostRevenue: 0 });
      }
      const impact = repImpact.get(rep)!;
      impact.lostCustomers++;
      impact.lostRevenue += switcher.directRevenue;
    }
    
    console.log(`\n📊 ANALYSIS SUMMARY:`);
    console.log(`   Total sales orders scanned: ${ordersSnap.size}`);
    console.log(`   RepRally orders found: ${repRallyOrderCount}`);
    console.log(`   Direct orders found: ${directOrderCount}`);
    console.log(`   Unique customers: ${customerMap.size}`);
    console.log(`   Switchers (Direct → RepRally): ${totalSwitchers}`);
    console.log(`   RepRally only customers: ${repRallyOnly.length}`);
    console.log(`   Mixed customers: ${mixed.length}`);
    console.log(`✅ Analysis complete`);
    
    // Sort all RepRally orders by date
    allRepRallyOrders.sort((a, b) => b.postingDate.getTime() - a.postingDate.getTime());
    
    return NextResponse.json({
      success: true,
      summary: {
        totalCustomers: customerMap.size,
        totalOrders: ordersSnap.size,
        repRallyOrdersFound: repRallyOrderCount,
        directOrdersFound: directOrderCount,
        switchers: totalSwitchers,
        repRallyOnly: repRallyOnly.length,
        directOnly: directOnly.length,
        mixed: mixed.length,
        totalLostRevenue,
        totalRepRallyRevenue,
        avgDaysToSwitch: totalSwitchers > 0 
          ? Math.round(switchers.reduce((sum, s) => sum + (s.daysBetweenSwitch || 0), 0) / totalSwitchers)
          : 0
      },
      repImpact: Array.from(repImpact.entries()).map(([rep, impact]) => ({
        salesRep: rep,
        lostCustomers: impact.lostCustomers,
        lostRevenue: impact.lostRevenue
      })).sort((a, b) => b.lostRevenue - a.lostRevenue),
      switchers: analysisType === 'switchers' || analysisType === 'all' ? switchers : [],
      repRallyOnly: analysisType === 'reprally_only' || analysisType === 'all' ? repRallyOnly : [],
      directOnly: analysisType === 'all' ? directOnly.slice(0, 100) : [],
      allRepRallyOrders: allRepRallyOrders.slice(0, 200) // First 200 RepRally orders for detailed view
    });
    
  } catch (error: any) {
    console.error('❌ Third party analysis error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

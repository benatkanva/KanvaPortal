import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Build RepRally customer tracking collection
 * Creates reprally_customers with subcollections for sales_orders and line_items
 * This mirrors the fishbowl_customers structure for RepRally/Shopify orders
 */
export async function POST(request: NextRequest) {
  try {
    const { dryRun = true } = await request.json();
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🛍️ BUILDING REPRALLY CUSTOMER COLLECTION ${dryRun ? '(DRY RUN)' : '(LIVE MODE)'}`);
    console.log(`${'='.repeat(80)}\n`);
    
    const stats = {
      customersProcessed: 0,
      repRallyOrdersFound: 0,
      repRallyCustomersCreated: 0,
      ordersWritten: 0,
      itemsWritten: 0,
      skipped: 0
    };
    
    // Step 1: Load all customers with addresses
    console.log('📦 Loading customer data...');
    const customersSnap = await adminDb.collection('fishbowl_customers').get();
    const customersById = new Map();
    for (const doc of customersSnap.docs) {
      const customer = doc.data();
      customersById.set(doc.id, {
        id: doc.id,
        name: customer.name || customer.customerName,
        accountNumber: customer.accountNumber || '',
        accountType: customer.accountType || 'Retail',
        billingAddress: customer.billingAddress || customer.shippingAddress || '',
        billingCity: customer.billingCity || customer.shippingCity || '',
        billingState: customer.billingState || customer.shippingState || '',
        billingZip: customer.billingZip || customer.shippingZip || '',
        copperId: customer.copperId || '',
        originalOwner: customer.originalOwner || '',
        salesPerson: customer.salesPerson || '',
        customerNum: customer.customerNum || customer.customerId || ''
      });
    }
    console.log(`   Loaded ${customersById.size} customers\n`);
    
    // Step 2: Process all sales orders
    console.log('📦 Processing sales orders...');
    const ordersSnap = await adminDb.collection('fishbowl_sales_orders').get();
    
    const repRallyCustomerOrders = new Map<string, any[]>();
    
    for (const doc of ordersSnap.docs) {
      const order = doc.data();
      const customerId = String(order.customerId || '');
      const customerName = String(order.customerName || '');
      const salesRep = String(order.salesRep || order.salesPerson || '');
      const orderNum = String(order.fishbowlNum || order.num || '');
      
      // Identify RepRally orders
      const isRepRallyOrder = 
        customerName.toLowerCase().includes('shopify') ||
        customerName.toLowerCase() === 'shopify customer' ||
        salesRep.toLowerCase().includes('robert farias') ||
        salesRep.toLowerCase().includes('farias') ||
        orderNum.startsWith('#') ||
        orderNum.includes('QPQ') ||
        orderNum.includes('000000');
      
      if (!isRepRallyOrder) {
        stats.skipped++;
        continue;
      }
      
      stats.repRallyOrdersFound++;
      
      // Get customer info
      const customerInfo = customersById.get(customerId);
      if (!customerInfo) {
        console.log(`   ⚠️ Skipping order ${orderNum} - no customer found for ID: ${customerId}`);
        continue;
      }
      
      // Track orders by customer
      if (!repRallyCustomerOrders.has(customerId)) {
        repRallyCustomerOrders.set(customerId, []);
      }
      
      repRallyCustomerOrders.get(customerId)!.push({
        ...order,
        orderNum,
        actualBusinessName: customerInfo.name
      });
    }
    
    console.log(`   Found ${stats.repRallyOrdersFound} RepRally orders from ${repRallyCustomerOrders.size} unique customers\n`);
    
    // Log the top 10 customers by order count
    console.log('📊 Top RepRally Customers by Order Count:');
    const customerOrderCounts = Array.from(repRallyCustomerOrders.entries())
      .map(([customerId, orders]) => ({
        customerId,
        name: customersById.get(customerId)?.name || 'Unknown',
        orderCount: orders.length
      }))
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, 10);
    
    for (const customer of customerOrderCounts) {
      console.log(`   ${customer.name} (${customer.customerId}): ${customer.orderCount} orders`);
    }
    console.log('');
    
    // Step 3: Get all line items
    console.log('📦 Loading line items...');
    const itemsSnap = await adminDb.collection('fishbowl_soitems').get();
    const itemsByOrder = new Map<string, any[]>();
    
    for (const doc of itemsSnap.docs) {
      const item = doc.data();
      const orderNum = String(item.salesOrderNum || '');
      if (!itemsByOrder.has(orderNum)) {
        itemsByOrder.set(orderNum, []);
      }
      itemsByOrder.get(orderNum)!.push(item);
    }
    console.log(`   Loaded ${itemsSnap.size} line items\n`);
    
    // Step 4: Build RepRally customer collection
    console.log(`${dryRun ? '🟢 DRY RUN - ' : '🔴 LIVE MODE - '}Creating reprally_customers collection...\n`);
    
    const batch = adminDb.batch();
    let batchCount = 0;
    
    for (const [customerId, orders] of repRallyCustomerOrders.entries()) {
      const customerInfo = customersById.get(customerId)!;
      
      // Create RepRally customer document
      const repRallyCustomerRef = adminDb.collection('reprally_customers').doc(customerId);
      
      const repRallyCustomerData = {
        customerId,
        businessName: customerInfo.name,
        accountNumber: customerInfo.accountNumber,
        accountType: customerInfo.accountType,
        billingAddress: customerInfo.billingAddress,
        billingCity: customerInfo.billingCity,
        billingState: customerInfo.billingState,
        billingZip: customerInfo.billingZip,
        copperId: customerInfo.copperId,
        originalOwner: customerInfo.originalOwner,
        originalSalesRep: customerInfo.originalOwner || customerInfo.salesPerson,
        
        // RepRally stats
        totalRepRallyOrders: orders.length,
        firstRepRallyOrder: orders.length > 0 ? orders[0].postingDate : null,
        lastRepRallyOrder: orders.length > 0 ? orders[orders.length - 1].postingDate : null,
        totalRepRallyRevenue: orders.reduce((sum, o) => sum + (parseFloat(o.revenue || 0)), 0),
        
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        source: 'reprally_builder'
      };
      
      if (!dryRun) {
        batch.set(repRallyCustomerRef, repRallyCustomerData);
        batchCount++;
      }
      
      stats.repRallyCustomersCreated++;
      
      // Add orders to subcollection
      for (const order of orders) {
        const orderNum = order.orderNum;
        const orderRef = repRallyCustomerRef.collection('sales_orders').doc(orderNum);
        
        if (!dryRun) {
          batch.set(orderRef, {
            ...order,
            businessName: customerInfo.name,
            writtenAt: Timestamp.now()
          });
          batchCount++;
          stats.ordersWritten++;
        }
        
        // Add line items to order subcollection
        const items = itemsByOrder.get(orderNum) || [];
        for (const item of items) {
          const itemId = String(item.lineItemId || item.id);
          const itemRef = orderRef.collection('line_items').doc(itemId);
          
          if (!dryRun) {
            batch.set(itemRef, {
              ...item,
              businessName: customerInfo.name,
              writtenAt: Timestamp.now()
            });
            batchCount++;
            stats.itemsWritten++;
          }
        }
        
        // Commit batch every 400 operations
        if (batchCount >= 400) {
          if (!dryRun) {
            await batch.commit();
            console.log(`   ✅ Committed batch of ${batchCount} operations`);
          }
          batchCount = 0;
        }
      }
      
      if (stats.repRallyCustomersCreated % 10 === 0) {
        console.log(`   📊 Progress: ${stats.repRallyCustomersCreated} customers processed`);
      }
    }
    
    // Commit final batch
    if (batchCount > 0 && !dryRun) {
      await batch.commit();
      console.log(`   ✅ Committed final batch of ${batchCount} operations\n`);
    }
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`✅ REPRALLY COLLECTION ${dryRun ? 'ANALYSIS' : 'BUILD'} COMPLETE`);
    console.log(`${'='.repeat(80)}`);
    console.log(`RepRally Customers:     ${stats.repRallyCustomersCreated}`);
    console.log(`RepRally Orders:        ${stats.repRallyOrdersFound}`);
    if (!dryRun) {
      console.log(`Orders Written:         ${stats.ordersWritten}`);
      console.log(`Line Items Written:     ${stats.itemsWritten}`);
    }
    console.log(`Direct Orders Skipped:  ${stats.skipped}`);
    console.log(`${'='.repeat(80)}\n`);
    
    return NextResponse.json({
      success: true,
      dryRun,
      stats,
      message: dryRun 
        ? `Found ${stats.repRallyCustomersCreated} RepRally customers with ${stats.repRallyOrdersFound} orders` 
        : `Created reprally_customers collection with ${stats.repRallyCustomersCreated} customers`
    });
    
  } catch (error: any) {
    console.error('❌ RepRally collection build error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

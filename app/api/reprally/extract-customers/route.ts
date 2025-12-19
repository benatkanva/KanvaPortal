import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Extract individual RepRally customers from the generic "Shopify Customer (22)" orders
 * Uses billing data from line items to identify unique end customers
 */
export async function POST(request: NextRequest) {
  try {
    const { dryRun = true } = await request.json();
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🛍️ EXTRACTING REPRALLY CUSTOMERS ${dryRun ? '(DRY RUN)' : '(LIVE MODE)'}`);
    console.log(`${'='.repeat(80)}\n`);
    
    const stats = {
      totalItems: 0,
      repRallyItems: 0,
      uniqueCustomersFound: 0,
      uniqueOrders: 0,
      customersCreated: 0,
      ordersAssigned: 0,
      itemsAssigned: 0
    };
    
    // Step 1: Scan all line items and identify RepRally orders by order number pattern
    console.log('📦 Loading all line items...');
    const allItemsSnap = await adminDb
      .collection('fishbowl_soitems')
      .get();
    
    console.log(`   Loaded ${allItemsSnap.size} line items`);
    stats.totalItems = allItemsSnap.size;
    
    // Step 2: Filter for RepRally orders (order number starts with # and has 13+ characters after #)
    console.log('📦 Identifying RepRally orders by order number pattern (#XXXXXXXXXXXXX)...');
    const repRallyItems: any[] = [];
    
    for (const doc of allItemsSnap.docs) {
      const item = doc.data();
      const orderNum = String(item.salesOrderNum || '').trim();
      
      // RepRally order pattern: starts with # and has 13+ characters after #
      if (orderNum.startsWith('#') && orderNum.length >= 14) {
        repRallyItems.push({
          ...item,
          docId: doc.id
        });
      }
    }
    
    console.log(`   Found ${repRallyItems.length} RepRally line items\n`);
    stats.repRallyItems = repRallyItems.length;
    
    // Debug: Show sample of first 5 RepRally items to see what billing data exists
    console.log('📋 Sample RepRally items from Firestore (first 5):');
    for (let i = 0; i < Math.min(5, repRallyItems.length); i++) {
      const item = repRallyItems[i];
      console.log(`   ${i + 1}. Order: ${item.salesOrderNum}`);
      console.log(`      customerName: "${item.customerName || '(empty)'}"`);
      console.log(`      billingName: "${item.billingName || '(empty)'}"`);
      console.log(`      billingAddress: "${item.billingAddress || '(empty)'}"`);
      console.log(`      billingCity: "${item.billingCity || '(empty)'}"`);
      console.log(`      billingState: "${item.billingState || '(empty)'}"`);
      console.log(`      billingZip: "${item.billingZip || '(empty)'}"`);
      console.log(`      ALL FIELDS: ${Object.keys(item).filter(k => k.toLowerCase().includes('billing')).join(', ')}`);
      console.log('');
    }
    
    // Step 3: Extract unique customers from billing data
    console.log('🔍 Extracting unique customers from billing data...');
    
    interface CustomerData {
      businessName: string;
      billingAddress: string;
      billingCity: string;
      billingState: string;
      billingZip: string;
      orders: Set<string>;
      totalRevenue: number;
      lineItems: any[];
    }
    
    const customersByBillingKey = new Map<string, CustomerData>();
    const uniqueOrders = new Set<string>();
    
    // Extract customers from RepRally line items
    for (const item of repRallyItems) {
      
      // Extract billing info - try multiple field variations
      const billingName = String(
        item.billingName || 
        item.billToName || 
        item.customerName ||
        ''
      ).trim();
      
      const billingAddress = String(
        item.billingAddress || 
        item.billToAddress ||
        item.billingStreet ||
        ''
      ).trim();
      
      const billingCity = String(
        item.billingCity ||
        item.billToCity ||
        item.shippingCity ||
        ''
      ).trim();
      
      const billingState = String(
        item.billingState ||
        item.billToState ||
        item.shippingState ||
        ''
      ).trim();
      
      const billingZip = String(
        item.billingZip ||
        item.billToZip ||
        item.billingPostalCode ||
        ''
      ).trim();
      
      // Skip if no useful billing data
      if (!billingName && !billingCity && !billingState) {
        continue;
      }
      
      // Create unique key from billing data (name + address + city for uniqueness)
      const billingKey = `${billingName}|${billingAddress}|${billingCity}|${billingState}|${billingZip}`.toLowerCase();
      
      if (!customersByBillingKey.has(billingKey)) {
        // Create descriptive name from location if business name is missing
        const displayName = billingName || 
          (billingCity && billingState ? `RepRally Customer - ${billingCity}, ${billingState}` : 'Unknown RepRally Customer');
        
        customersByBillingKey.set(billingKey, {
          businessName: displayName,
          billingAddress,
          billingCity,
          billingState,
          billingZip,
          orders: new Set(),
          totalRevenue: 0,
          lineItems: []
        });
      }
      
      const customer = customersByBillingKey.get(billingKey)!;
      const orderNum = String(item.salesOrderNum || '');
      
      if (orderNum) {
        customer.orders.add(orderNum);
      }
      
      customer.totalRevenue += parseFloat(item.revenue || item.totalPrice || 0);
      customer.lineItems.push(item);
      
      if (orderNum) {
        uniqueOrders.add(orderNum);
      }
    }
    
    stats.uniqueOrders = uniqueOrders.size;
    
    console.log(`   ✅ Extracted ${customersByBillingKey.size} unique customers\n`);
    stats.uniqueCustomersFound = customersByBillingKey.size;
    
    // Step 4: Show top customers by revenue
    console.log('📊 Top 20 RepRally Customers by Revenue:');
    const topCustomers = Array.from(customersByBillingKey.values())
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 20);
    
    for (let i = 0; i < topCustomers.length; i++) {
      const customer = topCustomers[i];
      console.log(`   ${i + 1}. ${customer.businessName}`);
      console.log(`      ${customer.billingAddress}, ${customer.billingCity}, ${customer.billingState} ${customer.billingZip}`);
      console.log(`      ${customer.orders.size} orders | $${customer.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 2 })} lifetime value`);
      console.log('');
    }
    
    // Step 5: Build reprally_customers collection
    if (!dryRun) {
      console.log('🔴 LIVE MODE - Creating reprally_customers collection...\n');
      
      let batch = adminDb.batch();
      let batchCount = 0;
      let customerIndex = 0;
      
      for (const [billingKey, customerData] of customersByBillingKey.entries()) {
        customerIndex++;
        
        // Create customer document ID from billing key hash
        const customerId = `rr_${Buffer.from(billingKey).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 20)}_${customerIndex}`;
        const customerRef = adminDb.collection('reprally_customers').doc(customerId);
        
        // Get order dates from line items
        const orderDates = customerData.lineItems
          .map(item => item.postingDate?.toDate?.())
          .filter(Boolean)
          .sort((a: Date, b: Date) => a.getTime() - b.getTime());
        
        const firstOrderDate = orderDates.length > 0 ? Timestamp.fromDate(orderDates[0]) : null;
        const lastOrderDate = orderDates.length > 0 ? Timestamp.fromDate(orderDates[orderDates.length - 1]) : null;
        
        // Create customer document
        const customerDoc = {
          customerId,
          businessName: customerData.businessName,
          billingAddress: customerData.billingAddress,
          billingCity: customerData.billingCity,
          billingState: customerData.billingState,
          billingZip: customerData.billingZip,
          
          // RepRally stats
          totalOrders: customerData.orders.size,
          lifetimeValue: customerData.totalRevenue,
          firstOrderDate,
          lastOrderDate,
          
          // Metadata
          source: 'reprally_extractor',
          extractedFrom: 'order_number_pattern',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        };
        
        batch.set(customerRef, customerDoc);
        batchCount++;
        stats.customersCreated++;
        
        // Commit batch if needed
        if (batchCount >= 400) {
          await batch.commit();
          console.log(`   ✅ Committed batch of ${batchCount} operations`);
          batch = adminDb.batch();
          batchCount = 0;
        }
        
        // Add line items grouped by order to subcollections
        const itemsByOrder = new Map<string, any[]>();
        for (const item of customerData.lineItems) {
          const orderNum = String(item.salesOrderNum || '');
          if (!orderNum) continue;
          
          if (!itemsByOrder.has(orderNum)) {
            itemsByOrder.set(orderNum, []);
          }
          itemsByOrder.get(orderNum)!.push(item);
        }
        
        // Create order documents with line items as subcollection
        for (const [orderNum, items] of itemsByOrder.entries()) {
          const orderRef = customerRef.collection('sales_orders').doc(orderNum);
          
          // Calculate order total
          const orderTotal = items.reduce((sum, item) => sum + parseFloat(item.revenue || item.totalPrice || 0), 0);
          const orderDate = items[0]?.postingDate;
          
          batch.set(orderRef, {
            orderNumber: orderNum,
            customerId,
            businessName: customerData.businessName,
            postingDate: orderDate,
            orderTotal,
            lineItemCount: items.length,
            writtenAt: Timestamp.now()
          });
          batchCount++;
          stats.ordersAssigned++;
          
          // Commit batch if needed
          if (batchCount >= 400) {
            await batch.commit();
            console.log(`   ✅ Committed batch of ${batchCount} operations`);
            batch = adminDb.batch();
            batchCount = 0;
          }
          
          // Add line items
          for (const item of items) {
            const itemId = String(item.lineItemId || item.id || item.docId);
            if (!itemId) continue;
            
            const itemRef = orderRef.collection('line_items').doc(itemId);
            batch.set(itemRef, {
              ...item,
              repRallyCustomerId: customerId,
              businessName: customerData.businessName,
              writtenAt: Timestamp.now()
            });
            batchCount++;
            stats.itemsAssigned++;
            
            // Commit batch if needed
            if (batchCount >= 400) {
              await batch.commit();
              console.log(`   ✅ Committed batch of ${batchCount} operations`);
              batch = adminDb.batch();
              batchCount = 0;
            }
          }
        }
        
        // Progress update
        if (customerIndex % 50 === 0) {
          console.log(`   📊 Progress: ${customerIndex}/${customersByBillingKey.size} customers processed`);
        }
      }
      
      // Commit final batch
      if (batchCount > 0) {
        await batch.commit();
        console.log(`   ✅ Committed final batch of ${batchCount} operations\n`);
      }
    }
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`✅ REPRALLY CUSTOMER EXTRACTION ${dryRun ? 'ANALYSIS' : 'COMPLETE'}`);
    console.log(`${'='.repeat(80)}`);
    console.log(`Total Line Items Scanned:  ${stats.totalItems.toLocaleString()}`);
    console.log(`RepRally Items Found:      ${stats.repRallyItems.toLocaleString()}`);
    console.log(`Unique Orders:             ${stats.uniqueOrders}`);
    console.log(`Unique Customers Found:    ${stats.uniqueCustomersFound}`);
    if (!dryRun) {
      console.log(`Customers Created:         ${stats.customersCreated}`);
      console.log(`Orders Assigned:           ${stats.ordersAssigned}`);
      console.log(`Line Items Assigned:       ${stats.itemsAssigned}`);
    }
    console.log(`${'='.repeat(80)}\n`);
    
    // Generate CSV export for validation
    const allCustomers = Array.from(customersByBillingKey.values())
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
    
    const csvRows = [
      ['Business Name', 'Billing Address', 'City', 'State', 'Zip', 'Order Count', 'Lifetime Value', 'Sample Order Numbers'].join(',')
    ];
    
    for (const customer of allCustomers) {
      const sampleOrders = Array.from(customer.orders).slice(0, 3).join('; ');
      csvRows.push([
        `"${customer.businessName}"`,
        `"${customer.billingAddress}"`,
        `"${customer.billingCity}"`,
        `"${customer.billingState}"`,
        `"${customer.billingZip}"`,
        customer.orders.size,
        customer.totalRevenue.toFixed(2),
        `"${sampleOrders}"`
      ].join(','));
    }
    
    const csvContent = csvRows.join('\n');
    
    return NextResponse.json({
      success: true,
      dryRun,
      stats,
      topCustomers: topCustomers.map(c => ({
        businessName: c.businessName,
        city: c.billingCity,
        state: c.billingState,
        orderCount: c.orders.size,
        lifetimeValue: c.totalRevenue
      })),
      csvExport: csvContent,
      message: dryRun 
        ? `Found ${stats.uniqueCustomersFound} unique RepRally customers in ${stats.uniqueOrders} orders` 
        : `Created ${stats.customersCreated} RepRally customer records with ${stats.ordersAssigned} orders`
    });
    
  } catch (error: any) {
    console.error('❌ RepRally extraction error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

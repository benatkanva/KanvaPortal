import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

/**
 * Fix accountType inconsistency in orders and line items
 * 
 * Strategy:
 * 1. Load all customers (source of truth for accountType)
 * 2. Update all orders to match their customer's accountType
 * 3. Update all line items to match their customer's accountType
 * 
 * This is faster than re-importing all Fishbowl data.
 */
export async function POST() {
  try {
    console.log('🔧 Fixing accountType inconsistency...\n');

    // STEP 1: Load all customers (source of truth)
    console.log('📂 Loading customers...');
    const customersSnap = await adminDb.collection('fishbowl_customers').get();
    
    const customerMap = new Map<string, { accountType: string; accountTypeSource: string }>();
    customersSnap.forEach(doc => {
      const data = doc.data();
      customerMap.set(doc.id, {
        accountType: data.accountType || 'Retail',
        accountTypeSource: data.accountTypeSource || 'existing',
      });
    });
    
    console.log(`✅ Loaded ${customerMap.size} customers\n`);

    const stats = {
      ordersChecked: 0,
      ordersUpdated: 0,
      ordersAlreadyCorrect: 0,
      itemsChecked: 0,
      itemsUpdated: 0,
      itemsAlreadyCorrect: 0,
    };

    // STEP 2: Fix orders
    console.log('🔄 Fixing orders...');
    const ordersSnap = await adminDb.collection('fishbowl_sales_orders').get();
    
    let orderBatch = adminDb.batch();
    let orderBatchCount = 0;
    const MAX_BATCH = 450;

    for (const doc of ordersSnap.docs) {
      stats.ordersChecked++;
      const orderData = doc.data();
      const customerId = orderData.customerId;
      
      const customer = customerMap.get(customerId);
      if (!customer) {
        // Customer not found - can't fix this order
        continue;
      }

      // Check if update needed
      if (orderData.accountType === customer.accountType && 
          orderData.accountTypeSource === customer.accountTypeSource) {
        stats.ordersAlreadyCorrect++;
        continue;
      }

      // Update needed
      orderBatch.update(doc.ref, {
        accountType: customer.accountType,
        accountTypeSource: customer.accountTypeSource,
        updatedAt: new Date(),
      });
      orderBatchCount++;
      stats.ordersUpdated++;

      // Commit batch if full
      if (orderBatchCount >= MAX_BATCH) {
        await orderBatch.commit();
        console.log(`   ✅ Committed batch of ${orderBatchCount} order updates`);
        orderBatch = adminDb.batch();
        orderBatchCount = 0;
      }

      // Log progress
      if (stats.ordersChecked % 500 === 0) {
        console.log(`   📊 Progress: ${stats.ordersChecked} checked, ${stats.ordersUpdated} updated`);
      }
    }

    // Final commit for orders
    if (orderBatchCount > 0) {
      await orderBatch.commit();
      console.log(`   ✅ Committed final batch of ${orderBatchCount} order updates`);
    }

    console.log(`\n✅ Orders fixed: ${stats.ordersUpdated} updated, ${stats.ordersAlreadyCorrect} already correct\n`);

    // STEP 3: Fix line items
    console.log('🔄 Fixing line items...');
    const itemsSnap = await adminDb.collection('fishbowl_soitems').get();
    
    let itemBatch = adminDb.batch();
    let itemBatchCount = 0;

    for (const doc of itemsSnap.docs) {
      stats.itemsChecked++;
      const itemData = doc.data();
      const customerId = itemData.customerId;
      
      const customer = customerMap.get(customerId);
      if (!customer) {
        // Customer not found - can't fix this item
        continue;
      }

      // Check if update needed
      if (itemData.accountType === customer.accountType && 
          itemData.accountTypeSource === customer.accountTypeSource) {
        stats.itemsAlreadyCorrect++;
        continue;
      }

      // Update needed
      itemBatch.update(doc.ref, {
        accountType: customer.accountType,
        accountTypeSource: customer.accountTypeSource,
        updatedAt: new Date(),
      });
      itemBatchCount++;
      stats.itemsUpdated++;

      // Commit batch if full
      if (itemBatchCount >= MAX_BATCH) {
        await itemBatch.commit();
        console.log(`   ✅ Committed batch of ${itemBatchCount} item updates`);
        itemBatch = adminDb.batch();
        itemBatchCount = 0;
      }

      // Log progress
      if (stats.itemsChecked % 1000 === 0) {
        console.log(`   📊 Progress: ${stats.itemsChecked} checked, ${stats.itemsUpdated} updated`);
      }
    }

    // Final commit for items
    if (itemBatchCount > 0) {
      await itemBatch.commit();
      console.log(`   ✅ Committed final batch of ${itemBatchCount} item updates`);
    }

    console.log(`\n✅ Line items fixed: ${stats.itemsUpdated} updated, ${stats.itemsAlreadyCorrect} already correct\n`);

    // SUMMARY
    console.log('\n' + '='.repeat(60));
    console.log('📊 FIX COMPLETE');
    console.log('='.repeat(60));
    console.log(`Orders:      ${stats.ordersUpdated.toLocaleString()} updated / ${stats.ordersChecked.toLocaleString()} total`);
    console.log(`Line Items:  ${stats.itemsUpdated.toLocaleString()} updated / ${stats.itemsChecked.toLocaleString()} total`);
    console.log('='.repeat(60) + '\n');

    return NextResponse.json({
      success: true,
      message: 'Fixed accountType inconsistencies',
      stats,
    });

  } catch (error: any) {
    console.error('❌ Fix error:', error);
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}

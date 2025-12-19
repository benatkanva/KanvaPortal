import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export const maxDuration = 300; // 5 minutes

/**
 * DELETE Fishbowl Data - Clean Slate for Fresh Import
 * 
 * DELETES:
 * - fishbowl_sales_orders (all orders)
 * - fishbowl_soitems (all line items)
 * - monthly_commissions (will be recalculated)
 * - Customer order history subcollections
 * 
 * KEEPS:
 * - fishbowl_customers (preserves accountType from Copper)
 * - copper_companies (Copper data)
 * - reps (user data)
 * - commission_rates (rate configs)
 * 
 * SAFETY: Requires ?confirm=DELETE_ALL_FISHBOWL_DATA query parameter
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const confirm = searchParams.get('confirm');
    
    // SAFETY CHECK: Require explicit confirmation
    if (confirm !== 'DELETE_ALL_FISHBOWL_DATA') {
      return NextResponse.json({
        error: 'Confirmation required',
        message: 'Add query parameter: ?confirm=DELETE_ALL_FISHBOWL_DATA',
        warning: 'This will delete ALL orders, line items, and commissions. Customers will be preserved.',
      }, { status: 400 });
    }

    console.log('\n' + '='.repeat(80));
    console.log('🗑️  DELETING FISHBOWL DATA - CLEAN SLATE MODE');
    console.log('='.repeat(80) + '\n');

    const stats = {
      ordersDeleted: 0,
      itemsDeleted: 0,
      commissionsDeleted: 0,
      customerSubcollectionsDeleted: 0,
      errors: 0,
    };

    // === 1. DELETE SALES ORDERS ===
    console.log('🗑️  Step 1: Deleting fishbowl_sales_orders...');
    const ordersSnapshot = await adminDb.collection('fishbowl_sales_orders').get();
    stats.ordersDeleted = ordersSnapshot.size;
    
    if (ordersSnapshot.size > 0) {
      console.log(`   Found ${ordersSnapshot.size} orders to delete`);
      await deleteBatch('fishbowl_sales_orders', ordersSnapshot.docs);
      console.log(`   ✅ Deleted ${ordersSnapshot.size} orders\n`);
    } else {
      console.log('   ℹ️  No orders found\n');
    }

    // === 2. DELETE LINE ITEMS ===
    console.log('🗑️  Step 2: Deleting fishbowl_soitems...');
    const itemsSnapshot = await adminDb.collection('fishbowl_soitems').get();
    stats.itemsDeleted = itemsSnapshot.size;
    
    if (itemsSnapshot.size > 0) {
      console.log(`   Found ${itemsSnapshot.size} line items to delete`);
      await deleteBatch('fishbowl_soitems', itemsSnapshot.docs);
      console.log(`   ✅ Deleted ${itemsSnapshot.size} line items\n`);
    } else {
      console.log('   ℹ️  No line items found\n');
    }

    // === 3. DELETE MONTHLY COMMISSIONS ===
    console.log('🗑️  Step 3: Deleting monthly_commissions...');
    const commissionsSnapshot = await adminDb.collection('monthly_commissions').get();
    stats.commissionsDeleted = commissionsSnapshot.size;
    
    if (commissionsSnapshot.size > 0) {
      console.log(`   Found ${commissionsSnapshot.size} commission records to delete`);
      await deleteBatch('monthly_commissions', commissionsSnapshot.docs);
      console.log(`   ✅ Deleted ${commissionsSnapshot.size} commission records\n`);
    } else {
      console.log('   ℹ️  No commission records found\n');
    }

    // === 4. DELETE CUSTOMER ORDER HISTORY SUBCOLLECTIONS ===
    console.log('🗑️  Step 4: Deleting customer order history subcollections...');
    const customersSnapshot = await adminDb.collection('fishbowl_customers').get();
    
    let subcollectionCount = 0;
    for (const customerDoc of customersSnapshot.docs) {
      const historySnapshot = await customerDoc.ref.collection('sales_order_history').get();
      
      if (historySnapshot.size > 0) {
        await deleteBatch(`fishbowl_customers/${customerDoc.id}/sales_order_history`, historySnapshot.docs);
        subcollectionCount += historySnapshot.size;
        
        // Also clear customer summary fields
        await customerDoc.ref.update({
          totalOrders: 0,
          firstOrderDate: null,
          lastOrderDate: null,
          firstSalesPerson: null,
          lastSalesPerson: null,
          // Keep: accountType, originalOwner, transferStatus (commission-critical)
        });
      }
    }
    
    stats.customerSubcollectionsDeleted = subcollectionCount;
    console.log(`   ✅ Deleted ${subcollectionCount} customer order history records\n`);
    console.log(`   ✅ Reset customer summary fields for ${customersSnapshot.size} customers\n`);

    // === 5. DELETE COMMISSION SUMMARIES ===
    console.log('🗑️  Step 5: Deleting monthly_commission_summary...');
    const summarySnapshot = await adminDb.collection('monthly_commission_summary').get();
    
    if (summarySnapshot.size > 0) {
      console.log(`   Found ${summarySnapshot.size} summary records to delete`);
      await deleteBatch('monthly_commission_summary', summarySnapshot.docs);
      console.log(`   ✅ Deleted ${summarySnapshot.size} summary records\n`);
    } else {
      console.log('   ℹ️  No summary records found\n');
    }

    // === SUMMARY ===
    console.log('\n' + '='.repeat(80));
    console.log('✅ DELETION COMPLETE - DATABASE CLEAN');
    console.log('='.repeat(80));
    console.log(`Sales Orders:              ${stats.ordersDeleted.toLocaleString()} deleted`);
    console.log(`Line Items:                ${stats.itemsDeleted.toLocaleString()} deleted`);
    console.log(`Commission Records:        ${stats.commissionsDeleted.toLocaleString()} deleted`);
    console.log(`Customer Order Histories:  ${stats.customerSubcollectionsDeleted.toLocaleString()} deleted`);
    console.log('');
    console.log('✅ PRESERVED:');
    console.log('   - fishbowl_customers (with accountType from Copper)');
    console.log('   - copper_companies');
    console.log('   - reps (users)');
    console.log('   - commission_rates');
    console.log('='.repeat(80) + '\n');

    console.log('📋 NEXT STEPS:');
    console.log('1. Upload Fishbowl CSV via Settings → Step 1 (Fishbowl Import)');
    console.log('2. Run Copper Sync if needed → Step 0 (updates accountType)');
    console.log('3. Calculate commissions → Settings → Calculate Commissions');
    console.log('4. Verify with /api/verify-account-types\n');

    return NextResponse.json({
      success: true,
      message: 'Fishbowl data deleted successfully',
      stats,
      nextSteps: [
        'Upload Fishbowl CSV (Step 1)',
        'Run Copper Sync if needed (Step 0)',
        'Calculate Commissions',
        'Verify with /api/verify-account-types'
      ],
    });

  } catch (error: any) {
    console.error('❌ Deletion error:', error);
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}

/**
 * Helper: Delete documents in batches of 450
 */
async function deleteBatch(collectionPath: string, docs: any[]) {
  const BATCH_SIZE = 450;
  let batch = adminDb.batch();
  let batchCount = 0;
  let totalDeleted = 0;

  for (const doc of docs) {
    batch.delete(doc.ref);
    batchCount++;
    totalDeleted++;

    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      console.log(`   💾 Batch committed: ${totalDeleted}/${docs.length} deleted`);
      batch = adminDb.batch();
      batchCount = 0;
    }
  }

  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
    console.log(`   💾 Final batch committed: ${totalDeleted}/${docs.length} deleted`);
  }
}

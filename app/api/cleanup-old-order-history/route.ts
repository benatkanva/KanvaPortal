/**
 * API Route: Cleanup Old Order History Documents
 * 
 * Deletes subcollection documents with IDs > 9999 (internal Fishbowl IDs)
 * Keeps documents with IDs <= 9999 (actual sales order numbers)
 * 
 * POST /api/cleanup-old-order-history
 * Body: { dryRun?: boolean }
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export const maxDuration = 300; // 5 minutes

interface CleanupStats {
  customersProcessed: number;
  documentsDeleted: number;
  documentsKept: number;
  errors: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const dryRun = body.dryRun ?? false;
    
    console.log(`\n🧹 Starting cleanup of old order history documents (${dryRun ? 'DRY RUN' : 'LIVE'})...`);
    console.log('   Target: Delete documents with ID > 9999 (old internal IDs)');
    console.log('   Keep: Documents with ID <= 9999 (sales order numbers)\n');
    
    const stats: CleanupStats = {
      customersProcessed: 0,
      documentsDeleted: 0,
      documentsKept: 0,
      errors: 0
    };
    
    // Get all customers
    console.log('📥 Loading customers...');
    const customersSnapshot = await adminDb.collection('fishbowl_customers').get();
    console.log(`   Found ${customersSnapshot.size} customers\n`);
    
    const MAX_BATCH_SIZE = 400;
    let batch = adminDb.batch();
    let batchCount = 0;
    
    // Process each customer
    for (const customerDoc of customersSnapshot.docs) {
      stats.customersProcessed++;
      const customerId = customerDoc.id;
      
      // Get order history subcollection
      const orderHistorySnapshot = await adminDb
        .collection('fishbowl_customers')
        .doc(customerId)
        .collection('sales_order_history')
        .get();
      
      if (orderHistorySnapshot.empty) continue;
      
      let customerDeleted = 0;
      let customerKept = 0;
      
      // Check each document
      for (const orderDoc of orderHistorySnapshot.docs) {
        const docId = orderDoc.id;
        
        // Check if ID is numeric and > 9999
        const numericId = parseInt(docId, 10);
        
        if (!isNaN(numericId) && numericId > 9999) {
          // OLD INTERNAL ID - DELETE
          if (!dryRun) {
            batch.delete(orderDoc.ref);
            batchCount++;
          }
          stats.documentsDeleted++;
          customerDeleted++;
          
          // Commit batch if needed
          if (batchCount >= MAX_BATCH_SIZE && !dryRun) {
            await batch.commit();
            console.log(`   ✅ Committed batch (${stats.documentsDeleted} deleted so far)`);
            batch = adminDb.batch();
            batchCount = 0;
          }
        } else {
          // SALES ORDER NUMBER - KEEP
          stats.documentsKept++;
          customerKept++;
        }
      }
      
      // Log customer summary if any deletions
      if (customerDeleted > 0) {
        const customerName = customerDoc.data().name || customerDoc.data().customerName || customerId;
        console.log(`   🧹 Customer ${customerId} (${customerName}): Deleted ${customerDeleted}, Kept ${customerKept}`);
      }
      
      // Progress update every 100 customers
      if (stats.customersProcessed % 100 === 0) {
        console.log(`\n📊 Progress: ${stats.customersProcessed}/${customersSnapshot.size} customers | Deleted: ${stats.documentsDeleted} | Kept: ${stats.documentsKept}\n`);
      }
    }
    
    // Final batch commit
    if (batchCount > 0 && !dryRun) {
      await batch.commit();
      console.log(`   ✅ Committed final batch`);
    }
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log(dryRun ? '✅ DRY RUN COMPLETE!' : '✅ CLEANUP COMPLETE!');
    console.log('='.repeat(80));
    console.log(`   Customers Processed:  ${stats.customersProcessed.toLocaleString()}`);
    console.log(`   Documents Deleted:    ${stats.documentsDeleted.toLocaleString()} (IDs > 9999)`);
    console.log(`   Documents Kept:       ${stats.documentsKept.toLocaleString()} (IDs <= 9999)`);
    console.log(`   Errors:               ${stats.errors}`);
    console.log('='.repeat(80));
    
    if (dryRun) {
      console.log('\n💡 This was a DRY RUN - no documents were actually deleted.');
      console.log('   Set dryRun: false to perform the actual cleanup.\n');
    }
    
    return NextResponse.json({
      success: true,
      stats,
      dryRun,
      message: dryRun 
        ? `Dry run complete - would delete ${stats.documentsDeleted} old documents`
        : `Deleted ${stats.documentsDeleted} old documents, kept ${stats.documentsKept} sales order documents`
    });
    
  } catch (error: any) {
    console.error('❌ Cleanup error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

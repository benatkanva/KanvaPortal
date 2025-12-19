/**
 * API Route: Cleanup Generic Customer IDs
 * 
 * Deletes customer documents with auto-generated Firebase IDs (not Fishbowl numeric IDs)
 * These were incorrectly created by Copper sync before we fixed it.
 * 
 * Valid customer IDs: Numeric Fishbowl IDs like "995", "996", "1076", etc.
 * Invalid (to delete): Auto-generated Firebase IDs like "9npIof0VFYfLXJBZ1Ng9", "B71NaANqZAxXKLqunu"
 * 
 * POST /api/cleanup-generic-customer-ids
 * Body: { dryRun?: boolean }
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export const maxDuration = 300; // 5 minutes

interface CleanupStats {
  totalCustomers: number;
  validIds: number;
  genericIdsDeleted: number;
  errors: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const dryRun = body.dryRun ?? true; // Default to dry run for safety
    
    console.log(`\n🧹 Starting cleanup of generic customer IDs (${dryRun ? 'DRY RUN' : 'LIVE'})...`);
    console.log('   Target: Delete customers with auto-generated Firebase IDs');
    console.log('   Keep: Customers with numeric Fishbowl IDs (e.g., 995, 1076, 1947)\n');
    
    const stats: CleanupStats = {
      totalCustomers: 0,
      validIds: 0,
      genericIdsDeleted: 0,
      errors: 0
    };
    
    // Get all customers
    console.log('📥 Loading all customers...');
    const customersSnapshot = await adminDb.collection('fishbowl_customers').get();
    stats.totalCustomers = customersSnapshot.size;
    console.log(`   Found ${stats.totalCustomers} customers\n`);
    
    const MAX_BATCH_SIZE = 400;
    let batch = adminDb.batch();
    let batchCount = 0;
    
    const validIdPattern = /^\d+$/; // Only digits (Fishbowl IDs)
    const customersToDelete: string[] = [];
    
    // Identify customers with generic IDs
    for (const doc of customersSnapshot.docs) {
      const customerId = doc.id;
      const data = doc.data();
      
      // Check if ID is numeric (valid Fishbowl ID)
      if (validIdPattern.test(customerId)) {
        // Valid numeric ID - keep it
        stats.validIds++;
      } else {
        // Generic Firebase ID - mark for deletion
        customersToDelete.push(customerId);
        stats.genericIdsDeleted++;
        
        // Log first 20 for review
        if (stats.genericIdsDeleted <= 20) {
          const name = data.name || data.customerName || 'Unknown';
          const accountNum = data.accountNumber || 'N/A';
          const copperId = data.copperId || 'N/A';
          console.log(`   🗑️  DELETE: ${customerId} | ${name} | AcctNum: ${accountNum} | Copper: ${copperId}`);
        }
        
        if (!dryRun) {
          batch.delete(doc.ref);
          batchCount++;
          
          // Commit batch if needed
          if (batchCount >= MAX_BATCH_SIZE) {
            await batch.commit();
            console.log(`   ✅ Committed batch (${stats.genericIdsDeleted} deleted so far)`);
            batch = adminDb.batch();
            batchCount = 0;
          }
        }
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
    console.log(`   Total Customers:       ${stats.totalCustomers.toLocaleString()}`);
    console.log(`   Valid Fishbowl IDs:    ${stats.validIds.toLocaleString()} (kept)`);
    console.log(`   Generic Firebase IDs:  ${stats.genericIdsDeleted.toLocaleString()} (${dryRun ? 'would delete' : 'deleted'})`);
    console.log(`   Errors:                ${stats.errors}`);
    console.log('='.repeat(80));
    
    if (dryRun) {
      console.log('\n💡 This was a DRY RUN - no customers were actually deleted.');
      console.log('   Review the list above and set dryRun: false to perform the actual cleanup.\n');
      console.log('\n📋 CUSTOMERS THAT WOULD BE DELETED:');
      if (customersToDelete.length <= 50) {
        customersToDelete.forEach(id => console.log(`   - ${id}`));
      } else {
        console.log(`   (${customersToDelete.length} total - showing first 20 above)`);
      }
    }
    
    return NextResponse.json({
      success: true,
      stats,
      dryRun,
      customersToDelete: dryRun ? customersToDelete : undefined,
      message: dryRun 
        ? `Dry run complete - would delete ${stats.genericIdsDeleted} customers with generic IDs`
        : `Deleted ${stats.genericIdsDeleted} customers with generic IDs`
    });
    
  } catch (error: any) {
    console.error('❌ Cleanup error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

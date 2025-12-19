import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Backfill updatedAt timestamps for existing documents
 */
export async function POST() {
  try {
    console.log('🔄 Starting timestamp backfill...');
    
    const collectionRef = adminDb.collection('copper_companies');
    
    // Get all docs that have importedAt but no updatedAt
    const snapshot = await collectionRef
      .where('importedAt', '!=', null)
      .get();
    
    console.log(`📊 Found ${snapshot.size} documents to update`);
    
    let batch = adminDb.batch();
    let batchCount = 0;
    let updated = 0;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      // Only update if updatedAt is missing
      if (!data.updatedAt && data.importedAt) {
        batch.update(doc.ref, {
          updatedAt: data.importedAt // Use importedAt as updatedAt
        });
        batchCount++;
        updated++;
        
        // Commit in batches of 500
        if (batchCount >= 500) {
          await batch.commit();
          console.log(`✅ Updated ${updated} documents...`);
          batch = adminDb.batch();
          batchCount = 0;
        }
      }
    }
    
    // Commit remaining
    if (batchCount > 0) {
      await batch.commit();
    }
    
    console.log(`✅ Backfill complete! Updated ${updated} documents`);
    
    return NextResponse.json({
      success: true,
      updated,
      message: `Updated ${updated} documents with updatedAt timestamps`
    });
    
  } catch (error: any) {
    console.error('❌ Backfill error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

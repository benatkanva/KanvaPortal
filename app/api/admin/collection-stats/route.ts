import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Get statistics for all collections
 * Shows: total docs, last updated, sample data
 */
export async function GET() {
  try {
    const stats: any = {};

    // Collections to check
    const collections = [
      'copper_companies',
      'fishbowl_customers',
      'fishbowl_sales_orders',
      'fishbowl_soitems'
    ];

    for (const collectionName of collections) {
      console.log(`📊 Checking ${collectionName}...`);
      
      const collectionRef = adminDb.collection(collectionName);
      
      // Get total count (expensive but necessary)
      const snapshot = await collectionRef.count().get();
      const totalDocs = snapshot.data().count;
      
      // Get most recent document (try multiple timestamp fields)
      let recentDocs;
      try {
        recentDocs = await collectionRef
          .orderBy('updatedAt', 'desc')
          .limit(1)
          .get();
      } catch (e) {
        try {
          recentDocs = await collectionRef
            .orderBy('importedAt', 'desc')
            .limit(1)
            .get();
        } catch (e2) {
          try {
            recentDocs = await collectionRef
              .orderBy('createdAt', 'desc')
              .limit(1)
              .get();
          } catch (e3) {
            // No timestamp field indexed, just get any doc
            recentDocs = await collectionRef.limit(1).get();
          }
        }
      }
      
      let lastUpdated = null;
      let sampleDoc = null;
      
      if (!recentDocs.empty) {
        const doc = recentDocs.docs[0];
        const data = doc.data();
        lastUpdated = data.updatedAt?.toDate?.() || data.importedAt?.toDate?.() || data.createdAt?.toDate?.() || null;
        sampleDoc = {
          id: doc.id,
          ...data
        };
      }
      
      stats[collectionName] = {
        totalDocs,
        lastUpdated,
        sampleDoc: sampleDoc ? {
          id: sampleDoc.id,
          name: (sampleDoc as any).name || (sampleDoc as any).customerName || (sampleDoc as any).num || 'N/A',
          updatedAt: lastUpdated
        } : null
      };
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      stats
    });

  } catch (error: any) {
    console.error('❌ Stats error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

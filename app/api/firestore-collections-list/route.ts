import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * List all Firestore collections in the database
 * This is the first step for building a visual schema mapper
 */
export async function GET(request: NextRequest) {
  try {
    console.log('📋 Fetching all Firestore collections...');

    // Get all collections
    const collections = await adminDb.listCollections();
    
    const collectionList = collections.map(col => ({
      id: col.id,
      path: col.path,
    }));

    // Get document counts for each collection (sample first 1000)
    const collectionStats = await Promise.all(
      collectionList.map(async (col) => {
        try {
          const snapshot = await adminDb.collection(col.id).limit(1).get();
          const hasDocuments = !snapshot.empty;
          
          // Get approximate count (first 1000 docs)
          const countSnapshot = await adminDb.collection(col.id).limit(1000).get();
          const approximateCount = countSnapshot.size;
          
          return {
            ...col,
            hasDocuments,
            approximateCount,
            countNote: approximateCount >= 1000 ? '1000+' : String(approximateCount),
          };
        } catch (err) {
          console.error(`Error getting stats for ${col.id}:`, err);
          return {
            ...col,
            hasDocuments: false,
            approximateCount: 0,
            countNote: 'Error',
          };
        }
      })
    );

    // Sort by name
    collectionStats.sort((a, b) => a.id.localeCompare(b.id));

    console.log(`✅ Found ${collectionStats.length} collections`);

    return NextResponse.json({
      success: true,
      totalCollections: collectionStats.length,
      collections: collectionStats,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('❌ Error listing Firestore collections:', error);
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}

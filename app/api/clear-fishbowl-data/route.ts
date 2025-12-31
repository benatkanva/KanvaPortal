import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function deleteCollection(collectionPath: string, batchSize: number = 500) {
  const collectionRef = adminDb.collection(collectionPath);
  const query = collectionRef.limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(query, resolve, reject);
  });
}

async function deleteQueryBatch(
  query: FirebaseFirestore.Query,
  resolve: (value?: unknown) => void,
  reject: (reason?: any) => void
) {
  try {
    const snapshot = await query.get();

    if (snapshot.size === 0) {
      resolve();
      return;
    }

    const batch = adminDb.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`Deleted ${snapshot.size} documents`);

    // Recurse on the next batch
    process.nextTick(() => {
      deleteQueryBatch(query, resolve, reject);
    });
  } catch (error) {
    reject(error);
  }
}

async function deleteSubcollections(parentCollection: string, subcollectionName: string) {
  const parentDocs = await adminDb.collection(parentCollection).get();
  
  console.log(`Found ${parentDocs.size} parent documents in ${parentCollection}`);
  
  let totalDeleted = 0;
  
  for (const parentDoc of parentDocs.docs) {
    const subcollectionRef = parentDoc.ref.collection(subcollectionName);
    const subcollectionDocs = await subcollectionRef.get();
    
    if (subcollectionDocs.size > 0) {
      const batch = adminDb.batch();
      subcollectionDocs.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      totalDeleted += subcollectionDocs.size;
      console.log(`Deleted ${subcollectionDocs.size} documents from ${parentDoc.id}/${subcollectionName}`);
    }
  }
  
  console.log(`Total subcollection documents deleted: ${totalDeleted}`);
  return totalDeleted;
}

export async function POST(req: NextRequest) {
  try {
    const { confirm } = await req.json();
    
    if (confirm !== 'DELETE_ALL_FISHBOWL_DATA') {
      return NextResponse.json({ 
        error: 'Confirmation required. Send { "confirm": "DELETE_ALL_FISHBOWL_DATA" }' 
      }, { status: 400 });
    }

    console.log('\n🗑️  STARTING FISHBOWL DATA DELETION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const startTime = Date.now();
    
    // Step 1: Delete sales_order_history subcollections
    console.log('\n📦 Step 1: Deleting sales_order_history subcollections...');
    const subcollectionDeleted = await deleteSubcollections('fishbowl_customers', 'sales_order_history');
    
    // Step 2: Delete fishbowl_soitems collection
    console.log('\n📦 Step 2: Deleting fishbowl_soitems collection...');
    await deleteCollection('fishbowl_soitems');
    
    // Step 3: Delete fishbowl_sales_orders collection
    console.log('\n📦 Step 3: Deleting fishbowl_sales_orders collection...');
    await deleteCollection('fishbowl_sales_orders');
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log('\n✅ DELETION COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`⏱️  Duration: ${duration} seconds`);
    console.log(`📊 Subcollection documents deleted: ${subcollectionDeleted}`);
    
    return NextResponse.json({
      success: true,
      message: 'All Fishbowl data deleted successfully',
      duration: `${duration} seconds`,
      collectionsDeleted: [
        'fishbowl_sales_orders',
        'fishbowl_soitems',
        'fishbowl_customers/*/sales_order_history'
      ],
      subcollectionDocumentsDeleted: subcollectionDeleted
    });
    
  } catch (error: any) {
    console.error('❌ Deletion error:', error);
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const maxDuration = 300; // 5 minutes

export async function POST(request: NextRequest) {
  try {
    console.log('🧹 Starting Firestore cleanup...');

    // Step 1: Clean fishbowl_customers
    console.log('🧹 Cleaning fishbowl_customers...');
    const fishbowlSnapshot = await adminDb.collection('fishbowl_customers').get();
    let fishbowlBatch = adminDb.batch();
    let fishbowlCount = 0;
    
    fishbowlSnapshot.docs.forEach(doc => {
      // Remove bad match fields by setting to admin.firestore.FieldValue.delete()
      fishbowlBatch.update(doc.ref, {
        copperCompanyId: null,
        copperCompanyName: null,
        matchType: null,
        matchConfidence: null,
        matchedAt: null
      });
      fishbowlCount++;
    });
    
    await fishbowlBatch.commit();
    console.log(`✅ Cleaned ${fishbowlCount} fishbowl_customers`);

    // Step 2: Skip copper_companies migration (too large - 270K docs)
    // The copper companies already have the ID in the data, we just need to update matching
    console.log('⚠️  Skipping copper_companies migration (270K docs - too large)');
    console.log('💡 The matching code will use data.id instead of doc.id');
    console.log('✅ Cleanup complete!');

    return NextResponse.json({
      success: true,
      fishbowlCleaned: fishbowlCount,
      message: 'Fishbowl customers cleaned. Copper companies already have correct IDs in data.'
    });

  } catch (error: any) {
    console.error('❌ Cleanup error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

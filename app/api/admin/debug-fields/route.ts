import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Debug: Show sample Copper company and Fishbowl customer fields
 */
export async function GET() {
  try {
    // Get sample Copper company
    const copperSnapshot = await adminDb.collection('copper_companies').limit(1).get();
    const copperSample = copperSnapshot.docs[0]?.data();
    
    // Get sample Fishbowl customer
    const fishbowlSnapshot = await adminDb.collection('fishbowl_customers').limit(1).get();
    const fishbowlSample = fishbowlSnapshot.docs[0]?.data();
    
    return NextResponse.json({
      success: true,
      copperFields: copperSample ? Object.keys(copperSample) : [],
      copperSample: copperSample || null,
      fishbowlFields: fishbowlSample ? Object.keys(fishbowlSample) : [],
      fishbowlSample: fishbowlSample || null
    });
    
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

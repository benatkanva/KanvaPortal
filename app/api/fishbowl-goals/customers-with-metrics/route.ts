import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  try {
    // Get all matched Fishbowl customers (those with copperCompanyId)
    const customersSnapshot = await adminDb
      .collection('fishbowl_customers')
      .where('copperCompanyId', '!=', null)
      .get();

    const customers = customersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({
      customers,
      count: customers.length,
    });

  } catch (error: any) {
    console.error('❌ Error loading customers:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

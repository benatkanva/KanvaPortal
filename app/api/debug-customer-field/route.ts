import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export const maxDuration = 60;

/**
 * Debug endpoint to check what Account Type data we have for specific customer
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerName = searchParams.get('name') || 'The Hawaii Shop';

    console.log(`🔍 Searching for customer: "${customerName}"`);

    // Check copper_companies collection
    const copperSnap = await adminDb.collection('copper_companies')
      .where('name', '==', customerName)
      .limit(1)
      .get();

    if (copperSnap.empty) {
      return NextResponse.json({
        error: 'Customer not found in copper_companies',
        searchedFor: customerName,
      });
    }

    const copperDoc = copperSnap.docs[0];
    const copperData = copperDoc.data();

    // Extract all relevant fields
    const debugInfo = {
      customerName,
      copperId: copperData.id,
      copperDocId: copperDoc.id,
      
      // Account Type field - ALL possible representations
      accountType_raw: copperData['Account Type cf_675914'],
      accountType_type: typeof copperData['Account Type cf_675914'],
      accountType_isArray: Array.isArray(copperData['Account Type cf_675914']),
      
      // All custom fields
      allCustomFields: Object.keys(copperData)
        .filter(key => key.includes('cf_'))
        .reduce((acc: any, key) => {
          acc[key] = copperData[key];
          return acc;
        }, {}),
      
      // Standard fields
      assignee_id: copperData.assignee_id,
      
      // Check if it's the field format from Copper API
      customFieldsArray: copperData.custom_fields || 'Not present',
    };

    console.log('📊 Debug info:', JSON.stringify(debugInfo, null, 2));

    return NextResponse.json(debugInfo);

  } catch (error: any) {
    console.error('❌ Debug error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export const maxDuration = 60;

/**
 * Debug endpoint to check how Account Type is stored in copper_companies
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Checking copper_companies Account Type format...');

    const copperSnap = await adminDb.collection('copper_companies')
      .where('Active Customer cf_712751', '==', 'checked')
      .limit(50)
      .get();

    const samples: any[] = [];

    copperSnap.forEach(doc => {
      const data = doc.data();
      const accountType = data['Account Type cf_675914'];
      
      samples.push({
        id: doc.id,
        name: data.name || 'Unknown',
        accountType_raw: accountType,
        accountType_type: typeof accountType,
        accountType_isArray: Array.isArray(accountType),
        accountType_value: Array.isArray(accountType) 
          ? `Array[${accountType.length}]: ${JSON.stringify(accountType)}`
          : String(accountType),
      });
    });

    console.log('📊 Sample companies:', samples.slice(0, 10));

    return NextResponse.json({
      total: copperSnap.size,
      samples: samples.slice(0, 20),
      summary: {
        types: [...new Set(samples.map(s => s.accountType_type))],
        formats: samples.slice(0, 5).map(s => ({
          name: s.name,
          format: s.accountType_value
        }))
      }
    });

  } catch (error: any) {
    console.error('❌ Debug error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

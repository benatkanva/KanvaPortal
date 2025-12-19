import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Get Ben Wallner's rep record
    const repsSnapshot = await adminDb.collection('reps')
      .where('name', '==', 'Ben Wallner')
      .get();
    
    let benRep = null;
    if (!repsSnapshot.empty) {
      benRep = repsSnapshot.docs[0].data();
    }
    
    // 2. Get Account Manager rates
    const amRatesDoc = await adminDb.collection('commission_rates').doc('Account Manager').get();
    const amRates = amRatesDoc.exists ? amRatesDoc.data() : null;
    
    // 3. Get Account Executive rates
    const aeRatesDoc = await adminDb.collection('commission_rates').doc('Account Executive').get();
    const aeRates = aeRatesDoc.exists ? aeRatesDoc.data() : null;
    
    // 4. Check one transferred order
    const transferredOrder = await adminDb.collection('monthly_commissions')
      .where('commissionMonth', '==', '2025-10')
      .where('repName', '==', 'Ben Wallner')
      .where('customerStatus', '==', 'transferred')
      .limit(1)
      .get();
    
    let sampleOrder = null;
    if (!transferredOrder.empty) {
      sampleOrder = transferredOrder.docs[0].data();
    }
    
    return NextResponse.json({
      success: true,
      benWallner: {
        found: !!benRep,
        title: benRep?.title || 'NOT FOUND',
        name: benRep?.name || 'NOT FOUND',
        id: benRep?.id || 'NOT FOUND'
      },
      accountManagerRates: {
        exists: amRatesDoc.exists,
        transferredDistributor: amRates?.rates?.find((r: any) => 
          r.title === 'Account Manager' && 
          r.segmentId === 'distributor' && 
          r.status === 'transferred'
        ),
        transferredWholesale: amRates?.rates?.find((r: any) => 
          r.title === 'Account Manager' && 
          r.segmentId === 'wholesale' && 
          r.status === 'transferred'
        ),
        allTransferredRates: amRates?.rates?.filter((r: any) => r.status === 'transferred') || []
      },
      accountExecutiveRates: {
        exists: aeRatesDoc.exists,
        transferredDistributor: aeRates?.rates?.find((r: any) => 
          r.title === 'Account Executive' && 
          r.segmentId === 'distributor' && 
          r.status === 'transferred'
        ),
        transferredWholesale: aeRates?.rates?.find((r: any) => 
          r.title === 'Account Executive' && 
          r.segmentId === 'wholesale' && 
          r.status === 'transferred'
        )
      },
      sampleTransferredOrder: sampleOrder
    });
    
  } catch (error: any) {
    console.error('❌ Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Get ALL commission rate documents
    const allRatesSnapshot = await adminDb.collection('commission_rates').get();
    
    const allDocs: any[] = [];
    allRatesSnapshot.forEach((doc: any) => {
      allDocs.push({
        id: doc.id,
        data: doc.data()
      });
    });
    
    // Try to get Account Executive specifically
    const aeRatesDoc = await adminDb.collection('commission_rates').doc('Account Executive').get();
    
    return NextResponse.json({
      success: true,
      collectionDocCount: allRatesSnapshot.size,
      allDocumentIds: allDocs.map((d: any) => d.id),
      allDocuments: allDocs,
      accountExecutiveExists: aeRatesDoc.exists,
      accountExecutiveData: aeRatesDoc.exists ? aeRatesDoc.data() : null
    });
    
  } catch (error: any) {
    console.error('❌ Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

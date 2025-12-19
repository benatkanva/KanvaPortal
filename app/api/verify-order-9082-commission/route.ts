import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Get Order 9082 commission record
    const order9082Snapshot = await adminDb.collection('monthly_commissions')
      .where('orderNum', '==', '9082')
      .where('commissionMonth', '==', '2025-10')
      .get();
    
    let order9082 = null;
    if (!order9082Snapshot.empty) {
      order9082 = order9082Snapshot.docs[0].data();
    }
    
    // Get line items for Order 9082
    const lineItemsSnapshot = await adminDb.collection('fishbowl_soitems')
      .where('salesOrderId', '==', '21764') // Order 9082's SO ID
      .get();
    
    const lineItems: any[] = [];
    lineItemsSnapshot.forEach((doc: any) => {
      const item = doc.data();
      lineItems.push({
        partNumber: item.partNumber,
        productName: item.productName,
        totalPrice: item.totalPrice || item.revenue || 0,
        isShipping: item.isShippingItem
      });
    });
    
    // Manual calculation
    const positiveItems = lineItems.filter(item => 
      (item.totalPrice || 0) > 0 && !item.isShipping
    );
    
    const negativeItems = lineItems.filter(item => 
      (item.totalPrice || 0) < 0
    );
    
    const positiveSum = positiveItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
    const negativeSum = negativeItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
    
    const commissionBase = positiveSum + negativeSum; // Adding negative = subtracting
    const calculatedCommission = commissionBase * 0.08;
    
    return NextResponse.json({
      success: true,
      order9082Commission: {
        systemCalculated: order9082?.commissionAmount || 0,
        systemRate: order9082?.commissionRate || 0,
        systemBase: order9082?.orderRevenue || 0,
        cfoExpected: 2693.20
      },
      lineItems: lineItems,
      breakdown: {
        positiveItems: positiveItems.length,
        positiveSum: positiveSum,
        negativeItems: negativeItems.length,
        negativeSum: negativeSum,
        commissionBase: commissionBase,
        calculatedAt8Percent: calculatedCommission
      },
      match: Math.abs(calculatedCommission - 2693.20) < 1
    });
    
  } catch (error: any) {
    console.error('❌ Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

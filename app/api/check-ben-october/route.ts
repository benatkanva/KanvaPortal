import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Get all Ben Wallner October 2025 commissions
    const commissionsSnapshot = await adminDb.collection('monthly_commissions')
      .where('commissionMonth', '==', '2025-10')
      .where('repName', '==', 'Ben Wallner')
      .get();
    
    const commissions: any[] = [];
    let totalCommission = 0;
    
    commissionsSnapshot.forEach((doc: any) => {
      const data = doc.data();
      commissions.push({
        orderNum: data.orderNum,
        customerName: data.customerName,
        revenue: data.orderAmount || data.revenue || 0,
        commission: data.commissionAmount || 0,
        status: data.customerStatus,
        segment: data.customerSegment,
        isOverride: data.isOverride || false,
        manualAdjustment: data.manualAdjustment || 0
      });
      totalCommission += (data.commissionAmount || 0);
    });
    
    // Sort by order number
    commissions.sort((a, b) => {
      const aNum = parseInt(a.orderNum) || 0;
      const bNum = parseInt(b.orderNum) || 0;
      return aNum - bNum;
    });
    
    // Get summary from monthly_commission_summary
    const summaryDoc = await adminDb.collection('monthly_commission_summary')
      .where('month', '==', '2025-10')
      .where('repName', '==', 'Ben Wallner')
      .get();
    
    let summaryTotal = 0;
    if (!summaryDoc.empty) {
      summaryTotal = summaryDoc.docs[0].data().totalCommission || 0;
    }
    
    return NextResponse.json({
      success: true,
      month: '2025-10',
      rep: 'Ben Wallner',
      recordCount: commissions.length,
      calculatedTotal: totalCommission,
      summaryTotal: summaryTotal,
      difference: summaryTotal - totalCommission,
      commissions: commissions
    });
    
  } catch (error: any) {
    console.error('❌ Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // CFO's "Own" orders that should be 8%
    const ownOrders = ['9162', '9082', '9238', '9339', '9083', '9283', '9190'];
    
    // Get all Ben's October commissions
    const commissionsSnapshot = await adminDb.collection('monthly_commissions')
      .where('commissionMonth', '==', '2025-10')
      .where('repName', '==', 'Ben Wallner')
      .get();
    
    const systemOrders: any[] = [];
    let systemTotal = 0;
    let cfoTotal = 0;
    
    commissionsSnapshot.forEach((doc: any) => {
      const data = doc.data();
      const orderNum = data.orderNum;
      const systemCommission = data.commissionAmount || 0;
      const systemStatus = data.customerStatus;
      const systemRate = data.commissionRate || 0;
      const revenue = data.orderRevenue || data.orderAmount || 0;
      
      systemTotal += systemCommission;
      
      // Determine CFO status
      const cfoStatus = ownOrders.includes(orderNum) ? 'own' : 'transferred';
      const cfoRate = cfoStatus === 'own' ? 8 : (data.customerSegment === 'Distributor' ? 2 : 4);
      const cfoCommission = revenue * cfoRate / 100;
      
      cfoTotal += cfoCommission;
      
      const diff = cfoCommission - systemCommission;
      
      systemOrders.push({
        orderNum,
        customer: data.customerName,
        segment: data.customerSegment,
        revenue,
        systemStatus,
        systemRate,
        systemCommission: systemCommission.toFixed(2),
        cfoStatus,
        cfoRate,
        cfoCommission: cfoCommission.toFixed(2),
        difference: diff.toFixed(2),
        match: Math.abs(diff) < 0.5 ? '✅' : '❌'
      });
    });
    
    // Sort by difference (biggest mismatches first)
    systemOrders.sort((a, b) => Math.abs(parseFloat(b.difference)) - Math.abs(parseFloat(a.difference)));
    
    return NextResponse.json({
      success: true,
      totals: {
        systemTotal: systemTotal.toFixed(2),
        cfoTotal: cfoTotal.toFixed(2),
        difference: (cfoTotal - systemTotal).toFixed(2)
      },
      orderCount: systemOrders.length,
      mismatches: systemOrders.filter(o => o.match === '❌'),
      allOrders: systemOrders
    });
    
  } catch (error: any) {
    console.error('❌ Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

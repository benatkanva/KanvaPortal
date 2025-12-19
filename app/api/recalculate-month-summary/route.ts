/**
 * Recalculate summary for a specific rep and month
 * Use this after manual overrides to update totals
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { repId, month, year } = await request.json();
    
    if (!repId || !month || !year) {
      return NextResponse.json({ error: 'repId, month, and year required' }, { status: 400 });
    }
    
    const commissionMonth = `${year}-${String(month).padStart(2, '0')}`;
    
    console.log(`\n🔄 Recalculating summary for ${repId} ${commissionMonth}...`);
    
    // Get all commissions for this rep/month
    const commissionsSnapshot = await adminDb.collection('monthly_commissions')
      .where('salesPerson', '==', repId)
      .where('commissionMonth', '==', commissionMonth)
      .get();
    
    if (commissionsSnapshot.empty) {
      return NextResponse.json({ 
        error: `No commissions found for ${repId} in ${commissionMonth}` 
      }, { status: 404 });
    }
    
    // Calculate totals
    let totalCommission = 0;
    let totalRevenue = 0;
    let totalOrders = 0;
    let overrideCount = 0;
    
    commissionsSnapshot.forEach(doc => {
      const data = doc.data();
      totalCommission += data.commissionAmount || 0;
      totalRevenue += data.orderRevenue || data.revenue || 0;
      totalOrders++;
      if (data.isOverride) overrideCount++;
    });
    
    console.log(`   Total Commission: $${totalCommission.toFixed(2)}`);
    console.log(`   Total Revenue: $${totalRevenue.toFixed(2)}`);
    console.log(`   Orders: ${totalOrders}`);
    console.log(`   Overrides: ${overrideCount}`);
    
    // Update summary document
    const summaryDocId = `${repId}_${commissionMonth}`;
    await adminDb.collection('monthly_commission_summary').doc(summaryDocId).update({
      totalCommission,
      totalRevenue,
      totalOrders,
      lastRecalculated: new Date(),
    });
    
    console.log(`✅ Summary updated for ${repId} ${commissionMonth}\n`);
    
    return NextResponse.json({
      success: true,
      repId,
      month: commissionMonth,
      summary: {
        totalCommission,
        totalRevenue,
        totalOrders,
        overrideCount
      }
    });
    
  } catch (error: any) {
    console.error('❌ Recalculation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

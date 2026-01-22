import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, note, newRate, comment, month, year } = body;

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }

    // Get the commission record in monthly_commissions
    const commissionRef = adminDb.collection('monthly_commissions').doc(orderId);
    const commissionDoc = await commissionRef.get();

    if (!commissionDoc.exists) {
      return NextResponse.json(
        { error: 'Commission record not found' },
        { status: 404 }
      );
    }

    const commissionData = commissionDoc.data();

    // RATE UPDATE PATH
    if (newRate !== undefined && comment) {
      console.log(`✏️ Updating commission rate for order ${orderId} to ${newRate}%`);

      const orderRevenue = commissionData?.orderRevenue || 0;
      const salesPerson = commissionData?.salesPerson || '';
      const originalRate = commissionData?.commissionRate || 0;
      const newCommissionAmount = (orderRevenue * newRate) / 100;

      console.log(`  Original: ${originalRate}% = $${(orderRevenue * originalRate / 100).toFixed(2)}`);
      console.log(`  New: ${newRate}% = $${newCommissionAmount.toFixed(2)}`);

      await commissionRef.update({
        commissionRate: newRate,
        commissionAmount: newCommissionAmount,
        rateModified: true,
        rateComment: comment,
        originalRate: originalRate,
        rateUpdatedAt: FieldValue.serverTimestamp(),
        rateUpdatedBy: 'admin'
      });

      console.log(`✅ Updated commission rate for order ${orderId}`);

      // Recalculate monthly summary
      if (salesPerson && month && year) {
        await recalculateMonthlySummary(salesPerson, month, year);
      }

      return NextResponse.json({
        success: true,
        newCommissionAmount,
        message: 'Commission rate updated successfully'
      });
    }

    // NOTE UPDATE PATH (original functionality)
    console.log(`📝 Updating commission note for order ${orderId}`);

    await commissionRef.update({
      commissionNote: note || '',
      commissionNoteUpdatedAt: FieldValue.serverTimestamp(),
      commissionNoteUpdatedBy: 'admin'
    });

    console.log(`✅ Commission note updated for order ${orderId}`);

    return NextResponse.json({
      success: true,
      message: 'Commission note updated successfully'
    });

  } catch (error) {
    console.error('❌ Error updating commission:', error);
    return NextResponse.json(
      { error: 'Failed to update commission', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function recalculateMonthlySummary(salesPerson: string, month: string, year: string) {
  const commissionMonth = `${year}-${String(month).padStart(2, '0')}`;
  console.log(`🔄 Recalculating monthly summary for ${salesPerson} - ${commissionMonth}`);

  const commissionsSnapshot = await adminDb
    .collection('monthly_commissions')
    .where('salesPerson', '==', salesPerson)
    .where('commissionMonth', '==', commissionMonth)
    .get();

  let totalRevenue = 0;
  let totalCommission = 0;
  let orderCount = 0;

  commissionsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.excludeFromCommission) return;
    totalRevenue += (data.orderRevenue || 0);
    totalCommission += (data.commissionAmount || 0);
    orderCount++;
  });

  console.log(`  📊 ${orderCount} orders, $${totalRevenue.toLocaleString()} revenue, $${totalCommission.toLocaleString()} commission`);

  const summaryId = `${salesPerson}_${commissionMonth}`;
  await adminDb.collection('monthly_commission_summary').doc(summaryId).set({
    salesPerson,
    month: commissionMonth,
    year: parseInt(year),
    totalRevenue,
    totalCommission,
    totalOrders: orderCount,
    updatedAt: FieldValue.serverTimestamp(),
    recalculatedFromRateChange: true
  }, { merge: true });

  console.log(`✅ Updated monthly summary: ${summaryId}`);
}

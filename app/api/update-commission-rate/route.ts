import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { orderId, newRate, comment, month, year } = await request.json();

    if (!orderId || newRate === undefined || !month || !year) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!comment || !comment.trim()) {
      return NextResponse.json(
        { error: 'Comment is required for rate changes' },
        { status: 400 }
      );
    }

    // Get the order document
    const orderRef = adminDb.collection('fishbowl_sales_orders').doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    const orderData = orderDoc.data();
    const totalPrice = orderData?.totalPrice || 0;
    const salesPerson = orderData?.salesPerson || '';
    const originalRate = orderData?.commissionRate || 0;

    // Calculate new commission amount
    const newCommissionAmount = (totalPrice * newRate) / 100;

    // Update the order document with new rate, commission, and modification tracking
    await orderRef.update({
      commissionRate: newRate,
      commissionAmount: newCommissionAmount,
      rateModified: true,
      rateComment: comment,
      originalRate: originalRate,
      rateUpdatedAt: new Date(),
      rateUpdatedBy: 'admin'
    });

    // Update commission_entries collection
    const entriesSnapshot = await adminDb
      .collection('commission_entries')
      .where('salesOrderId', '==', orderId)
      .where('commissionMonth', '==', parseInt(month))
      .where('commissionYear', '==', parseInt(year))
      .get();

    const batch = adminDb.batch();
    
    entriesSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        commissionRate: newRate,
        commissionAmount: newCommissionAmount,
        rateModified: true,
        rateComment: comment,
        originalRate: originalRate,
        updatedAt: new Date()
      });
    });

    await batch.commit();

    // Recalculate monthly summary for this sales rep
    await recalculateMonthlySummary(salesPerson, month, year);

    return NextResponse.json({
      success: true,
      newCommissionAmount,
      message: 'Commission rate updated successfully'
    });

  } catch (error) {
    console.error('Error updating commission rate:', error);
    return NextResponse.json(
      { error: 'Failed to update commission rate' },
      { status: 500 }
    );
  }
}

async function recalculateMonthlySummary(salesPerson: string, month: string, year: string) {
  try {
    // Get all commission entries for this rep and month
    const entriesSnapshot = await adminDb
      .collection('commission_entries')
      .where('salesPerson', '==', salesPerson)
      .where('commissionMonth', '==', parseInt(month))
      .where('commissionYear', '==', parseInt(year))
      .get();

    let totalCommission = 0;
    let totalSpiffs = 0;
    let orderCount = 0;

    entriesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      
      // Only include if order is not excluded
      const isExcluded = data.excludeFromCommission || false;
      if (!isExcluded) {
        totalCommission += data.commissionAmount || 0;
        totalSpiffs += data.spiffAmount || 0;
        orderCount++;
      }
    });

    // Update monthly_commissions summary
    const summaryId = `${salesPerson}_${year}_${month}`;
    const summaryRef = adminDb.collection('monthly_commissions').doc(summaryId);

    await summaryRef.set({
      salesPerson,
      month: parseInt(month),
      year: parseInt(year),
      totalCommission,
      totalSpiffs,
      orderCount,
      lastUpdated: new Date(),
      updatedBy: 'rate_update'
    }, { merge: true });

    console.log(`✅ Updated monthly summary for ${salesPerson} ${year}-${month}: $${totalCommission.toFixed(2)}`);

  } catch (error) {
    console.error('Error recalculating monthly summary:', error);
    throw error;
  }
}

/**
 * Delete all commission records for a specific month
 * Use before recalculating to ensure fresh data
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { month, year } = body;
    
    if (!month || !year) {
      return NextResponse.json({ error: 'Month and year required' }, { status: 400 });
    }
    
    const commissionMonth = `${year}-${String(month).padStart(2, '0')}`;
    console.log(`\n🗑️  Deleting all commissions for ${commissionMonth}...\n`);
    
    // Delete from monthly_commissions
    const commissionsSnapshot = await adminDb.collection('monthly_commissions')
      .where('commissionMonth', '==', commissionMonth)
      .get();
    
    console.log(`Found ${commissionsSnapshot.size} commission records to delete`);
    
    const batch = adminDb.batch();
    let count = 0;
    
    commissionsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
      count++;
    });
    
    if (count > 0) {
      await batch.commit();
      console.log(`✅ Deleted ${count} commission records`);
    }
    
    // Also delete calculation logs
    const logsSnapshot = await adminDb.collection('commission_calculation_logs')
      .where('commissionMonth', '==', commissionMonth)
      .get();
    
    console.log(`Found ${logsSnapshot.size} calculation log records to delete`);
    
    const logBatch = adminDb.batch();
    let logCount = 0;
    
    logsSnapshot.docs.forEach(doc => {
      logBatch.delete(doc.ref);
      logCount++;
    });
    
    if (logCount > 0) {
      await logBatch.commit();
      console.log(`✅ Deleted ${logCount} calculation log records`);
    }
    
    return NextResponse.json({
      success: true,
      commissionsDeleted: count,
      logsDeleted: logCount,
      message: `Deleted ${count} commissions and ${logCount} logs for ${commissionMonth}`
    });
    
  } catch (error: any) {
    console.error('❌ Delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

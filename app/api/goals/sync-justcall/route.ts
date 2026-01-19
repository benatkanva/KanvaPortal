import { NextRequest, NextResponse } from 'next/server';
import { metricService } from '@/lib/firebase/services/goals';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    const body = await request.json();
    const { startDate, endDate } = body;

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Missing date range' }, { status: 400 });
    }

    // Fetch JustCall data from Firestore (assuming it's synced there)
    // This will be populated by a separate JustCall webhook/sync process
    const justCallSnapshot = await adminDb
      .collection('justcall_activities')
      .where('userId', '==', userId)
      .where('timestamp', '>=', new Date(startDate))
      .where('timestamp', '<=', new Date(endDate))
      .get();

    let totalCalls = 0;
    let totalSMS = 0;
    const callsByDate = new Map<string, number>();
    const smsByDate = new Map<string, number>();

    justCallSnapshot.forEach(doc => {
      const data = doc.data();
      const dateKey = new Date(data.timestamp.toDate()).toISOString().split('T')[0];
      
      if (data.type === 'call') {
        totalCalls++;
        callsByDate.set(dateKey, (callsByDate.get(dateKey) || 0) + 1);
      } else if (data.type === 'sms') {
        totalSMS++;
        smsByDate.set(dateKey, (smsByDate.get(dateKey) || 0) + 1);
      }
    });

    // Log metrics to goals system
    const metricsLogged = [];
    
    for (const [dateStr, count] of callsByDate.entries()) {
      const metricId = await metricService.logMetric({
        userId,
        type: 'phone_call_quantity',
        value: count,
        date: new Date(dateStr),
        source: 'justcall',
        metadata: { syncDate: new Date().toISOString() }
      });
      metricsLogged.push(metricId);
    }

    for (const [dateStr, count] of smsByDate.entries()) {
      const metricId = await metricService.logMetric({
        userId,
        type: 'sms_quantity',
        value: count,
        date: new Date(dateStr),
        source: 'justcall',
        metadata: { syncDate: new Date().toISOString() }
      });
      metricsLogged.push(metricId);
    }

    return NextResponse.json({
      success: true,
      totalCalls,
      totalSMS,
      metricsLogged: metricsLogged.length
    });
  } catch (error) {
    console.error('Error syncing JustCall metrics:', error);
    return NextResponse.json({ error: 'Failed to sync JustCall data' }, { status: 500 });
  }
}

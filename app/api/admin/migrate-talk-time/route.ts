import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!process.env.SYNC_SECRET || token !== process.env.SYNC_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { dryRun = true, limit = 1000 } = await req.json().catch(() => ({ dryRun: true, limit: 1000 }));

    // Find legacy talk_time metrics
    const snap = await adminDb
      .collection('metrics')
      .where('type', '==', 'talk_time')
      .orderBy('date', 'desc')
      .limit(limit)
      .get();

    let processed = 0;
    let migrated = 0;
    const batch = adminDb.batch();

    for (const doc of snap.docs) {
      processed++;
      const m: any = doc.data();
      const id = doc.id;
      const userId = m.userId;
      const date: Date = m.date?.toDate?.() || new Date(m.date);
      const count = Number(m.value) || 0;
      const minutes = Number(m?.metadata?.minutes || 0);

      // New: phone_call_quantity
      const newDoc1 = adminDb.collection('metrics').doc();
      batch.set(newDoc1, {
        id: newDoc1.id,
        userId,
        type: 'phone_call_quantity',
        value: count,
        date: Timestamp.fromDate(date),
        source: 'migration',
        metadata: { migratedFrom: id, minutes, migratedAt: new Date().toISOString() },
        createdAt: Timestamp.now(),
      });

      // New: talk_time_minutes (if any)
      if (minutes > 0) {
        const newDoc2 = adminDb.collection('metrics').doc();
        batch.set(newDoc2, {
          id: newDoc2.id,
          userId,
          type: 'talk_time_minutes',
          value: minutes,
          date: Timestamp.fromDate(date),
          source: 'migration',
          metadata: { migratedFrom: id, callCount: count, migratedAt: new Date().toISOString() },
          createdAt: Timestamp.now(),
        });
      }

      // Delete legacy
      batch.delete(doc.ref);
      migrated++;
    }

    if (!dryRun && migrated > 0) {
      await batch.commit();
    }

    return NextResponse.json({ success: true, processed, migrated, dryRun });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Migration failed' }, { status: 500 });
  }
}

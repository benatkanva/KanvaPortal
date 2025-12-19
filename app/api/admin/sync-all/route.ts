import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export async function POST(req: NextRequest) {
  try {
    // AuthN via SYNC_SECRET
    const auth = req.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!process.env.SYNC_SECRET || token !== process.env.SYNC_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { days = 30, userIds } = await req.json().catch(()=>({}));
    const start = isoDaysAgo(days);
    const end = new Date().toISOString();

    // Load users (optionally filter)
    let users: string[] = [];
    if (Array.isArray(userIds) && userIds.length) {
      users = userIds.map(String);
    } else {
      const snap = await adminDb.collection('users').get();
      users = snap.docs.map(d => d.id);
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const endpoint = `${origin}/api/sync-metrics`;

    // Throttled concurrency
    const concurrency = 3;
    let idx = 0;
    const results: any[] = [];

    async function worker() {
      while (idx < users.length) {
        const i = idx++;
        const userId = users[i];
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.SYNC_SECRET}` },
            body: JSON.stringify({ userId, start, end }),
          });
          const json = await res.json().catch(()=>({}));
          results.push({ userId, ok: res.ok, status: res.status, metrics: json?.metrics, warnings: json?.metrics?.warnings });
          // small delay to be courteous
          await new Promise(r => setTimeout(r, 200));
        } catch (e: any) {
          results.push({ userId, ok: false, error: e?.message || String(e) });
        }
      }
    }

    const workers = Array.from({ length: Math.min(concurrency, Math.max(1, users.length)) }, () => worker());
    await Promise.all(workers);

    return NextResponse.json({ success: true, count: users.length, results });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to sync all users' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const startStr = searchParams.get('start');
    const endStr = searchParams.get('end');
    const salesOnly = ['1','true','yes'].includes(String(searchParams.get('salesOnly')||'').toLowerCase());

    // Default: last 90 days
    const end = endStr ? new Date(endStr) : new Date();
    const start = startStr ? new Date(startStr) : new Date(new Date().setDate(end.getDate() - 90));

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: 'Invalid start or end date' }, { status: 400 });
    }

    // Query metrics
    const snap = await adminDb
      .collection('metrics')
      .where('date', '>=', Timestamp.fromDate(start))
      .where('date', '<=', Timestamp.fromDate(end))
      .get();

    // Collect unique userIds
    const metrics: any[] = [];
    const userIds = new Set<string>();
    snap.forEach((doc) => {
      const m = doc.data();
      metrics.push(m);
      if (m.userId) userIds.add(String(m.userId));
    });

    // Build user email map
    const userInfoMap = new Map<string, { email?: string; role?: string }>();
    await Promise.all(
      Array.from(userIds).map(async (uid) => {
        try {
          const uSnap = await adminDb.collection('users').doc(uid).get();
          const u = uSnap.exists ? (uSnap.data() as any) : null;
          if (u) userInfoMap.set(uid, { email: u?.email ? String(u.email) : undefined, role: u?.role ? String(u.role) : undefined });
        } catch {}
      })
    );

    // Prepare CSV
    const rows: string[] = [];
    rows.push(['userId', 'userEmail', 'role', 'date', 'type', 'value', 'source', 'metadata_json'].join(','));

    for (const m of metrics) {
      const uid = String(m.userId || '');
      const info = userInfoMap.get(uid) || {};
      const email = info.email || '';
      const role = info.role || '';
      if (salesOnly && role.toLowerCase() !== 'sales') continue;
      const dt = m.date && typeof m.date.toDate === 'function' ? m.date.toDate() as Date : (m.date ? new Date(m.date) : new Date(0));
      const dateOnly = toDateOnly(dt);
      const type = String(m.type || '');
      const value = Number(m.value || 0);
      const source = String(m.source || '');
      const metadata = m.metadata ? JSON.stringify(m.metadata).replace(/\"/g, '""') : '';
      const parts = [
        uid,
        email,
        role,
        dateOnly,
        type,
        String(value),
        source,
        metadata ? `"${metadata}"` : ''
      ];
      rows.push(parts.join(','));
    }

    const csv = rows.join('\n');
    const res = new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Disposition': `attachment; filename="metrics_export_${toDateOnly(start)}_to_${toDateOnly(end)}.csv"`,
      },
    });
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Export failed' }, { status: 500 });
  }
}

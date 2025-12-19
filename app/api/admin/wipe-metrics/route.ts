import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getAdminEmails(): string[] {
  const env = process.env.NEXT_PUBLIC_ADMIN_EMAILS || process.env.ADMIN_EMAILS || '';
  return env.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
}

async function requireAdminOrSecret(req: NextRequest) {
  const syncSecret = process.env.SYNC_SECRET || '';
  const providedSecret = (req.headers.get('x-sync-secret') || req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (syncSecret && providedSecret && providedSecret === syncSecret) return { email: 'admin@internal' } as any;

  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const email = (decoded.email || '').toLowerCase();
    const admins = getAdminEmails();
    if (email && admins.includes(email)) return decoded;
    return null;
  } catch {
    return null;
  }
}

async function deleteQueryBatched(q: FirebaseFirestore.Query, batchSize = 500) {
  while (true) {
    const snap = await q.limit(batchSize).get();
    if (snap.empty) break;
    const batch = adminDb.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    if (snap.size < batchSize) break;
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminOrSecret(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const startISO: string | undefined = body?.start;
    const endISO: string | undefined = body?.end;

    let q = adminDb.collection('metrics') as FirebaseFirestore.Query;
    if (startISO) q = q.where('date', '>=', Timestamp.fromDate(new Date(startISO)));
    if (endISO) q = q.where('date', '<=', Timestamp.fromDate(new Date(endISO)));

    await deleteQueryBatched(q);

    return NextResponse.json({ success: true, start: startISO || null, end: endISO || null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Wipe failed' }, { status: 500 });
  }
}

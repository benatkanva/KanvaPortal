import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

function getAdminEmails(): string[] {
  const env = process.env.NEXT_PUBLIC_ADMIN_EMAILS || process.env.ADMIN_EMAILS || '';
  return env.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
}

async function requireAdmin(req: NextRequest) {
  // Option 1: SYNC_SECRET header
  const syncSecret = process.env.SYNC_SECRET || '';
  const providedSecret = (req.headers.get('x-sync-secret') || req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (syncSecret && providedSecret && providedSecret === syncSecret) {
    return { email: 'sync@internal' } as any;
  }

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

export async function POST(req: NextRequest) {
  // Require Firebase ID token that matches ADMIN_EMAILS
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    let nextPageToken: string | undefined = undefined;
    let processed = 0;
    let created = 0;
    let updated = 0;

    do {
      const page = await adminAuth.listUsers(1000, nextPageToken);
      for (const u of page.users) {
        const { uid, email, displayName, photoURL } = u;
        const ref = adminDb.collection('users').doc(uid);
        const snap = await ref.get();
        const data: any = {
          id: uid,
          email: (email || '').toLowerCase(),
          name: displayName || (email ? email.split('@')[0] : 'Sales Representative'),
          photoUrl: photoURL || null,
          role: 'sales',
          passwordChanged: false,
          updatedAt: new Date(),
        };
        if (!snap.exists) data.createdAt = new Date();
        await ref.set(data, { merge: true });
        processed++;
        if (snap.exists) updated++; else created++;
      }
      nextPageToken = page.pageToken || undefined;
    } while (nextPageToken);

    return NextResponse.json({ ok: true, processed, created, updated });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Backfill failed' }, { status: 500 });
  }
}

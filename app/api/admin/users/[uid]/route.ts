import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

function getAdminEmails(): string[] {
  const env = process.env.NEXT_PUBLIC_ADMIN_EMAILS || process.env.ADMIN_EMAILS || '';
  return env.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
}

async function requireAdmin(req: NextRequest) {
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

export async function PATCH(req: NextRequest, { params }: { params: { uid: string } }) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { uid } = params;
  try {
    const body = await req.json();
    const { email, name, role } = body || {};

    if (email) {
      // Only allow @kanvabotanicals.com or @cwlbrands.com
      const em = String(email).trim().toLowerCase();
      const allowedDomains = ['@kanvabotanicals.com', '@cwlbrands.com'];
      const hasValidDomain = allowedDomains.some(domain => em.endsWith(domain));
      if (!hasValidDomain) return NextResponse.json({ error: 'Email must be @kanvabotanicals.com or @cwlbrands.com' }, { status: 400 });
      await adminAuth.updateUser(uid, { email: em, displayName: name });
      const update: any = { email: em, updatedAt: new Date() };
      update.name = (name ?? em.split('@')[0]);
      if (typeof role !== 'undefined' && role !== null) update.role = role;
      await adminDb.collection('users').doc(uid).set(update, { merge: true });
    } else {
      const update: any = { updatedAt: new Date() };
      if (typeof name !== 'undefined' && name !== null) update.name = name;
      if (typeof role !== 'undefined' && role !== null) update.role = role;
      await adminDb.collection('users').doc(uid).set(update, { merge: true });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { uid: string } }) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { uid } = params;
  try {
    await adminAuth.deleteUser(uid);
    await adminDb.collection('users').doc(uid).delete();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to delete user' }, { status: 500 });
  }
}

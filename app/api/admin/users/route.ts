import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getAdminEmails(): string[] {
  const env = process.env.NEXT_PUBLIC_ADMIN_EMAILS || process.env.ADMIN_EMAILS || '';
  return env.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
}

async function requireAdmin(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    console.log('[Admin Users] No token provided');
    return null;
  }
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const email = (decoded.email || '').toLowerCase();
    const admins = getAdminEmails();
    console.log('[Admin Users] User email:', email);
    console.log('[Admin Users] Admin emails:', admins);
    if (email && admins.includes(email)) return decoded;
    console.log('[Admin Users] Email not in admin list');
    return null;
  } catch (e) {
    console.error('[Admin Users] Token verification failed:', e);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized (missing/invalid token or email not in NEXT_PUBLIC_ADMIN_EMAILS)' }, { status: 401 });
  try {
    const snap = await adminDb.collection('users').orderBy('email').get();
    const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ users });
  } catch (e: any) {
    try { console.error('[api/admin/users] GET error:', e?.stack || e?.message || e); } catch {}
    return NextResponse.json({ error: e?.message || 'Failed to list users' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized (missing/invalid token or email not in NEXT_PUBLIC_ADMIN_EMAILS)' }, { status: 401 });

  try {
    const body = await req.json();
    const { email, password, role = 'sales', name, sendWelcome = false } = body || {};
    if (!email || !password) return NextResponse.json({ error: 'email and password required' }, { status: 400 });

    const em = String(email).trim().toLowerCase();
    const allowedDomains = ['@kanvabotanicals.com', '@cwlbrands.com'];
    const hasValidDomain = allowedDomains.some(domain => em.endsWith(domain));
    if (!hasValidDomain) {
      return NextResponse.json({ error: 'Email must be @kanvabotanicals.com or @cwlbrands.com' }, { status: 400 });
    }

    // Create in Firebase Auth
    const u = await adminAuth.createUser({ email: em, password, displayName: name });

    // Create/merge Firestore user profile
    await adminDb.collection('users').doc(u.uid).set({
      id: u.uid,
      email: em,
      name: name || em.split('@')[0],
      role,
      photoUrl: null,
      passwordChanged: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }, { merge: true });

    // TODO: send welcome email integration (out of scope here)
    if (sendWelcome) {
      // placeholder
    }

    return NextResponse.json({ id: u.uid });
  } catch (e: any) {
    try { console.error('[api/admin/users] POST error:', e?.stack || e?.message || e); } catch {}
    return NextResponse.json({ error: e?.message || 'Failed to create user' }, { status: 500 });
  }
}


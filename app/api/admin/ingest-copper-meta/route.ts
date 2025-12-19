import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getAdminEmails(): string[] {
  const env = process.env.NEXT_PUBLIC_ADMIN_EMAILS || process.env.ADMIN_EMAILS || '';
  return env.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
}

async function isAuthorized(req: NextRequest) {
  const secret = process.env.SYNC_SECRET || '';
  const authHeader = req.headers.get('authorization') || '';
  if (secret && authHeader === `Bearer ${secret}`) return true;

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return false;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const email = (decoded.email || '').toLowerCase();
    const admins = getAdminEmails();
    return !!email && admins.includes(email);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const fetchedAt = body?.fetchedAt || new Date().toISOString();

    // Normalize and store full metadata payload
    const fullDocRef = adminDb.collection('settings').doc('copper_metadata_full');
    await fullDocRef.set({ ...body, updatedAt: new Date().toISOString(), fetchedAt }, { merge: true });

    // Update users map if provided (your sample has a single user; usually you'd post a users array)
    try {
      const usersMapRef = adminDb.collection('settings').doc('copper_users_map');
      const byEmail: Record<string, number> = {};
      if (Array.isArray(body?.users)) {
        for (const u of body.users) {
          const em = String(u?.email || '').toLowerCase().trim();
          const id = Number(u?.id);
          if (em && id) byEmail[em] = id;
        }
      } else if (body?.user) {
        const em = String(body.user.email || '').toLowerCase().trim();
        const id = Number(body.user.id);
        if (em && id) byEmail[em] = id;
      }
      if (Object.keys(byEmail).length) {
        await usersMapRef.set({ byEmail, updatedAt: new Date().toISOString() }, { merge: true });
      }
    } catch {}

    // Extract important defaults
    const defaultsRef = adminDb.collection('settings').doc('copper_metadata');
    const defaultsSnap = await defaultsRef.get();
    const existingDefaults = defaultsSnap.exists ? (defaultsSnap.data() as any).defaults || {} : {};

    // SALE_TYPE_FIELD_ID from Custom Field Definitions
    let saleTypeFieldId: number | undefined = undefined;
    if (Array.isArray(body?.customFieldDefinitions)) {
      for (const def of body.customFieldDefinitions) {
        if (String(def?.name).toLowerCase() === 'sale type' && Array.isArray(def?.available_on) && def.available_on.includes('opportunity')) {
          const id = Number(def.id);
          if (id) saleTypeFieldId = id;
        }
      }
    }

    const newDefaults = { ...existingDefaults };
    if (saleTypeFieldId) {
      newDefaults.SALE_TYPE_FIELD_ID = saleTypeFieldId;
    }

    await defaultsRef.set({ defaults: newDefaults, updatedAt: new Date().toISOString() }, { merge: true });

    return NextResponse.json({ success: true, updated: { SALE_TYPE_FIELD_ID: saleTypeFieldId || null } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to ingest metadata' }, { status: 500 });
  }
}

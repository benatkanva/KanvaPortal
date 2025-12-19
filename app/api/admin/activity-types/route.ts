import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin';

const COPPER_API_BASE = 'https://api.copper.com/developer_api/v1';
const COPPER_API_KEY = process.env.COPPER_API_KEY!;
const COPPER_USER_EMAIL = process.env.COPPER_USER_EMAIL!;

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

async function fetchWithRetry(url: string, init: RequestInit, retries = 4, baseDelayMs = 400): Promise<Response> {
  let attempt = 0;
  let lastErr: any = null;
  while (attempt <= retries) {
    const res = await fetch(url, init);
    if (res.ok) return res;
    if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
      const delay = Math.min(5000, baseDelayMs * Math.pow(2, attempt));
      await new Promise(r => setTimeout(r, delay));
      attempt++;
      continue;
    }
    lastErr = new Error(`${url} -> ${res.status}`);
    break;
  }
  throw lastErr || new Error('Copper request failed');
}

export async function GET(req: NextRequest) {
  const admin = await requireAdminOrSecret(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // Prefer org defaults for the identity used in Copper calls
    let pwUserEmail = '';
    try {
      const metaSnap = await adminDb.collection('settings').doc('copper_metadata').get();
      const meta = metaSnap.exists ? (metaSnap.data() as any) : null;
      pwUserEmail = String(meta?.defaults?.copperUserEmail || '').trim();
    } catch {}
    if (!pwUserEmail) pwUserEmail = String(process.env.COPPER_USER_EMAIL || '').trim();
    if (!pwUserEmail) {
      return NextResponse.json({ error: 'Missing Copper user email. Set settings/copper_metadata.defaults.copperUserEmail or COPPER_USER_EMAIL env.' }, { status: 400 });
    }

    const res = await fetchWithRetry(`${COPPER_API_BASE}/activity_types`, {
      method: 'GET',
      headers: {
        'X-PW-AccessToken': COPPER_API_KEY,
        'X-PW-Application': 'developer_api',
        'X-PW-UserEmail': pwUserEmail,
      },
    });
    const types = await res.json();

    return NextResponse.json({ success: true, types: Array.isArray(types) ? types : [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to fetch activity types' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminOrSecret(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const emailActivityId = Number(body?.emailActivityId || 0) || 0;
    const emailActivityCategory = String(body?.emailActivityCategory || '').trim();
    const phoneCallActivityId = Number(body?.phoneCallActivityId || 0) || 0;
    const phoneCallActivityCategory = String(body?.phoneCallActivityCategory || '').trim();

    if (!emailActivityId || !emailActivityCategory || !phoneCallActivityId || !phoneCallActivityCategory) {
      return NextResponse.json({ error: 'All fields required: emailActivityId, emailActivityCategory, phoneCallActivityId, phoneCallActivityCategory' }, { status: 400 });
    }

    const docRef = adminDb.collection('settings').doc('copper_metadata');
    await docRef.set({
      defaults: {
        emailActivityId,
        emailActivityCategory,
        phoneCallActivityId,
        phoneCallActivityCategory,
      }
    }, { merge: true });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to save defaults' }, { status: 500 });
  }
}

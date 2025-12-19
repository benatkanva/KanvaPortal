import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getAdminEmails(): string[] {
  const env = process.env.NEXT_PUBLIC_ADMIN_EMAILS || process.env.ADMIN_EMAILS || '';
  return env.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
}

async function requireAdminOrCron(req: NextRequest) {
  // Allow either SYNC_SECRET or an Admin Firebase token
  const syncSecret = process.env.SYNC_SECRET || '';
  const providedSecret = (req.headers.get('x-sync-secret') || req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (syncSecret && providedSecret && providedSecret === syncSecret) {
    return { email: 'cron@internal' } as any;
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
  const authd = await requireAdminOrCron(req);
  if (!authd) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const now = new Date();
    // Sync last 26 hours to provide a 2h overlap, in case of clock drift/deploys
    const end = now;
    const start = new Date(now.getTime() - 26 * 60 * 60 * 1000);

    const origin = new URL(req.url).origin;

    // Find all active sales users. If a user has disabled==true, skip.
    const usersSnap = await adminDb.collection('users').where('role', '==', 'sales').get();
    const salesUsers = usersSnap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .filter(u => !!u.email && u.disabled !== true);

    let processed = 0;
    let ok = 0;
    let failed = 0;
    const details: Array<{ userId: string; email: string; status: number; warnings?: string[]; error?: string }> = [];

    for (const u of salesUsers) {
      processed++;
      try {
        const res = await fetch(`${origin}/api/sync-metrics`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: u.id,
            period: 'custom',
            start: start.toISOString(),
            end: end.toISOString(),
            copperUserEmail: u.email,
          }),
        });
        const data: any = await res.json().catch(() => ({}));
        if (!res.ok) {
          failed++;
          details.push({ userId: u.id, email: u.email, status: res.status, error: data?.error || 'sync failed' });
        } else {
          ok++;
          const warnings: string[] = data?.metrics?.warnings || [];
          details.push({ userId: u.id, email: u.email, status: res.status, warnings });
        }
      } catch (e: any) {
        failed++;
        details.push({ userId: u.id, email: u.email, status: 0, error: e?.message || String(e) });
      }
      // Gentle pacing to avoid Copper rate limits
      await new Promise(r => setTimeout(r, 600));
    }

    return NextResponse.json({
      success: true,
      window: { start: start.toISOString(), end: end.toISOString() },
      processed,
      ok,
      failed,
      details,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Daily sync failed' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const end = body?.end ? new Date(body.end) : new Date();
    const start = body?.start ? new Date(body.start) : new Date(new Date().setDate(end.getDate() - 90));
    const origin = new URL(req.url).origin;

    // Find all users with role == 'sales' OR commissioned admins
    const usersSnap = await adminDb.collection('users').get();
    const salesUsers = usersSnap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .filter(u => !!u.email && (u.role === 'sales' || (u.role === 'admin' && u.isCommissioned === true)));

    let processed = 0;
    let ok = 0;
    let failed = 0;
    const details: Array<{ userId: string; email: string; status: number; warnings?: string[]; error?: string }> = [];

    for (const u of salesUsers) {
      processed++;
      const userWarnings: string[] = [];
      let userError: string | undefined;
      
      try {
        // 1. Sync Copper metrics (emails, calls, leads, sales)
        const copperRes = await fetch(`${origin}/api/sync-metrics`, {
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
        const copperData: any = await copperRes.json().catch(() => ({}));
        if (!copperRes.ok) {
          userError = `Copper sync failed: ${copperData?.error || copperRes.status}`;
        } else {
          if (copperData?.metrics?.warnings) {
            userWarnings.push(...copperData.metrics.warnings);
          }
        }

        // 2. Sync JustCall metrics (phone calls, talk time)
        try {
          const justcallRes = await fetch(`${origin}/api/sync-justcall-metrics`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: u.id,
              startDate: start.toISOString(),
              endDate: end.toISOString(),
            }),
          });
          const justcallData: any = await justcallRes.json().catch(() => ({}));
          if (!justcallRes.ok) {
            userWarnings.push(`JustCall sync failed: ${justcallData?.error || justcallRes.status}`);
          } else if (justcallData?.warnings) {
            userWarnings.push(...justcallData.warnings);
          }
        } catch (jce: any) {
          userWarnings.push(`JustCall sync error: ${jce?.message || 'unknown'}`);
        }

        if (userError) {
          failed++;
          details.push({ userId: u.id, email: u.email, status: copperRes.status, error: userError, warnings: userWarnings.length > 0 ? userWarnings : undefined });
        } else {
          ok++;
          details.push({ userId: u.id, email: u.email, status: 200, warnings: userWarnings.length > 0 ? userWarnings : undefined });
        }
      } catch (e: any) {
        failed++;
        details.push({ userId: u.id, email: u.email, status: 0, error: e?.message || String(e) });
      }
      // Gentle pacing to avoid rate limits
      await new Promise(r => setTimeout(r, 800));
    }

    return NextResponse.json({ success: true, processed, ok, failed, window: { start: start.toISOString(), end: end.toISOString() }, details });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Batch backfill failed' }, { status: 500 });
  }
}

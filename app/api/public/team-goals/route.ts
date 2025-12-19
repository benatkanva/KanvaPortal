import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Simple per-IP rate limiter (burst 30 / 60s)
const rl = (globalThis as any).__rl_team_goals || { map: new Map<string, number[]>() };
(globalThis as any).__rl_team_goals = rl;

export async function GET() {
  try {
    // Rate limit
    const ip = 'public'; // Behind Hosting/SSR, IP parsing may vary; keep a single bucket
    const now = Date.now();
    const win = 60 * 1000;
    const bucket = rl.map.get(ip) || [];
    const recent = bucket.filter((t: number) => now - t < win);
    if (recent.length >= 30) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }
    recent.push(now);
    rl.map.set(ip, recent);

    const doc = await adminDb.collection('settings').doc('team_goals').get();
    const data = doc.exists ? doc.data() : null;
    const res = NextResponse.json({ teamGoals: data || null });
    res.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=60');
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load team goals' }, { status: 500 });
  }
}

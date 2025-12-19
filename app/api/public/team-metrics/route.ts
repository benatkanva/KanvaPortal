import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { User } from '@/types';
import { isSalesUser } from '@/lib/utils/userFilters';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Simple per-IP rate limiter (burst 60 / 60s)
const rl = (globalThis as any).__rl_team_metrics || { map: new Map<string, number[]>() };
(globalThis as any).__rl_team_metrics = rl;

function getRange(period: string) {
  const now = new Date();
  let start: Date;
  if (period === 'daily') {
    start = new Date(now); start.setHours(0,0,0,0);
  } else if (period === 'weekly') {
    start = new Date(now); start.setDate(now.getDate() - 6); start.setHours(0,0,0,0);
  } else {
    start = new Date(now); start.setDate(now.getDate() - 29); start.setHours(0,0,0,0);
  }
  return { start, end: now };
}

export async function GET(req: NextRequest) {
  try {
    // Rate limit
    const ip = 'public';
    const now = Date.now();
    const win = 60 * 1000;
    const bucket = rl.map.get(ip) || [];
    const recent = bucket.filter((t: number) => now - t < win);
    if (recent.length >= 60) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }
    recent.push(now);
    rl.map.set(ip, recent);

    const { searchParams } = new URL(req.url);
    const period = (searchParams.get('period') || 'daily').toLowerCase();

    const { start, end } = getRange(period);

    // Get sales users only (exclude executives)
    const usersSnapshot = await adminDb.collection('users').get();
    const salesUserIds = usersSnapshot.docs
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title,
          role: data.role || 'sales',
          email: data.email || '',
          name: data.name || '',
        } as User & { id: string };
      })
      .filter(isSalesUser)
      .map(u => u.id);

    // Query metrics in date range for sales users only and aggregate totals by type
    const snap = await adminDb
      .collection('metrics')
      .where('date', '>=', Timestamp.fromDate(start))
      .where('date', '<=', Timestamp.fromDate(end))
      .get();

    const totals: Record<string, number> = {};
    snap.docs.forEach((d) => {
      const m: any = d.data();
      const userId = String(m.userId);
      
      // Only include metrics from sales users
      if (!salesUserIds.includes(userId)) {
        return;
      }
      
      const t = String(m.type);
      const v = Number(m.value) || 0;
      totals[t] = (totals[t] || 0) + v;
    });

    // Backward-compat: fold legacy 'talk_time' (call count) into new 'phone_call_quantity'
    if (totals['talk_time']) {
      totals['phone_call_quantity'] = (totals['phone_call_quantity'] || 0) + totals['talk_time'];
    }

    const res = NextResponse.json({ period, totals });
    res.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=60');
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load team metrics' }, { status: 500 });
  }
}

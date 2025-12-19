import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const goalTypes = [
  'phone_call_quantity',
  'email_quantity',
  'lead_progression_a',
  'lead_progression_b',
  'lead_progression_c',
  'new_sales_wholesale',
  'new_sales_distribution',
] as const;

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

function elapsedFraction(period: string) {
  const now = new Date();
  if (period === 'daily') {
    const start = new Date(now); start.setHours(0,0,0,0);
    const total = 24 * 60 * 60 * 1000;
    return Math.min(0.999, Math.max(0.001, (now.getTime() - start.getTime()) / total));
  }
  if (period === 'weekly') {
    const start = new Date(now); start.setDate(now.getDate() - 6); start.setHours(0,0,0,0);
    const total = 7 * 24 * 60 * 60 * 1000;
    return Math.min(0.999, Math.max(0.001, (now.getTime() - start.getTime()) / total));
  }
  const start = new Date(now); start.setDate(now.getDate() - 29); start.setHours(0,0,0,0);
  const total = 30 * 24 * 60 * 60 * 1000;
  return Math.min(0.999, Math.max(0.001, (now.getTime() - start.getTime()) / total));
}

export async function GET(req: NextRequest) {
  try {
    // Simple per-IP rate limiter (burst 60 / 60s)
    const rl = (globalThis as any).__rl_team_kpis || { map: new Map<string, number[]>() };
    (globalThis as any).__rl_team_kpis = rl;
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

    // Load team goals
    const goalsDoc = await adminDb.collection('settings').doc('team_goals').get();
    const teamGoals = goalsDoc.exists ? goalsDoc.data() || {} : {};

    // Aggregate totals across metrics
    const snap = await adminDb
      .collection('metrics')
      .where('date', '>=', Timestamp.fromDate(start))
      .where('date', '<=', Timestamp.fromDate(end))
      .get();

    const totals: Record<string, number> = {};
    snap.docs.forEach((d) => {
      const m: any = d.data();
      const t = String(m.type);
      const v = Number(m.value) || 0;
      totals[t] = (totals[t] || 0) + v;
    });

    const elapsed = elapsedFraction(period);
    // Backward-compat: fold legacy 'talk_time' into 'phone_call_quantity'
    if (totals['talk_time']) {
      totals['phone_call_quantity'] = (totals['phone_call_quantity'] || 0) + totals['talk_time'];
    }

    const kpis = goalTypes.map((t) => {
      const value = Number(totals[t] || 0);
      const target = Number(teamGoals?.[period]?.[t] ?? 0);
      const pct = target > 0 ? Math.min((value / target) * 100, 999) : 0;
      const projected = value / elapsed;
      return { type: t, value, target, pct, projected };
    });

    // Sales total KPI
    const wholesale = Number(totals['new_sales_wholesale'] || 0);
    const distribution = Number(totals['new_sales_distribution'] || 0);
    const totalSales = wholesale + distribution;
    const salesTarget = Number(teamGoals?.[period]?.['new_sales_wholesale'] ?? 0) + Number(teamGoals?.[period]?.['new_sales_distribution'] ?? 0);
    const salesPct = salesTarget > 0 ? Math.min((totalSales / salesTarget) * 100, 999) : 0;
    const salesProjected = totalSales / elapsed;

    const res = NextResponse.json({ period, kpis, sales: { total: totalSales, target: salesTarget, pct: salesPct, projected: salesProjected } });
    res.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=60');
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to compute team KPIs' }, { status: 500 });
  }
}

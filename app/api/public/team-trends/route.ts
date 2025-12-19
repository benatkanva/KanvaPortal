import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { User } from '@/types';
import { isSalesUser } from '@/lib/utils/userFilters';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getRange(period: string) {
  const now = new Date();
  let days = 30;
  if (period === 'daily') days = 7; // last 7 days
  if (period === 'weekly') days = 30; // last 30 days
  if (period === 'monthly') days = 90; // last 90 days
  const start = new Date(now); start.setDate(now.getDate() - (days - 1)); start.setHours(0,0,0,0);
  return { start, end: now };
}

export async function GET(req: NextRequest) {
  try {
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

    const snap = await adminDb
      .collection('metrics')
      .where('date', '>=', Timestamp.fromDate(start))
      .where('date', '<=', Timestamp.fromDate(end))
      .get();

    // Bucket by day and type (only for sales users)
    const byDay: Record<string, Record<string, number>> = {};
    snap.docs.forEach((d) => {
      const m: any = d.data();
      const userId = String(m.userId);
      
      // Only include metrics from sales users
      if (!salesUserIds.includes(userId)) {
        return;
      }
      
      const day = (m.date?.toDate?.() as Date || new Date(m.date)).toISOString().slice(0,10);
      const t = String(m.type);
      const v = Number(m.value) || 0;
      if (!byDay[day]) byDay[day] = {} as any;
      byDay[day][t] = (byDay[day][t] || 0) + v;
    });

    // Produce sorted series (ascending by day)
    const days: string[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d).toISOString().slice(0,10));
    }
    const types = ['phone_call_quantity','talk_time_minutes','email_quantity','sms_quantity','lead_progression_a','lead_progression_b','lead_progression_c','new_sales_wholesale','new_sales_distribution'];
    const series: Record<string, { date: string; value: number }[]> = {} as any;
    types.forEach((t) => {
      series[t] = days.map((day) => {
        let v = Number(byDay[day]?.[t] || 0);
        // Backward-compat: fold legacy talk_time into phone_call_quantity
        if (t === 'phone_call_quantity') {
          v += Number(byDay[day]?.['talk_time'] || 0);
        }
        return { date: day, value: v };
      });
    });

    return NextResponse.json({ period, series });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load team trends' }, { status: 500 });
  }
}

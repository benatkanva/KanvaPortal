import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

const COPPER_API_BASE = 'https://api.copper.com/developer_api/v1';
const COPPER_API_KEY = process.env.COPPER_API_KEY!;
const COPPER_USER_EMAIL = process.env.COPPER_USER_EMAIL!;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function fetchWithRetry(url: string, init: RequestInit = {}, retries = 3, baseDelayMs = 300): Promise<Response> {
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

async function fetchAll(endpoint: string, body: any) {
  const all: any[] = [];
  const pageSize = Number(body?.page_size) || 200;
  let page = 1;
  while (true) {
    const res = await fetchWithRetry(`${COPPER_API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'X-PW-AccessToken': COPPER_API_KEY,
        'X-PW-Application': 'developer_api',
        'X-PW-UserEmail': COPPER_USER_EMAIL,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...body, page_number: page, page_size: pageSize }),
    });
    if (!res.ok) break;
    const chunk = await res.json();
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    all.push(...chunk);
    if (chunk.length < pageSize) break;
    page += 1;
    if (page > 25) break; // safety cap
  }
  return all;
}

function activitySeconds(a: any): number | undefined {
  const sec = typeof a?.activity_date === 'number' ? a.activity_date : undefined;
  if (typeof sec === 'number' && sec > 0) return sec;
  if (a?.date_created) return Math.floor(new Date(a.date_created).getTime() / 1000);
  if (a?.date_modified) return Math.floor(new Date(a.date_modified).getTime() / 1000);
  return undefined;
}

export async function GET(_req: NextRequest) {
  try {
    if (!COPPER_API_KEY || !COPPER_USER_EMAIL) {
      return NextResponse.json({ success: false, error: 'Server missing COPPER_API_KEY/COPPER_USER_EMAIL' }, { status: 500 });
    }

    const metaSnap = await adminDb.collection('settings').doc('copper_metadata').get();
    const meta = metaSnap.exists ? (metaSnap.data() as any) : {};
    const defaults = meta?.defaults || {};
    let emailActivityId = Number(defaults.emailActivityId || 0) || 0;
    let phoneCallActivityId = Number(defaults.phoneCallActivityId || 0) || 0;
    let emailCategory: 'user' | 'system' | undefined;
    let phoneCategory: 'user' | 'system' | undefined;

    // Fallback: auto-derive from Copper activity_types when defaults are missing
    if (!emailActivityId || !phoneCallActivityId) {
      const res = await fetchWithRetry(`${COPPER_API_BASE}/activity_types`, {
        method: 'GET',
        headers: {
          'X-PW-AccessToken': COPPER_API_KEY,
          'X-PW-Application': 'developer_api',
          'X-PW-UserEmail': COPPER_USER_EMAIL,
        },
      });
      const types = await res.json();
      if (Array.isArray(types)) {
        const nameMatch = (t: any, kw: RegExp) => kw.test(String(t?.name || '').toLowerCase());
        if (!emailActivityId) {
          const sysEmail = types.find((t: any) => nameMatch(t,/email/) && String(t?.category)==='system');
          const userEmail = types.find((t: any) => nameMatch(t,/email/) && String(t?.category)==='user');
          emailActivityId = Number((sysEmail?.id ?? userEmail?.id) || 0) || 0;
          emailCategory = (sysEmail ? 'system' : (userEmail ? 'user' : undefined)) as any;
        }
        if (!phoneCallActivityId) {
          const userCall = types.find((t: any) => nameMatch(t,/phone|call/) && String(t?.category)==='user');
          phoneCallActivityId = Number((userCall?.id) || 0) || 0;
          phoneCategory = userCall ? 'user' : undefined;
        }
        if (!emailCategory && emailActivityId) {
          const t = types.find((t:any)=> Number(t?.id)===emailActivityId);
          if (t) emailCategory = t.category;
        }
        if (!phoneCategory && phoneCallActivityId) {
          const t = types.find((t:any)=> Number(t?.id)===phoneCallActivityId);
          if (t) phoneCategory = t.category;
        }
      }
    }

    const now = new Date();
    const since = new Date(now); since.setDate(now.getDate() - 1);
    const min = Math.floor(since.getTime() / 1000);
    const max = Math.floor(now.getTime() / 1000);

    const results: any = { window: { start: since.toISOString(), end: now.toISOString() } };

    if (emailActivityId) {
      const emails = await fetchAll('/activities/search', {
        sort_by: 'activity_date',
        sort_direction: 'desc',
        full_result: true,
        activity_types: [{ id: emailActivityId, category: emailCategory || (emailActivityId === 6 ? 'system' : 'user') }],
        minimum_activity_date: min,
        maximum_activity_date: max,
      });
      results.email_quantity = Array.isArray(emails) ? emails.length : 0;
    }

    if (phoneCallActivityId) {
      const calls = await fetchAll('/activities/search', {
        sort_by: 'activity_date',
        sort_direction: 'desc',
        full_result: true,
        activity_types: [{ id: phoneCallActivityId, category: phoneCategory || 'user' }],
        minimum_activity_date: min,
        maximum_activity_date: max,
      });
      let count = 0; let minutes = 0;
      for (const c of Array.isArray(calls) ? calls : []) {
        const ts = activitySeconds(c); if (!ts) continue;
        count += 1;
        if (typeof c?.duration === 'number') minutes += c.duration;
      }
      results.phone_call_quantity = count;
      results.talk_time_minutes = minutes;
    }

    return NextResponse.json({ success: true, results, defaults: { emailActivityId, phoneCallActivityId } });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Validation failed' }, { status: 500 });
  }
}

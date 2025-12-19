import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

const COPPER_API_BASE = 'https://api.copper.com/developer_api/v1';
const COPPER_API_KEY = process.env.COPPER_API_KEY!;
const COPPER_USER_EMAIL = process.env.COPPER_USER_EMAIL!;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function fetchWithRetry(url: string, init: RequestInit = {}, retries = 4, baseDelayMs = 400): Promise<Response> {
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

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetchWithRetry(url, init);
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text as any; }
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
    if (page > 10) break; // safety cap
  }
  return all;
}

async function gatherMetadata() {
  const userMe = await fetchJson(`${COPPER_API_BASE}/users/me`, {
    headers: {
      'X-PW-AccessToken': COPPER_API_KEY,
      'X-PW-Application': 'developer_api',
      'X-PW-UserEmail': COPPER_USER_EMAIL,
      'Content-Type': 'application/json',
    },
  });

  const customFieldDefinitions = await fetchJson(`${COPPER_API_BASE}/custom_field_definitions`, {
    headers: {
      'X-PW-AccessToken': COPPER_API_KEY,
      'X-PW-Application': 'developer_api',
      'X-PW-UserEmail': COPPER_USER_EMAIL,
      'Content-Type': 'application/json',
    },
  });

  // Sample recent activities (last 30 days) to discover activity_type_id values
  const now = new Date();
  const start = new Date();
  start.setDate(now.getDate() - 30);
  const sampleActivities = await fetchAll('/activities/search', {
    sort_by: 'activity_date',
    sort_direction: 'desc',
    minimum_activity_date: Math.floor(start.getTime() / 1000),
    maximum_activity_date: Math.floor(now.getTime() / 1000),
    page_size: 100,
  });

  const activityTypeSummary: Record<string, number> = {};
  for (const a of sampleActivities) {
    const id = String(a?.activity_type_id ?? 'unknown');
    activityTypeSummary[id] = (activityTypeSummary[id] || 0) + 1;
  }

  // Fetch activity types catalog to resolve human names → IDs
  let activityTypes: any[] = [];
  try {
    activityTypes = await fetchJson(`${COPPER_API_BASE}/activity_types`, {
      headers: {
        'X-PW-AccessToken': COPPER_API_KEY,
        'X-PW-Application': 'developer_api',
        'X-PW-UserEmail': COPPER_USER_EMAIL,
        'Content-Type': 'application/json',
      },
    });
  } catch {}

  // Heuristics to propose defaults
  let suggestedEmailId: number | null = null;
  let suggestedPhoneCallId: number | null = null;
  const typeList = Array.isArray(activityTypes) ? activityTypes : [];
  for (const t of typeList) {
    const name = String(t?.name || '').toLowerCase();
    if (!suggestedEmailId && /email/.test(name)) suggestedEmailId = Number(t?.id);
    if (!suggestedPhoneCallId && /phone|call/.test(name)) suggestedPhoneCallId = Number(t?.id);
  }

  return {
    fetchedAt: new Date().toISOString(),
    user: userMe,
    customFieldDefinitions,
    sampleActivitiesCount: Array.isArray(sampleActivities) ? sampleActivities.length : 0,
    activityTypeSummary,
    activityTypes,
    suggestedDefaults: {
      emailActivityId: suggestedEmailId,
      phoneCallActivityId: suggestedPhoneCallId,
    },
  };
}

export async function GET(_req: NextRequest) {
  try {
    if (!COPPER_API_KEY || !COPPER_USER_EMAIL) {
      return NextResponse.json({ success: false, error: 'Server missing COPPER_API_KEY/COPPER_USER_EMAIL' }, { status: 500 });
    }
    const data = await gatherMetadata();
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Failed to load Copper metadata' }, { status: 500 });
  }
}

export async function POST(_req: NextRequest) {
  try {
    if (!COPPER_API_KEY || !COPPER_USER_EMAIL) {
      return NextResponse.json({ success: false, error: 'Server missing COPPER_API_KEY/COPPER_USER_EMAIL' }, { status: 500 });
    }
    const data = await gatherMetadata();
    // Save to Firestore org-wide metadata document using Admin SDK
    await adminDb.collection('settings').doc('copper_metadata').set(data, { merge: true });
    // Also persist suggested defaults if not already set
    if (data?.suggestedDefaults) {
      await adminDb.collection('settings').doc('copper_metadata').set({
        defaults: {
          emailActivityId: data.suggestedDefaults.emailActivityId ?? null,
          phoneCallActivityId: data.suggestedDefaults.phoneCallActivityId ?? null,
        },
      }, { merge: true });
    }
    return NextResponse.json({ success: true, saved: true, data });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Failed to save Copper metadata' }, { status: 500 });
  }
}

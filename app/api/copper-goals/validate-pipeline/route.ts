import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getOpportunityStageId } from '@/lib/copper/field-mappings';

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
    const text = await res.text().catch(()=> '');
    lastErr = new Error(`${url} -> ${res.status} ${text}`);
    break;
  }
  throw lastErr || new Error('Copper request failed');
}

export async function GET(_req: NextRequest) {
  try {
    if (!COPPER_API_KEY || !COPPER_USER_EMAIL) {
      return NextResponse.json({ success: false, error: 'Server missing COPPER_API_KEY/COPPER_USER_EMAIL' }, { status: 500 });
    }

    const metaSnap = await adminDb.collection('settings').doc('copper_metadata').get();
    const meta = metaSnap.exists ? (metaSnap.data() as any) : {};
    const d = meta?.defaults || {};

    const pipelineId = Number(d.SALES_PIPELINE_ID || 0) || 0;
    const ownerEmail = String(d.validateOwnerEmail || '').toLowerCase().trim();

    // Optionally map owner email to Copper id (if provided)
    let ownerId: number | undefined;
    if (ownerEmail) {
      const resUsers = await fetchWithRetry(`${COPPER_API_BASE}/users`, {
        method: 'GET',
        headers: {
          'X-PW-AccessToken': COPPER_API_KEY,
          'X-PW-Application': 'developer_api',
          'X-PW-UserEmail': COPPER_USER_EMAIL,
        },
      });
      const allUsers = await resUsers.json();
      if (Array.isArray(allUsers)) {
        const u = allUsers.find((u:any)=> String(u?.email||'').toLowerCase().trim()===ownerEmail);
        if (u?.id) ownerId = Number(u.id);
      }
    }

    const body: any = {
      sort_by: 'date_modified',
      sort_direction: 'desc',
      pipeline_ids: pipelineId ? [pipelineId] : undefined,
      page_size: 50,
      ...(ownerId ? { owner_ids: [ownerId] } : {}),
    };

    const res = await fetchWithRetry(`${COPPER_API_BASE}/opportunities/search`, {
      method: 'POST',
      headers: {
        'X-PW-AccessToken': COPPER_API_KEY,
        'X-PW-Application': 'developer_api',
        'X-PW-UserEmail': COPPER_USER_EMAIL,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const arr = await res.json().catch(()=>[]);
    if (!Array.isArray(arr)) {
      return NextResponse.json({ success: false, error: 'Unexpected response for opportunities' }, { status: 500 });
    }

    // Resolve stage_id -> stage_name from pipelines
    let stageMap: Record<string, string> = {};
    try {
      const resP = await fetchWithRetry(`${COPPER_API_BASE}/pipelines`, {
        method: 'GET',
        headers: {
          'X-PW-AccessToken': COPPER_API_KEY,
          'X-PW-Application': 'developer_api',
          'X-PW-UserEmail': COPPER_USER_EMAIL,
        },
      });
      const pipes = await resP.json().catch(()=>[]);
      if (Array.isArray(pipes)) {
        const p = pipes.find((p:any)=> Number(p?.id)===pipelineId);
        const stages = Array.isArray(p?.stages) ? p.stages : [];
        for (const s of stages) {
          if (s?.id && s?.name) stageMap[String(s.id)] = String(s.name);
        }
      }
    } catch {}

    const stagesFound = new Set<string>();
    const stageIdsFound = new Set<string>();
    for (const o of arr) {
      // Use helper function for consistent field access
      const sid = getOpportunityStageId(o);
      const snameRaw = o?.stage_name ?? o?.stage?.name;
      const sname = sid && stageMap[sid] ? stageMap[sid] : (snameRaw ? String(snameRaw) : undefined);
      if (sname) stagesFound.add(sname);
      if (sid) stageIdsFound.add(sid);
    }

    const sampleDebug = arr.slice(0, 3).map((o:any)=>({
      id: o?.id,
      pipeline_stage_id: getOpportunityStageId(o),
      stage_name: o?.stage_name,
    }));

    return NextResponse.json({ success: true, count: arr.length, pipelineId, ownerId, sampleStages: Array.from(stagesFound).slice(0, 20), sampleStageIds: Array.from(stageIdsFound).slice(0, 20), sampleDebug });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Pipeline validation failed' }, { status: 500 });
  }
}

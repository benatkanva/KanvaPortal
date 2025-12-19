'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChange, auth } from '@/lib/firebase/client';
import { settingsService } from '@/lib/firebase/services';
import Link from 'next/link';

const periods = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'Last 30 days' },
] as const;

type Period = (typeof periods)[number]['value'];

export default function AdminPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('today');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);
  const [emailActivityId, setEmailActivityId] = useState<string>('1');
  const [copperUserEmail, setCopperUserEmail] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [wholesaleKeywords, setWholesaleKeywords] = useState<string>('Focus+Flow, Zoom');
  const [distributionKeywords, setDistributionKeywords] = useState<string>('');
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  // Copper metadata/defaults state
  const [metaLoading, setMetaLoading] = useState(false);
  const [meta, setMeta] = useState<any>(null);
  const [defaultsLoading, setDefaultsLoading] = useState(false);
  const [defaults, setDefaults] = useState<any>({
    copperUserEmail: '',
    emailActivityId: '',
    phoneCallActivityId: '',
    SALES_PIPELINE_ID: '',
    PRODUCT_FIELD_ID: '',
    CLOSED_WON_STAGES: '', // comma-separated
    STAGE_MAPPING: '{"Fact Finding":"lead_progression_a","Contact Stage":"lead_progression_b","Closing Stage":"lead_progression_c"}',
  });
  const [teamGoals, setTeamGoals] = useState<Record<string, any>>({
    daily: {
      phone_call_quantity: 0,
      email_quantity: 0,
      lead_progression_a: 0,
      lead_progression_b: 0,
      lead_progression_c: 0,
      new_sales_wholesale: 0,
      new_sales_distribution: 0,
    },
    weekly: {
      phone_call_quantity: 0,
      email_quantity: 0,
      lead_progression_a: 0,
      lead_progression_b: 0,
      lead_progression_c: 0,
      new_sales_wholesale: 0,
      new_sales_distribution: 0,
    },
    monthly: {
      phone_call_quantity: 0,
      email_quantity: 0,
      lead_progression_a: 0,
      lead_progression_b: 0,
      lead_progression_c: 0,
      new_sales_wholesale: 0,
      new_sales_distribution: 0,
    },
  });
  const [showPwd, setShowPwd] = useState(false);
  const [pwdInput, setPwdInput] = useState('');
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);
  const [backfillMetricsLoading, setBackfillMetricsLoading] = useState(false);
  const [backfillMetricsMsg, setBackfillMetricsMsg] = useState<string | null>(null);
  const [wipeLoading, setWipeLoading] = useState(false);
  const [wipeMsg, setWipeMsg] = useState<string | null>(null);
  const [wipeConfirm, setWipeConfirm] = useState('');
  // Activity Types discovery & mapping
  const [actTypesLoading, setActTypesLoading] = useState(false);
  const [actTypes, setActTypes] = useState<any[]>([]);
  const [actTypesMsg, setActTypesMsg] = useState<string | null>(null);
  const [selectedEmailType, setSelectedEmailType] = useState<{id:string, category:string}>({ id: '', category: 'system' });
  const [selectedCallType, setSelectedCallType] = useState<{id:string, category:string}>({ id: '', category: 'user' });
  const [actTypesRaw, setActTypesRaw] = useState<any>(null);
  // JustCall master sync
  const [justCallSyncLoading, setJustCallSyncLoading] = useState(false);
  const [justCallSyncMsg, setJustCallSyncMsg] = useState<string | null>(null);
  const [justCallSyncResults, setJustCallSyncResults] = useState<any>(null);
  
  const syncAllJustCall = async () => {
    setJustCallSyncLoading(true);
    setJustCallSyncMsg(null);
    setJustCallSyncResults(null);
    try {
      const res = await fetch('/api/admin/sync-all-justcall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Sync failed');
      setJustCallSyncResults(data);
      setJustCallSyncMsg(`✅ ${data.message} - ${data.totalCalls} calls, ${data.totalMetrics} metrics`);
    } catch (e: any) {
      setJustCallSyncMsg(`❌ ${e.message || 'Sync failed'}`);
    } finally {
      setJustCallSyncLoading(false);
    }
  };

  const exportCsv = async () => {
    try {
      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate ? new Date(startDate) : new Date(new Date().setDate(end.getDate() - 90));
      const url = `/api/admin/export-metrics?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}&salesOnly=1`;
      // trigger download
      window.location.href = url;
    } catch {}
  };

  const wipeMetrics = async () => {
    if (wipeConfirm.trim().toUpperCase() !== 'WIPE') {
      setWipeMsg('Type WIPE to confirm.');
      return;
    }
    setWipeLoading(true);
    setWipeMsg(null);
    try {
      const current = auth.currentUser;
      if (!current) throw new Error('Not signed in');
      const token = await current.getIdToken(true);
      const payload: any = {};
      if (startDate) payload.start = new Date(startDate).toISOString();
      if (endDate) payload.end = new Date(endDate).toISOString();
      const res = await fetch('/api/admin/wipe-metrics', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Wipe failed');
      setWipeMsg('Metrics wiped successfully');
    } catch (e:any) {
      setWipeMsg(e.message || 'Wipe failed');
    } finally {
      setWipeLoading(false);
    }
  };

  const backfillSalesMetrics = async () => {
    setBackfillMetricsLoading(true);
    setBackfillMetricsMsg(null);
    try {
      const current = auth.currentUser;
      if (!current) throw new Error('Not signed in');
      const token = await current.getIdToken(true);
      // default window: last 90 days
      const endD = endDate ? new Date(endDate) : new Date();
      const startD = startDate ? new Date(startDate) : new Date(new Date().setDate(endD.getDate() - 90));
      const res = await fetch('/api/admin/backfill-sales-metrics', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ start: startD.toISOString(), end: endD.toISOString() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Backfill metrics failed');
      setBackfillMetricsMsg(`Processed=${data.processed}, ok=${data.ok}, failed=${data.failed}`);
    } catch (e: any) {
      setBackfillMetricsMsg(e.message || 'Backfill metrics failed');
    } finally {
      setBackfillMetricsLoading(false);
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChange(async (u) => {
      setUid(u?.uid ?? null);
      if (u?.uid) {
        setSettingsLoading(true);
        setSettingsMsg(null);
        try {
          const s = await settingsService.getSettings(u.uid);
          if (s) {
            if (s.emailActivityId != null) setEmailActivityId(String(s.emailActivityId));
            if (s.wholesaleKeywords) setWholesaleKeywords(Array.isArray(s.wholesaleKeywords) ? s.wholesaleKeywords.join(', ') : String(s.wholesaleKeywords));
            if (s.distributionKeywords) setDistributionKeywords(Array.isArray(s.distributionKeywords) ? s.distributionKeywords.join(', ') : String(s.distributionKeywords));
            if ((s as any).lastSyncAt) setLastSyncAt(String((s as any).lastSyncAt));
          }
          // Load team goals via public API to avoid client Firestore permission issues
          try {
            const res = await fetch('/api/public/team-goals');
            const data = await res.json();
            if (res.ok && data?.teamGoals) {
              setTeamGoals((prev) => ({ ...prev, ...data.teamGoals }));
            }
          } catch {}
        } finally {
          setSettingsLoading(false);
        }
      }
    });
    return () => unsub();
  }, []);

  const syncNow = async () => {
    if (!uid) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const body: any = { userId: uid, period } as any;
      if (startDate) body.start = new Date(startDate).toISOString();
      if (endDate) body.end = new Date(endDate).toISOString();
      if (copperUserEmail) body.copperUserEmail = copperUserEmail;

      const res = await fetch('/api/sync-metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Sync failed');
      setResult(data);
      // Refresh lastSyncAt from settings
      try {
        const s = await settingsService.getSettings(uid);
        if ((s as any)?.lastSyncAt) setLastSyncAt(String((s as any).lastSyncAt));
      } catch {}
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  // Admin backfill: mirror existing Auth users into Firestore users/{uid}
  const backfillUsers = async () => {
    setBackfillLoading(true);
    setBackfillMsg(null);
    try {
      const current = auth.currentUser;
      if (!current) throw new Error('Not signed in');
      const token = await current.getIdToken(true);
      const res = await fetch('/api/admin/backfill-users', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Backfill failed');
      setBackfillMsg(`Backfill ok. processed=${data.processed}, created=${data.created}, updated=${data.updated}`);
    } catch (e: any) {
      setBackfillMsg(e.message || 'Backfill failed');
    } finally {
      setBackfillLoading(false);
    }
  };

  const handleGoalChange = (periodKey: 'daily'|'weekly'|'monthly', field: string, value: number) => {
    setTeamGoals(prev => ({
      ...prev,
      [periodKey]: { ...prev[periodKey], [field]: value }
    }));
  };

  const saveTeamGoals = async () => {
    // Open password modal first (inline client-side guard)
    setPwdInput('');
    setPwdError(null);
    setShowPwd(true);
  };

  const confirmTeamGoalsSave = async () => {
    if (!pwdInput) {
      setPwdError('Passcode required.');
      return;
    }
    setShowPwd(false);
    setSettingsLoading(true);
    setSettingsMsg(null);
    try {
      const res = await fetch('/api/admin/team-goals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-pass': pwdInput,
        },
        body: JSON.stringify(teamGoals),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to save team goals');
      setSettingsMsg('Team goals saved');
    } catch (e: any) {
      setSettingsMsg(e.message || 'Failed to save team goals');
    } finally {
      setSettingsLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!uid) return;
    setSettingsLoading(true);
    setSettingsMsg(null);
    try {
      await settingsService.updateSettings(uid, {
        emailActivityId: Number(emailActivityId) || 1,
        wholesaleKeywords: wholesaleKeywords,
        distributionKeywords: distributionKeywords,
      });
      setSettingsMsg('Settings saved');
    } catch (e: any) {
      setSettingsMsg(e.message || 'Failed to save settings');
    } finally {
      setSettingsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">My Settings</h1>
      {!uid && (
        <p className="text-sm text-gray-600">Sign in to manage your settings.</p>
      )}

      {uid && (
        <div className="space-y-6">
          {/* Team Goals */}
          <section className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-medium mb-2">Team Goals</h2>
            <p className="text-sm text-gray-600 mb-4">Set organization-wide targets. Users will still have individual goals.</p>
            {(['daily','weekly','monthly'] as const).map(periodKey => (
              <div key={periodKey} className="mb-6">
                <h3 className="text-sm font-semibold text-gray-800 mb-2 capitalize">{periodKey}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <label className="block">
                    <span className="text-sm text-gray-600">Phone Calls</span>
                    <input type="number" className="mt-1 w-full border rounded-md px-3 py-2" value={teamGoals[periodKey].phone_call_quantity ?? 0}
                      onChange={(e)=>handleGoalChange(periodKey,'phone_call_quantity',Number(e.target.value))} />
                  </label>
                  <label className="block">
                    <span className="text-sm text-gray-600">Emails</span>
                    <input type="number" className="mt-1 w-full border rounded-md px-3 py-2" value={teamGoals[periodKey].email_quantity ?? 0}
                      onChange={(e)=>handleGoalChange(periodKey,'email_quantity',Number(e.target.value))} />
                  </label>
                  <label className="block">
                    <span className="text-sm text-gray-600">Fact Finding (A)</span>
                    <input type="number" className="mt-1 w-full border rounded-md px-3 py-2" value={teamGoals[periodKey].lead_progression_a ?? 0}
                      onChange={(e)=>handleGoalChange(periodKey,'lead_progression_a',Number(e.target.value))} />
                  </label>
                  <label className="block">
                    <span className="text-sm text-gray-600">Contact Stage (B)</span>
                    <input type="number" className="mt-1 w-full border rounded-md px-3 py-2" value={teamGoals[periodKey].lead_progression_b ?? 0}
                      onChange={(e)=>handleGoalChange(periodKey,'lead_progression_b',Number(e.target.value))} />
                  </label>
                  <label className="block">
                    <span className="text-sm text-gray-600">Closing Stage (C)</span>
                    <input type="number" className="mt-1 w-full border rounded-md px-3 py-2" value={teamGoals[periodKey].lead_progression_c ?? 0}
                      onChange={(e)=>handleGoalChange(periodKey,'lead_progression_c',Number(e.target.value))} />
                  </label>
                  <label className="block">
                    <span className="text-sm text-gray-600">Wholesale Sales ($)</span>
                    <input type="number" className="mt-1 w-full border rounded-md px-3 py-2" value={teamGoals[periodKey].new_sales_wholesale ?? 0}
                      onChange={(e)=>handleGoalChange(periodKey,'new_sales_wholesale',Number(e.target.value))} />
                  </label>
                  <label className="block">
                    <span className="text-sm text-gray-600">Distribution Sales ($)</span>
                    <input type="number" className="mt-1 w-full border rounded-md px-3 py-2" value={teamGoals[periodKey].new_sales_distribution ?? 0}
                      onChange={(e)=>handleGoalChange(periodKey,'new_sales_distribution',Number(e.target.value))} />
                  </label>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-3">
              <button onClick={saveTeamGoals} disabled={settingsLoading} className={`px-4 py-2 rounded-lg text-white ${settingsLoading ? 'bg-gray-400' : 'bg-kanva-green hover:bg-green-600'}`}>{settingsLoading ? 'Saving…' : 'Save Team Goals'}</button>
              {settingsMsg && <span className="text-sm text-gray-600">{settingsMsg}</span>}
            </div>
          </section>

          

          {/* Copper Metadata & Defaults */}
          <section className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-medium">Copper Metadata</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={async()=>{
                    setMetaLoading(true);
                    try {
                      const res = await fetch('/api/copper/metadata', { method: 'GET' });
                      const data = await res.json();
                      setActTypesRaw(data);
                      if (!res.ok) throw new Error(data?.error || 'Failed to load metadata');
                      setMeta(data?.data || data);
                    } catch (e:any) {
                      setMeta({ error: e.message || 'Failed to load metadata' });
                    } finally {
                      setMetaLoading(false);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-gray-100 text-sm"
                >Load</button>
                <button
                  onClick={async()=>{
                    setMetaLoading(true);
                    try {
                      const res = await fetch('/api/copper/metadata', { method: 'POST' });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data?.error || 'Failed to fetch & save metadata');
                      setMeta(data?.data || data);
                    } catch (e:any) {
                      setMeta({ error: e.message || 'Failed to save metadata' });
                    } finally {
                      setMetaLoading(false);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-gray-100 text-sm"
                >Fetch & Save</button>
                {/* Removed duplicate Validate button to reduce confusion */}
              </div>
              {/* Debug payload removed from header; activity types UI lives in Discover Activity Types section below */}
            </div>
            <p className="text-sm text-gray-600 mb-4">Discover activity type IDs and custom field definitions, and store org-wide defaults used by the sync.</p>
            {metaLoading && <div className="text-sm text-gray-600">Loading metadata…</div>}
            {meta && (
              <pre className="p-3 bg-gray-50 border rounded text-xs overflow-auto max-h-64">{JSON.stringify(meta, null, 2)}</pre>
            )}

            <h3 className="text-md font-medium mt-4 mb-2">Org Defaults</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block md:col-span-2">
                <span className="text-sm text-gray-600">Copper Org User Email (identity for Copper API)</span>
                <input value={defaults.copperUserEmail} onChange={(e)=>setDefaults({...defaults, copperUserEmail:e.target.value})} className="mt-1 w-full border rounded-md px-3 py-2" placeholder="e.g. integrations@kanvabotanicals.com" />
              </label>
              <label className="block">
                <span className="text-sm text-gray-600">Email Activity Type ID</span>
                <input value={defaults.emailActivityId} onChange={(e)=>setDefaults({...defaults, emailActivityId:e.target.value})} className="mt-1 w-full border rounded-md px-3 py-2" placeholder="e.g. 1" />
              </label>
              <label className="block">
                <span className="text-sm text-gray-600">Phone Call Activity Type ID</span>
                <input value={defaults.phoneCallActivityId} onChange={(e)=>setDefaults({...defaults, phoneCallActivityId:e.target.value})} className="mt-1 w-full border rounded-md px-3 py-2" placeholder="e.g. 0" />
              </label>
              <label className="block">
                <span className="text-sm text-gray-600">Sales Pipeline ID</span>
                <input value={defaults.SALES_PIPELINE_ID} onChange={(e)=>setDefaults({...defaults, SALES_PIPELINE_ID:e.target.value})} className="mt-1 w-full border rounded-md px-3 py-2" placeholder="e.g. 1084986" />
              </label>
              <label className="block">
                <span className="text-sm text-gray-600">Product Field ID (custom field)</span>
                <input value={defaults.PRODUCT_FIELD_ID} onChange={(e)=>setDefaults({...defaults, PRODUCT_FIELD_ID:e.target.value})} className="mt-1 w-full border rounded-md px-3 py-2" placeholder="e.g. 705070" />
              </label>
              <label className="block md:col-span-2">
                <span className="text-sm text-gray-600">Closed Won Stages (comma-separated)</span>
                <input value={defaults.CLOSED_WON_STAGES} onChange={(e)=>setDefaults({...defaults, CLOSED_WON_STAGES:e.target.value})} className="mt-1 w-full border rounded-md px-3 py-2" placeholder="Payment Received/Invoice Created" />
              </label>
              <label className="block md:col-span-2">
                <span className="text-sm text-gray-600">Stage Mapping (JSON object of stageName → metricType)</span>
                <textarea value={defaults.STAGE_MAPPING} onChange={(e)=>setDefaults({...defaults, STAGE_MAPPING:e.target.value})} className="mt-1 w-full border rounded-md px-3 py-2 h-28 font-mono text-xs" />
              </label>
            </div>
            <div className="flex items-center gap-3 mt-3">
              <button
                onClick={async()=>{
                  setDefaultsLoading(true);
                  try {
                    // Build payload
                    let payload:any = { ...defaults };
                    try { payload.SALES_PIPELINE_ID = Number(payload.SALES_PIPELINE_ID)||undefined; } catch {}
                    try { payload.PRODUCT_FIELD_ID = Number(payload.PRODUCT_FIELD_ID)||undefined; } catch {}
                    try { payload.emailActivityId = Number(payload.emailActivityId)||undefined; } catch {}
                    try { payload.phoneCallActivityId = Number(payload.phoneCallActivityId)||undefined; } catch {}
                    try { if (typeof payload.CLOSED_WON_STAGES === 'string') payload.CLOSED_WON_STAGES = payload.CLOSED_WON_STAGES.split(',').map((s:string)=>s.trim()).filter(Boolean); } catch {}
                    try { if (typeof payload.STAGE_MAPPING === 'string') payload.STAGE_MAPPING = JSON.parse(payload.STAGE_MAPPING); } catch {}

                    const res = await fetch('/api/copper/defaults', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ defaults: payload }) });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data?.error || 'Failed to save defaults');
                    setSettingsMsg('Org defaults saved');
                  } catch (e:any) {
                    setSettingsMsg(e.message || 'Failed to save defaults');
                  } finally {
                    setDefaultsLoading(false);
                  }
                }}
                className={`px-4 py-2 rounded-lg text-white ${defaultsLoading ? 'bg-gray-400' : 'bg-kanva-green hover:bg-green-600'}`}
              >{defaultsLoading ? 'Saving…' : 'Save Org Defaults'}</button>

              <button
                onClick={async()=>{
                  setDefaultsLoading(true);
                  try {
                    const res = await fetch('/api/copper/defaults');
                    const data = await res.json();
                    if (!res.ok) throw new Error(data?.error || 'Failed to load defaults');
                    const d = data?.defaults || {};
                    setDefaults({
                      copperUserEmail: d.copperUserEmail ? String(d.copperUserEmail) : '',
                      emailActivityId: d.emailActivityId ? String(d.emailActivityId) : '',
                      phoneCallActivityId: d.phoneCallActivityId ? String(d.phoneCallActivityId) : '',
                      SALES_PIPELINE_ID: d.SALES_PIPELINE_ID ? String(d.SALES_PIPELINE_ID) : '',
                      PRODUCT_FIELD_ID: d.PRODUCT_FIELD_ID ? String(d.PRODUCT_FIELD_ID) : '',
                      CLOSED_WON_STAGES: Array.isArray(d.CLOSED_WON_STAGES) ? d.CLOSED_WON_STAGES.join(', ') : (d.CLOSED_WON_STAGES||''),
                      STAGE_MAPPING: d.STAGE_MAPPING ? JSON.stringify(d.STAGE_MAPPING) : defaults.STAGE_MAPPING,
                    });
                    setSettingsMsg('Org defaults loaded');
                  } catch (e:any) {
                    setSettingsMsg(e.message || 'Failed to load defaults');
                  } finally {
                    setDefaultsLoading(false);
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-gray-100 text-sm"
              >Load Org Defaults</button>
            </div>
          </section>
          {/* Password Modal */}
          {showPwd && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-kanva-green text-white grid place-items-center shadow-kanva">🔒</div>
                  <h3 className="text-lg font-semibold">Confirm Admin Action</h3>
                </div>
                <p className="text-sm text-gray-600 mb-3">Enter the admin passcode to save Team Goals.</p>
                <input
                  type="password"
                  value={pwdInput}
                  onChange={(e)=>{ setPwdInput(e.target.value); setPwdError(null);} }
                  className="w-full border rounded-md px-3 py-2"
                  placeholder="Admin passcode"
                  autoFocus
                />
                {pwdError && <p className="mt-2 text-sm text-red-600">{pwdError}</p>}
                <div className="mt-5 flex items-center justify-end gap-3">
                  <button onClick={()=>setShowPwd(false)} className="px-4 py-2 rounded-lg bg-gray-100">Cancel</button>
                  <button onClick={confirmTeamGoalsSave} className="px-4 py-2 rounded-lg text-white bg-kanva-green hover:bg-green-600">Confirm</button>
                </div>
              </div>
            </div>
          )}
          {/* Note: Per-user Sync Settings removed. Use Org Defaults in Copper Metadata section above. */}
          <section className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-medium mb-2">Data Sync</h2>
            <p className="text-sm text-gray-600 mb-4">
              Trigger a manual sync from Copper for the selected period.
            </p>
            <div className="flex items-center gap-3">
              <select
                className="border rounded-md px-3 py-2 text-sm"
                value={period}
                onChange={(e) => setPeriod(e.target.value as Period)}
              >
                {periods.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              <button
                onClick={syncNow}
                disabled={loading}
                className={`px-4 py-2 rounded-lg text-white ${loading ? 'bg-gray-400' : 'bg-kanva-green hover:bg-green-600'}`}
              >
                {loading ? 'Syncing…' : 'Sync Now'}
              </button>
              {lastSyncAt && (
                <span className="text-xs text-gray-600 ml-2">Last Sync: <span className="font-medium text-gray-900">{new Date(lastSyncAt).toLocaleString()}</span></span>
              )}
            </div>
            {/* Optional overrides */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <label className="block">
                <span className="text-sm text-gray-600">Copper User Email (override)</span>
                <input value={copperUserEmail} onChange={(e)=>setCopperUserEmail(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2" placeholder="user@kanvabotanicals.com" />
              </label>
              <label className="block">
                <span className="text-sm text-gray-600">Start Date (optional)</span>
                <input type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2" />
              </label>
              <label className="block">
                <span className="text-sm text-gray-600">End Date (optional)</span>
                <input type="date" value={endDate} onChange={(e)=>setEndDate(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2" />
              </label>
            </div>
            <div className="flex items-center gap-3 mt-3">
              <button
                type="button"
                onClick={() => {
                  const end = new Date();
                  const start = new Date(); start.setDate(end.getDate() - 90);
                  setStartDate(start.toISOString().slice(0,10));
                  setEndDate(end.toISOString().slice(0,10));
                }}
                className="px-3 py-1.5 rounded-lg bg-gray-100 text-sm"
              >
                Last 90 days
              </button>
              <button
                type="button"
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="px-3 py-1.5 rounded-lg bg-gray-100 text-sm"
              >
                Clear Dates
              </button>
            </div>
            {(error || result) && (
              <pre className="mt-4 p-3 bg-gray-50 border rounded text-xs overflow-auto max-h-64">
                {error ? `Error: ${error}` : JSON.stringify(result, null, 2)}
              </pre>
            )}
          </section>

          {/* Data Export */}
          <section className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-medium">Data Export</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">Export all Sales team user metrics by day and type as CSV (Excel compatible). Uses the Start/End Dates above if provided; otherwise defaults to last 90 days.</p>
            <div className="flex items-center gap-3">
              <button
                onClick={exportCsv}
                className="px-4 py-2 rounded-lg text-white bg-kanva-green hover:bg-green-600"
                type="button"
              >Export CSV (Sales only)</button>
            </div>
          </section>

          {/* Admin Utilities */}
          <section className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-medium mb-2">Admin Utilities</h2>
            <p className="text-sm text-gray-600 mb-4">Backfill Auth → Firestore profiles for all users.</p>
            <div className="flex items-center gap-3">
              <button
                onClick={backfillUsers}
                disabled={backfillLoading}
                className={`px-4 py-2 rounded-lg text-white ${backfillLoading ? 'bg-gray-400' : 'bg-kanva-green hover:bg-green-600'}`}
              >
                {backfillLoading ? 'Backfilling…' : 'Backfill Users'}
              </button>
              {backfillMsg && <span className="text-sm text-gray-600">{backfillMsg}</span>}
            </div>
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={backfillSalesMetrics}
                disabled={backfillMetricsLoading}
                className={`px-4 py-2 rounded-lg text-white ${backfillMetricsLoading ? 'bg-gray-400' : 'bg-kanva-green hover:bg-green-600'}`}
              >
                {backfillMetricsLoading ? 'Backfilling Metrics…' : 'Backfill Sales Metrics (90d)'}
              </button>
              {backfillMetricsMsg && <span className="text-sm text-gray-600">{backfillMetricsMsg}</span>}
            </div>

            {/* Discover Activity Types */}
            <div className="mt-6 border-t pt-4">
              <h3 className="text-md font-medium mb-2">Discover Activity Types</h3>
              <p className="text-sm text-gray-600 mb-3">Fetch Copper activity types, pick Email and Phone Call, and save to org defaults.</p>
              <div className="flex items-center gap-3 mb-3">
                <button
                  onClick={async()=>{
                    setActTypesLoading(true);
                    setActTypesMsg(null);
                    try {
                      const current = auth.currentUser;
                      if (!current) throw new Error('Not signed in');
                      const token = await current.getIdToken(true);
                      const res = await fetch('/api/admin/activity-types', { headers: { Authorization: `Bearer ${token}` } });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data?.error || 'Failed to fetch activity types');
                      const arr = Array.isArray(data?.types) ? data.types : [];
                      setActTypes(arr);
                      setActTypesMsg(arr.length ? `Fetched ${arr.length} activity types` : 'No activity types returned. Check Copper permissions.');
                      const sysEmail = arr.find((t:any)=> String(t?.category)==='system' && /email/i.test(String(t?.name||'')));
                      const userCall = arr.find((t:any)=> String(t?.category)==='user' && /(phone|call)/i.test(String(t?.name||'')));
                      if (sysEmail) setSelectedEmailType({ id: String(sysEmail.id), category: 'system' });
                      if (userCall) setSelectedCallType({ id: String(userCall.id), category: 'user' });
                    } catch (e:any) {
                      setActTypesMsg(e.message || 'Failed to fetch types');
                    } finally {
                      setActTypesLoading(false);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm ${actTypesLoading ? 'bg-gray-200' : 'bg-gray-100 hover:bg-gray-200'}`}
                >{actTypesLoading ? 'Loading…' : 'Fetch Activity Types'}</button>
                {actTypesMsg && <span className="text-sm text-gray-600">{actTypesMsg}</span>}
              </div>

              {actTypes.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-sm text-gray-600">Email Activity Type</span>
                    <select
                      className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
                      value={`${selectedEmailType.id}|${selectedEmailType.category}`}
                      onChange={(e)=>{
                        const [id,cat] = e.target.value.split('|');
                        setSelectedEmailType({ id, category: cat });
                      }}
                    >
                      <option value="|system">Select…</option>
                      {actTypes.map((t:any)=> (
                        <option key={t.id} value={`${t.id}|${t.category}`}>{`${t.name} (id=${t.id}, ${t.category})`}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm text-gray-600">Phone Call Activity Type</span>
                    <select
                      className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
                      value={`${selectedCallType.id}|${selectedCallType.category}`}
                      onChange={(e)=>{
                        const [id,cat] = e.target.value.split('|');
                        setSelectedCallType({ id, category: cat });
                      }}
                    >
                      <option value="|user">Select…</option>
                      {actTypes.map((t:any)=> (
                        <option key={t.id} value={`${t.id}|${t.category}`}>{`${t.name} (id=${t.id}, ${t.category})`}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              <div className="flex items-center gap-3 mt-3">
                <button
                  onClick={async()=>{
                    try {
                      setActTypesMsg(null);
                      const current = auth.currentUser;
                      if (!current) throw new Error('Not signed in');
                      const token = await current.getIdToken(true);
                      const payload = {
                        emailActivityId: Number(selectedEmailType.id)||0,
                        emailActivityCategory: selectedEmailType.category||'system',
                        phoneCallActivityId: Number(selectedCallType.id)||0,
                        phoneCallActivityCategory: selectedCallType.category||'user',
                      };
                      if (!payload.emailActivityId || !payload.phoneCallActivityId) throw new Error('Select both Email and Phone Call types');
                      const res = await fetch('/api/admin/activity-types', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data?.error || 'Failed to save');
                      setActTypesMsg('Saved org defaults for activity types.');
                    } catch (e:any) {
                      setActTypesMsg(e.message || 'Failed to save');
                    }
                  }}
                  className="px-4 py-2 rounded-lg text-white bg-kanva-green hover:bg-green-600"
                >Save Activity Type Defaults</button>
                {actTypesMsg && <span className="text-sm text-gray-600">{actTypesMsg}</span>}
              </div>
            </div>
          </section>

          {/* JustCall Integration */}
          <section className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-medium mb-2">JustCall Integration</h2>
            <p className="text-sm text-gray-600 mb-4">View real-time calling metrics from JustCall API.</p>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <Link
                  href="/admin/justcall"
                  className="px-4 py-2 rounded-lg text-white bg-kanva-green hover:bg-green-600"
                >
                  Open JustCall Dashboard
                </Link>
                <button
                  onClick={syncAllJustCall}
                  disabled={justCallSyncLoading}
                  className="px-4 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {justCallSyncLoading ? 'Syncing All Users...' : 'Sync All JustCall Users (30d)'}
                </button>
              </div>
              {justCallSyncMsg && (
                <div className={`text-sm p-3 rounded-lg ${justCallSyncMsg.startsWith('✅') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                  {justCallSyncMsg}
                </div>
              )}
              {justCallSyncResults && (
                <div className="text-sm bg-gray-50 p-4 rounded-lg">
                  <div className="font-medium mb-2">Sync Results:</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-gray-600">Total Users:</span>
                      <span className="ml-2 font-semibold">{justCallSyncResults.totalUsers}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Matched:</span>
                      <span className="ml-2 font-semibold">{justCallSyncResults.matchedUsers}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Synced:</span>
                      <span className="ml-2 font-semibold text-green-600">{justCallSyncResults.syncedUsers}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Total Calls:</span>
                      <span className="ml-2 font-semibold">{justCallSyncResults.totalCalls}</span>
                    </div>
                  </div>
                  {justCallSyncResults.results && justCallSyncResults.results.length > 0 && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-gray-600 hover:text-gray-900">View per-user results</summary>
                      <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                        {justCallSyncResults.results.map((r: any, i: number) => (
                          <div key={i} className="flex items-center justify-between py-1 border-b border-gray-200">
                            <span className="text-gray-700">{r.userEmail}</span>
                            <span className={r.success ? 'text-green-600' : 'text-red-600'}>
                              {r.success ? `✓ ${r.totalCalls || 0} calls` : '✗ Failed'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </div>
          </section>

          <section className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-medium mb-2">Coming Soon</h2>
            <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
              <li>Daily auto-sync schedule</li>
              <li>Per-goal targets and defaults</li>
              <li>Notification preferences</li>
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}

'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { GoalPeriod, GoalType } from '@/types';
import Link from 'next/link';
import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts';

const goalTypes: GoalType[] = [
  'phone_call_quantity',
  'email_quantity',
  'sms_quantity',
  'lead_progression_a',
  'lead_progression_b',
  'lead_progression_c',
  'new_sales_wholesale',
  'new_sales_distribution',
];

const periodLabels: Record<GoalPeriod, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
};

interface TeamMember {
  userId: string;
  userName: string;
  userEmail: string;
  photoUrl?: string;
  totalSales: number;
  phoneCalls: number;
  emails: number;
  sms: number;
  leadProgression: number;
  overallScore: number;
  rank: number;
  trend: 'up' | 'down' | 'stable';
}

export default function TeamDashboardPage() {
  const [period, setPeriod] = useState<GoalPeriod>('weekly');
  const [teamGoals, setTeamGoals] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [metrics, setMetrics] = useState<Record<GoalType, number>>({
    phone_call_quantity: 0,
    talk_time_minutes: 0,
    email_quantity: 0,
    sms_quantity: 0,
    lead_progression_a: 0,
    lead_progression_b: 0,
    lead_progression_c: 0,
    new_sales_wholesale: 0,
    new_sales_distribution: 0,
  });
  const [kpis, setKpis] = useState<Array<{ type: GoalType; value: number; target: number; pct: number; projected: number }>>([]);
  const [salesKpi, setSalesKpi] = useState<{ total: number; target: number; pct: number; projected: number } | null>(null);
  const [trends, setTrends] = useState<Record<string, { date: string; value: number }[]>>({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        // Fetch leaderboard
        const resLeaderboard = await fetch(`/api/public/team-leaderboard?period=${period}`, { cache: 'no-store' });
        const dataLeaderboard = await resLeaderboard.json();
        if (resLeaderboard.ok && dataLeaderboard?.leaderboard) {
          if (!cancelled) setTeamMembers(dataLeaderboard.leaderboard);
        }

        // Team goals
        const resGoals = await fetch('/api/public/team-goals', { cache: 'no-store' });
        const dataGoals = await resGoals.json();
        if (!resGoals.ok) throw new Error(dataGoals?.error || 'Failed to load team goals');
        if (!cancelled) setTeamGoals(dataGoals?.teamGoals || {});

        // Aggregated team metrics for the selected period
        const resTotals = await fetch(`/api/public/team-metrics?period=${period}`, { cache: 'no-store' });
        const dataTotals = await resTotals.json();
        if (!resTotals.ok) throw new Error(dataTotals?.error || 'Failed to load team metrics');
        const totals = dataTotals?.totals || {};
        const agg: Record<GoalType, number> = {
          phone_call_quantity: Number(totals['phone_call_quantity'] || 0),
          talk_time_minutes: Number(totals['talk_time_minutes'] || 0),
          email_quantity: Number(totals['email_quantity'] || 0),
          sms_quantity: Number(totals['sms_quantity'] || 0),
          lead_progression_a: Number(totals['lead_progression_a'] || 0),
          lead_progression_b: Number(totals['lead_progression_b'] || 0),
          lead_progression_c: Number(totals['lead_progression_c'] || 0),
          new_sales_wholesale: Number(totals['new_sales_wholesale'] || 0),
          new_sales_distribution: Number(totals['new_sales_distribution'] || 0),
        };
        if (!cancelled) setMetrics(agg);

        // Trends (sparklines)
        const resTrends = await fetch(`/api/public/team-trends?period=${period}`, { cache: 'no-store' });
        const dataTrends = await resTrends.json();
        if (resTrends.ok && dataTrends?.series) {
          if (!cancelled) setTrends(dataTrends.series);
        }
      } catch (e) {
        // Silently fail and show loading/zeros
        if (!cancelled) {
          setTeamMembers([]);
          setTeamGoals(teamGoals || {});
          setMetrics((m) => ({ ...m }));
          setTrends({});
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [period]);

  // Helpers to compute pace
  const getElapsedFraction = (p: GoalPeriod) => {
    const now = new Date();
    if (p === 'weekly') {
      const start = new Date(now); start.setDate(now.getDate() - 6); start.setHours(0,0,0,0);
      const total = 7 * 24 * 60 * 60 * 1000;
      return Math.min(0.999, Math.max(0.001, (now.getTime() - start.getTime()) / total));
    }
    if (p === 'monthly') {
      const start = new Date(now); start.setDate(now.getDate() - 29); start.setHours(0,0,0,0);
      const total = 30 * 24 * 60 * 60 * 1000;
      return Math.min(0.999, Math.max(0.001, (now.getTime() - start.getTime()) / total));
    }
    // quarterly ~ last 90 days window
    const start = new Date(now); start.setDate(now.getDate() - 89); start.setHours(0,0,0,0);
    const total = 90 * 24 * 60 * 60 * 1000;
    return Math.min(0.999, Math.max(0.001, (now.getTime() - start.getTime()) / total));
  };

  const kpiCards = useMemo(() => {
    const toTitle = (s: string) => {
      if (s === 'phone_call_quantity') return 'Phone Calls';
      return s.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    };

    return goalTypes.map((type) => {
      const value = metrics[type] || 0;
      const target = Number(teamGoals?.[period]?.[type] ?? 0);
      const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0;
      const k = kpis.find((x) => x.type === type as GoalType);
      const projected = k?.projected ?? value / getElapsedFraction(period);
      const onPace = target > 0 ? projected >= target : true;
      return (
        <div key={type} className="bg-white rounded-xl shadow-sm p-5">
          <div className="text-sm text-gray-500">{toTitle(type)}</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900">
            {type.startsWith('new_sales_') ? `$${value.toLocaleString()}` : value}
          </div>
          <div className="mt-3">
            <div className="h-2 bg-gray-100 rounded">
              <div className="h-2 bg-kanva-green rounded" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{pct.toFixed(0)}%</span>
              <span>Target: {type.startsWith('new_sales_') ? `$${Number(target).toLocaleString()}` : target}</span>
            </div>
            <div className="mt-2 text-xs">
              <span className={onPace ? 'text-green-600' : 'text-amber-600'}>
                Pace: proj {type.startsWith('new_sales_') ? `$${Math.round(projected).toLocaleString()}` : Math.round(projected)} by period end
              </span>
            </div>
          </div>
        </div>
      );
    });
  }, [metrics, teamGoals, period, kpis]);

  const getMedalEmoji = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Team Performance Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">Competitive rankings and team metrics</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-gray-100 rounded-lg p-1">
              {(['daily', 'weekly', 'monthly', 'quarterly'] as GoalPeriod[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    period === p ? 'bg-white text-kanva-green shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {periodLabels[p]}
                </button>
              ))}
            </div>
            <Link href="https://app.copper.com/companies/562111/app#/browse/board/opportunities/default?pipeline=1084986" target="_blank" className="text-sm text-kanva-green hover:underline">
              View Pipeline →
            </Link>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-kanva-green border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading team performance...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Leaderboard */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-xl font-bold mb-4">🏆 Team Leaderboard</h2>
            {teamMembers.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No team data available</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">Rank</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Team Member</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Sales</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Calls</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Emails</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Texts</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Leads</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamMembers.map((member) => {
                      const isTopThree = member.rank <= 3;
                      const medal = getMedalEmoji(member.rank);
                      return (
                        <tr 
                          key={member.userId} 
                          className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                            isTopThree ? 'bg-green-50' : ''
                          }`}
                        >
                          <td className="py-4 px-2">
                            <div className="flex items-center gap-1">
                              {medal && <span className="text-xl">{medal}</span>}
                              <span className={`text-sm font-semibold ${isTopThree ? 'text-kanva-green' : 'text-gray-600'}`}>
                                {member.rank}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              {member.photoUrl ? (
                                <img src={member.photoUrl} alt={member.userName} className="w-10 h-10 rounded-full" />
                              ) : (
                                <div className="w-10 h-10 bg-kanva-green rounded-full flex items-center justify-center text-white font-bold">
                                  {member.userName.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <div className="font-semibold text-gray-900">{member.userName}</div>
                                <div className="text-xs text-gray-500">{member.userEmail}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="font-semibold text-gray-900">${member.totalSales.toLocaleString()}</div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                              <div 
                                className="bg-kanva-green h-1.5 rounded-full" 
                                style={{ width: `${Math.min((member.totalSales / 5000) * 100, 100)}%` }}
                              />
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="font-semibold text-gray-900">{member.phoneCalls}</div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                              <div 
                                className="bg-blue-500 h-1.5 rounded-full" 
                                style={{ width: `${Math.min((member.phoneCalls / 50) * 100, 100)}%` }}
                              />
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="font-semibold text-gray-900">{member.emails}</div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                              <div 
                                className="bg-purple-500 h-1.5 rounded-full" 
                                style={{ width: `${Math.min((member.emails / 100) * 100, 100)}%` }}
                              />
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="font-semibold text-gray-900">{member.sms || 0}</div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                              <div 
                                className="bg-pink-500 h-1.5 rounded-full" 
                                style={{ width: `${Math.min(((member.sms || 0) / 50) * 100, 100)}%` }}
                              />
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="font-semibold text-gray-900">{member.leadProgression}</div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                              <div 
                                className="bg-amber-500 h-1.5 rounded-full" 
                                style={{ width: `${Math.min((member.leadProgression / 10) * 100, 100)}%` }}
                              />
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className={`text-lg font-bold ${isTopThree ? 'text-kanva-green' : 'text-gray-900'}`}>
                              {member.overallScore.toFixed(1)}%
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Team Metrics Grid */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-xl font-bold mb-4">Team Metrics</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg border">
                <p className="text-sm text-gray-500">Total Sales</p>
                <p className="text-2xl font-bold">${(metrics.new_sales_wholesale + metrics.new_sales_distribution).toLocaleString()}</p>
              </div>
              <div className="p-4 rounded-lg border">
                <p className="text-sm text-gray-500">Total Calls</p>
                <p className="text-2xl font-bold">{metrics.phone_call_quantity}</p>
              </div>
              <div className="p-4 rounded-lg border">
                <p className="text-sm text-gray-500">Total Emails</p>
                <p className="text-2xl font-bold">{metrics.email_quantity}</p>
              </div>
              <div className="p-4 rounded-lg border">
                <p className="text-sm text-gray-500">Total Texts</p>
                <p className="text-2xl font-bold">{metrics.sms_quantity}</p>
              </div>
              <div className="p-4 rounded-lg border">
                <p className="text-sm text-gray-500">Total Leads</p>
                <p className="text-2xl font-bold">{metrics.lead_progression_a + metrics.lead_progression_b + metrics.lead_progression_c}</p>
              </div>
            </div>
          </div>

          {/* Sales Totals Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {(() => {
              const wholesale = metrics['new_sales_wholesale'] || 0;
              const distribution = metrics['new_sales_distribution'] || 0;
              const total = wholesale + distribution;
              const tg = (teamGoals?.[period]?.['new_sales_wholesale'] ?? 0) + (teamGoals?.[period]?.['new_sales_distribution'] ?? 0);
              const pct = tg > 0 ? Math.min((total / tg) * 100, 100) : 0;
              const projected = salesKpi?.projected ?? total / getElapsedFraction(period);
              const onPace = tg > 0 ? projected >= tg : true;
              return (
                <>
                  <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="text-sm text-gray-500">Wholesale Sales</div>
                    <div className="text-2xl font-semibold">${wholesale.toLocaleString()}</div>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="text-sm text-gray-500">Distribution Sales</div>
                    <div className="text-2xl font-semibold">${distribution.toLocaleString()}</div>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="text-sm text-gray-500">Team Sales Total</div>
                    <div className="text-2xl font-semibold">${total.toLocaleString()}</div>
                    <div className="mt-3 h-2 bg-gray-100 rounded">
                      <div className="h-2 bg-kanva-green rounded" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>{pct.toFixed(0)}%</span>
                      <span>Target: ${tg.toLocaleString()}</span>
                    </div>
                    <div className="mt-2 text-xs">
                      <span className={onPace ? 'text-green-600' : 'text-amber-600'}>Pace: proj ${Math.round(projected).toLocaleString()}</span>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{kpiCards}</div>

          {/* Trends (Sparklines) */}
          <div className="mt-8 bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4">Team Trends ({periodLabels[period]})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(['email_quantity','phone_call_quantity'] as GoalType[]).map((t, idx) => (
                <div key={t}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">{t === 'phone_call_quantity' ? 'Phone Calls' : t.replace(/_/g,' ').replace(/\b\w/g, l=>l.toUpperCase())} – recent</span>
                    <span className="text-sm text-gray-900 font-medium">{(trends?.[t]?.reduce((a,b)=>a+b.value,0) || 0)}</span>
                  </div>
                  <div className="h-24">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trends?.[t] || []} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                        <defs>
                          <linearGradient id={`tg${idx}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#16a34a" stopOpacity={0.5}/>
                            <stop offset="95%" stopColor="#16a34a" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <Tooltip formatter={(v)=>[v as number,'Value']} labelFormatter={(l)=>l} cursor={{ stroke: '#e5e7eb' }} />
                        <Area type="monotone" dataKey="value" stroke="#16a34a" fillOpacity={1} fill={`url(#tg${idx})`} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stage distribution simple chart */}
          <div className="mt-8 bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4">Pipeline Stage Distribution ({periodLabels[period]})</h3>
            <div className="space-y-4">
              {(['lead_progression_a', 'lead_progression_b', 'lead_progression_c'] as GoalType[]).map((t) => {
                const v = metrics[t] || 0;
                const max = Math.max(1, metrics['lead_progression_a'], metrics['lead_progression_b'], metrics['lead_progression_c']);
                const w = Math.round((v / max) * 100);
                const label = t.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
                return (
                  <div key={t}>
                    <div className="flex justify-between text-sm text-gray-700"><span>{label}</span><span>{v}</span></div>
                    <div className="h-2 bg-gray-100 rounded">
                      <div className="h-2 bg-kanva-green rounded" style={{ width: `${w}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

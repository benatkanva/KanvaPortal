'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase/client';

type Stats = {
  totalCustomersWithActivity: number;
  newCustomers: number;
  totalRevenueInRange: number;
  newRevenueInRange: number;
  startDate: string;
  endDate: string;
};

interface CustomerRow {
  customerId: string;
  customerName: string;
  salesPerson: string | null;
  salesRep: string | null;
  salesRepName: string | null;
  salesRepRegion: string | null;
  firstOrderDate: string | null;
  lastOrderDate: string | null;
  totalOrdersAllTime: number;
  totalRevenueAllTime: number;
  revenueInRange: number;
  ordersInRange: number;
  isNewInRange: boolean;
}

type DatePreset = 'ytd' | 'this_month' | 'this_quarter' | 'last_6m' | 'last_12m';

function computePresetRange(preset: DatePreset): { start: string; end: string } {
  const end = new Date();
  const endStr = end.toISOString().split('T')[0];
  const start = new Date(end);

  switch (preset) {
    case 'this_month': {
      start.setDate(1);
      break;
    }
    case 'this_quarter': {
      const q = Math.floor(start.getMonth() / 3);
      start.setMonth(q * 3, 1);
      break;
    }
    case 'last_6m': {
      start.setMonth(start.getMonth() - 6);
      break;
    }
    case 'last_12m': {
      start.setMonth(start.getMonth() - 12);
      break;
    }
    case 'ytd':
    default: {
      start.setMonth(0, 1);
      break;
    }
  }

  const startStr = start.toISOString().split('T')[0];
  return { start: startStr, end: endStr };
}

export default function SalesInsightsPage() {
  const [preset, setPreset] = useState<DatePreset>('ytd');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);

  const [salesPersonFilter, setSalesPersonFilter] = useState<string>('');
  const [salesRepFilter, setSalesRepFilter] = useState<string>('');
  const [salesRepNameFilter, setSalesRepNameFilter] = useState<string>('');

  // Initialize date range on mount
  useEffect(() => {
    const { start, end } = computePresetRange('ytd');
    setStartDate(start);
    setEndDate(end);
  }, []);

  const loadData = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setError(null);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setError('Not authenticated. Please log in.');
        setLoading(false);
        return;
      }

      const token = await currentUser.getIdToken();

      const body: any = { startDate, endDate };
      const filters: any = {};
      if (salesPersonFilter) filters.salesPerson = salesPersonFilter;
      if (salesRepFilter) filters.salesRep = salesRepFilter;
      if (salesRepNameFilter) filters.salesRepName = salesRepNameFilter;
      if (Object.keys(filters).length > 0) body.filters = filters;

      const res = await fetch('/api/sales-insights/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to load sales insights');
      }

      setStats(data.stats);
      setCustomers(data.customers || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load sales insights');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (startDate && endDate) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const handlePresetChange = (p: DatePreset) => {
    setPreset(p);
    const { start, end } = computePresetRange(p);
    setStartDate(start);
    setEndDate(end);
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const formatDate = (value: string | null) => {
    if (!value) return '-';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString();
  };

  const newCustomers = customers.filter(c => c.isNewInRange);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Sales Insights</h1>
            <p className="text-gray-600 mt-2">
              New business and YTD sales performance, powered by Fishbowl data.
            </p>
          </div>
          <a href="/admin" className="text-sm text-kanva-green hover:underline">
            ← Back to Admin
          </a>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Date Preset</label>
              <select
                value={preset}
                onChange={(e) => handlePresetChange(e.target.value as DatePreset)}
                className="w-full border rounded px-2 py-1 text-sm"
              >
                <option value="ytd">This Year (YTD)</option>
                <option value="this_month">This Month</option>
                <option value="this_quarter">This Quarter</option>
                <option value="last_6m">Last 6 Months</option>
                <option value="last_12m">Last 12 Months</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={loadData}
                disabled={loading}
                className="w-full bg-kanva-green text-white px-4 py-2 rounded text-sm font-semibold hover:bg-green-700 disabled:bg-gray-400"
              >
                {loading ? 'Loading…' : 'Refresh'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Filter: salesPerson</label>
              <input
                type="text"
                value={salesPersonFilter}
                onChange={(e) => setSalesPersonFilter(e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm"
                placeholder="e.g. Zalak"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Filter: salesRep</label>
              <input
                type="text"
                value={salesRepFilter}
                onChange={(e) => setSalesRepFilter(e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm"
                placeholder="e.g. BenW"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Filter: salesRepName</label>
              <input
                type="text"
                value={salesRepNameFilter}
                onChange={(e) => setSalesRepNameFilter(e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm"
                placeholder="e.g. Ben Wallner"
              />
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* KPIs */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-xs text-gray-500">Total Revenue (range)</p>
              <p className="text-2xl font-bold text-gray-900">${formatCurrency(stats.totalRevenueInRange)}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-xs text-gray-500">New Business Revenue</p>
              <p className="text-2xl font-bold text-green-700">${formatCurrency(stats.newRevenueInRange)}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-xs text-gray-500">Customers with Orders</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalCustomersWithActivity}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-xs text-gray-500">New Customers</p>
              <p className="text-2xl font-bold text-green-700">{stats.newCustomers}</p>
            </div>
          </div>
        )}

        {/* Customers table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Customers in Range ({customers.length})</h2>
            <span className="text-xs text-gray-500">New customers are highlighted in green.</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Customer</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">IDs / Reps</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">First / Last Order</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">Orders (range)</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">Revenue (range)</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">Total Revenue (all-time)</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {customers.slice(0, 200).map((c) => (
                  <tr key={c.customerId} className={c.isNewInRange ? 'bg-green-50' : ''}>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{c.customerName || '(Unnamed)'}</div>
                      <div className="text-xs text-gray-500">FB Account ID: {c.customerId}</div>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-700">
                      <div>salesPerson: {c.salesPerson || '-'}</div>
                      <div>salesRep: {c.salesRep || '-'}</div>
                      <div>salesRepName: {c.salesRepName || '-'}</div>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-700">
                      <div>First: {formatDate(c.firstOrderDate)}</div>
                      <div>Last: {formatDate(c.lastOrderDate)}</div>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-right text-gray-900">
                      {c.ordersInRange}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-right text-gray-900">
                      ${formatCurrency(c.revenueInRange)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-right text-gray-500">
                      ${formatCurrency(c.totalRevenueAllTime)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {customers.length > 200 && (
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-600">
              Showing first 200 customers. Narrow filters to see a smaller segment.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

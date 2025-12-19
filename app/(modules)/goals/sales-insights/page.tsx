'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { auth, onAuthStateChange } from '@/lib/firebase/client';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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
  isDormant?: boolean;
}

type DatePreset = 'all_time' | 'ytd' | 'this_month' | 'this_quarter' | 'last_6m' | 'last_12m';

function computePresetRange(preset: DatePreset): { start: string; end: string } {
  const end = new Date();
  const endStr = end.toISOString().split('T')[0];
  const start = new Date(end);

  switch (preset) {
    case 'all_time': {
      // Go back far enough to cover all historical data
      start.setFullYear(2000, 0, 1);
      break;
    }
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

  const [salesRepOptions, setSalesRepOptions] = useState<string[]>([]);
  const [salesRepFilter, setSalesRepFilter] = useState<string>('');

  const [salesOrderSearch, setSalesOrderSearch] = useState<string>('');
  const [showOrderDetails, setShowOrderDetails] = useState<boolean>(false);

  const [customerSearch, setCustomerSearch] = useState<string>('');

  const [visibleCount, setVisibleCount] = useState<number>(100);
  const pageSize = 100;

  const [ordersByCustomer, setOrdersByCustomer] = useState<Record<string, any[]>>({});

  const [hideZeroRevenue, setHideZeroRevenue] = useState<boolean>(false);

  const [repChartData, setRepChartData] = useState<any[]>([]);
  const [weeklyChartData, setWeeklyChartData] = useState<any[]>([]);

  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<any | null>(null);

  type SortField = 'customerName' | 'firstLast' | 'ordersInRange' | 'revenueInRange' | 'totalRevenueAllTime' | null;
  type SortDirection = 'asc' | 'desc';

  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Initialize date range on mount
  useEffect(() => {
    const { start, end } = computePresetRange('ytd');
    setStartDate(start);
    setEndDate(end);
  }, []);

  // Wait for Firebase auth to restore session on refresh
  useEffect(() => {
    const unsub = onAuthStateChange((u) => {
      setFirebaseUser(u || null);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  const loadData = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setError(null);

    try {
      const currentUser = auth.currentUser || firebaseUser;
      if (!currentUser) {
        setLoading(false);
        return;
      }

      const token = await currentUser.getIdToken();

      const body: any = { startDate, endDate, includeOrderDetails: true };
      const filters: any = {};
      if (salesRepFilter) filters.salesRep = salesRepFilter;
      if (Object.keys(filters).length > 0) body.filters = filters;

      if (salesOrderSearch.trim()) {
        body.salesOrderNum = salesOrderSearch.trim();
      }

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
      setVisibleCount(pageSize);

      if (data.options) {
        setSalesRepOptions(data.options.salesRep || []);
      }

      if (data.ordersByCustomer) {
        setOrdersByCustomer(data.ordersByCustomer);
      } else {
        setOrdersByCustomer({});
      }

      if (data.chartData) {
        setRepChartData(data.chartData.repAggregates || []);
        setWeeklyChartData(data.chartData.weeklyNewBusiness || []);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load sales insights');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!startDate || !endDate) return;

    // Only attempt to load once Firebase has finished restoring auth state
    if (!authReady) return;

    if (!firebaseUser) {
      setStats(null);
      setCustomers([]);
      setOrdersByCustomer({});
      setError('Not authenticated. Please log in.');
      return;
    }

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, authReady, firebaseUser]);

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

  const filteredCustomers = useMemo(() => {
    let list = customers;

    if (hideZeroRevenue) {
      list = list.filter((c) => c.revenueInRange > 0);
    }

    const term = customerSearch.trim().toLowerCase();
    if (term) {
      list = list.filter((c) => {
        const name = (c.customerName || '').toLowerCase();
        const id = (c.customerId || '').toLowerCase();
        return name.includes(term) || id.includes(term);
      });
    }

    return list;
  }, [customers, hideZeroRevenue, customerSearch]);

  const sortedCustomers = useMemo(() => {
    if (!sortField) return filteredCustomers;

    const arr = [...filteredCustomers];
    arr.sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1;

      if (sortField === 'customerName') {
        const av = a.customerName || '';
        const bv = b.customerName || '';
        return av.localeCompare(bv) * dir;
      }

      if (sortField === 'firstLast') {
        const av = a.lastOrderDate || '';
        const bv = b.lastOrderDate || '';
        return av.localeCompare(bv) * dir;
      }

      if (sortField === 'ordersInRange') {
        return (a.ordersInRange - b.ordersInRange) * dir;
      }

      if (sortField === 'revenueInRange') {
        return (a.revenueInRange - b.revenueInRange) * dir;
      }

      if (sortField === 'totalRevenueAllTime') {
        return (a.totalRevenueAllTime - b.totalRevenueAllTime) * dir;
      }

      return 0;
    });

    return arr;
  }, [filteredCustomers, sortField, sortDirection]);

  const visibleCustomers = sortedCustomers.slice(0, visibleCount);

  const handleSort = (field: SortField, defaultDirection: SortDirection = 'desc') => {
    setVisibleCount(pageSize);
    setSortField((currentField) => {
      if (currentField !== field) {
        setSortDirection(defaultDirection);
        return field;
      }
      setSortDirection((currentDir) => (currentDir === 'asc' ? 'desc' : 'asc'));
      return field;
    });
  };

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
          <a href="/dashboard" className="text-sm text-kanva-green hover:underline">
            ← Back to Dashboard
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
                <option value="all_time">All Time</option>
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
                {loading ? 'Loading…' : 'Search'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Filter: salesRep</label>
              <select
                value={salesRepFilter}
                onChange={(e) => setSalesRepFilter(e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm"
              >
                <option value="">All</option>
                {salesRepOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Search: Customer</label>
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm"
                placeholder="Name or FB Account ID"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Search: Sales Order #</label>
              <input
                type="text"
                value={salesOrderSearch}
                onChange={(e) => setSalesOrderSearch(e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm"
                placeholder="Exact SO number"
              />
            </div>
            <div className="flex items-end text-xs text-gray-500">
              <div>
                <div>Tip: use Sales Rep filter above to see your book of business.</div>
              </div>
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

        {/* Charts */}
        {repChartData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Rep Bar Chart */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Rep (New vs Existing)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={repChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="repName" angle={-45} textAnchor="end" height={100} style={{ fontSize: '12px' }} />
                  <YAxis />
                  <Tooltip formatter={(value: number) => `$${formatCurrency(value)}`} />
                  <Legend />
                  <Bar dataKey="newRevenue" stackId="a" fill="#10b981" name="New Business" />
                  <Bar dataKey="existingRevenue" stackId="a" fill="#047857" name="Existing Business" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Weekly Line Chart */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly New Business Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={weeklyChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" style={{ fontSize: '12px' }} />
                  <YAxis />
                  <Tooltip formatter={(value: number) => `$${formatCurrency(value)}`} />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name="New Business" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Customer Details Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Customers in Range ({filteredCustomers.length})</h2>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-gray-500">New customers in green. Dormant (&gt;12m since last order) in yellow.</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setHideZeroRevenue((v) => !v)}
                  className={`inline-flex items-center px-3 py-1 rounded-full border text-xs font-semibold ${
                    hideZeroRevenue
                      ? 'border-kanva-green text-white bg-kanva-green'
                      : 'border-kanva-green text-kanva-green bg-white'
                  }`}
                >
                  Hide $0: {hideZeroRevenue ? 'On' : 'Off'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowOrderDetails((v) => !v)}
                  className={`inline-flex items-center px-3 py-1 rounded-full border text-xs font-semibold ${
                    showOrderDetails
                      ? 'border-kanva-green text-white bg-kanva-green'
                      : 'border-kanva-green text-kanva-green bg-white'
                  }`}
                >
                  SO Detail: {showOrderDetails ? 'On' : 'Off'}
                </button>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">
                    <button
                      type="button"
                      onClick={() => handleSort('customerName', 'asc')}
                      className="inline-flex items-center gap-1"
                    >
                      Customer
                      {sortField === 'customerName' && (
                        <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">IDs / Reps</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">
                    <button
                      type="button"
                      onClick={() => handleSort('firstLast', 'desc')}
                      className="inline-flex items-center gap-1"
                    >
                      First / Last Order
                      {sortField === 'firstLast' && (
                        <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">
                    <button
                      type="button"
                      onClick={() => handleSort('ordersInRange', 'desc')}
                      className="inline-flex items-center gap-1 justify-end w-full"
                    >
                      Orders (range)
                      {sortField === 'ordersInRange' && (
                        <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">
                    <button
                      type="button"
                      onClick={() => handleSort('revenueInRange', 'desc')}
                      className="inline-flex items-center gap-1 justify-end w-full"
                    >
                      Revenue (range)
                      {sortField === 'revenueInRange' && (
                        <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">
                    <button
                      type="button"
                      onClick={() => handleSort('totalRevenueAllTime', 'desc')}
                      className="inline-flex items-center gap-1 justify-end w-full"
                    >
                      Total Revenue (all-time)
                      {sortField === 'totalRevenueAllTime' && (
                        <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {visibleCustomers.map((c) => {
                  const rowOrders = ordersByCustomer[c.customerId] || [];
                  const rowClass = c.isNewInRange
                    ? 'bg-green-50'
                    : c.isDormant
                      ? 'bg-yellow-50'
                      : '';

                  return (
                    <React.Fragment key={c.customerId}>
                      <tr className={rowClass}>
                        <td className="px-4 py-2 whitespace-nowrap align-top">
                          <div className="font-medium text-gray-900">{c.customerName || '(Unnamed)'}</div>
                          <div className="text-xs text-gray-500">FB Account ID: {c.customerId}</div>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-700 align-top">
                          <div>salesPerson: {c.salesPerson || '-'}</div>
                          <div>salesRep: {c.salesRep || '-'}</div>
                          <div>salesRepName: {c.salesRepName || '-'}</div>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-700 align-top">
                          <div>First: {formatDate(c.firstOrderDate)}</div>
                          <div>Last: {formatDate(c.lastOrderDate)}</div>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-right text-gray-900 align-top">
                          {c.ordersInRange}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-right text-gray-900 align-top">
                          ${formatCurrency(c.revenueInRange)}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-right text-gray-500 align-top">
                          ${formatCurrency(c.totalRevenueAllTime)}
                        </td>
                      </tr>
                      {showOrderDetails && rowOrders.length > 0 && (
                        <tr className={rowClass}>
                          <td colSpan={6} className="px-6 pb-4 pt-0">
                            <div className="mt-2 rounded-md border border-gray-200 bg-white">
                              <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between text-xs text-gray-600">
                                <span>Sales Orders in range ({rowOrders.length})</span>
                                {salesOrderSearch && (
                                  <span className="text-gray-500">
                                    Filtered by SO #: <span className="font-semibold">{salesOrderSearch}</span>
                                  </span>
                                )}
                              </div>
                              <div className="max-h-48 overflow-y-auto">
                                <table className="min-w-full text-xs">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="px-3 py-1 text-left font-semibold text-gray-600">SO #</th>
                                      <th className="px-3 py-1 text-left font-semibold text-gray-600">Date</th>
                                      <th className="px-3 py-1 text-left font-semibold text-gray-600">Status</th>
                                      <th className="px-3 py-1 text-right font-semibold text-gray-600">Revenue</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {rowOrders.map((o) => (
                                      <tr key={o.id} className="border-t border-gray-100">
                                        <td className="px-3 py-1 whitespace-nowrap font-medium text-gray-900">{o.num || '-'}</td>
                                        <td className="px-3 py-1 whitespace-nowrap text-gray-700">
                                          {o.postingDate ? formatDate(o.postingDate) : '-'}
                                        </td>
                                        <td className="px-3 py-1 whitespace-nowrap text-gray-700">{o.soStatus || '-'}</td>
                                        <td className="px-3 py-1 whitespace-nowrap text-right text-gray-900">
                                          ${formatCurrency(o.revenue || 0)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {visibleCount < filteredCustomers.length && (
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-center text-xs text-gray-600">
              <button
                type="button"
                onClick={() => setVisibleCount((c) => Math.min(c + pageSize, filteredCustomers.length))}
                className="inline-flex items-center px-4 py-2 rounded-lg bg-white border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-100"
              >
                Load more customers ({filteredCustomers.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

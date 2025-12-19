'use client';

import { useState } from 'react';
import { Upload, RefreshCw, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react';

interface CustomerWithMetrics {
  id: string;
  name: string;
  copperCompanyId: string;
  copperCompanyName: string;
  accountId: string;
  metrics?: {
    totalOrders: number;
    totalSpent: number;
    firstOrderDate: string | null;
    lastOrderDate: string | null;
    averageOrderValue: number;
    daysSinceLastOrder: number | null;
  };
  metricsCalculatedAt?: string;
  syncedToCopperAt?: string;
}

export default function SyncFishbowlCopperPage() {
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [customers, setCustomers] = useState<CustomerWithMetrics[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  const calculateMetrics = async () => {
    setCalculating(true);
    setError(null);
    
    try {
      // Get Firebase auth token
      const { auth } = await import('@/lib/firebase/client');
      const user = auth.currentUser;
      if (!user) {
        throw new Error('Not authenticated. Please log in.');
      }

      const token = await user.getIdToken();

      const response = await fetch('/api/fishbowl/calculate-metrics', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to calculate metrics');
      }

      const data = await response.json();
      setStats(data.stats);
      
      // Reload customers to show updated metrics
      await loadCustomers();
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCalculating(false);
    }
  };

  const loadCustomers = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/fishbowl/customers-with-metrics');
      
      if (!response.ok) {
        throw new Error('Failed to load customers');
      }

      const data = await response.json();
      setCustomers(data.customers);
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const syncToCopper = async () => {
    const customersWithMetrics = customers.filter(c => c.metrics);
    
    if (customersWithMetrics.length === 0) {
      setError('No customers with metrics to sync. Run Step 1 first.');
      return;
    }

    setSyncing(true);
    setError(null);
    setProgress({ current: 0, total: customersWithMetrics.length });
    
    try {
      const response = await fetch('/api/fishbowl/sync-to-copper', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to sync to Copper');
      }

      const data = await response.json();
      
      // Reload to show sync status
      await loadCustomers();
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSyncing(false);
      setProgress(null);
    }
  };

  const customersWithMetrics = customers.filter(c => c.metrics);
  const customersWithoutMetrics = customers.filter(c => !c.metrics);
  const customersSynced = customers.filter(c => c.syncedToCopperAt);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-kanva-green" />
              Sync Fishbowl Metrics → Copper
            </h1>
            <p className="text-gray-600 mt-2">
              Calculate customer metrics from sales orders and push to Copper CRM
            </p>
          </div>
          <a href="/admin" className="text-sm text-kanva-green hover:underline flex items-center gap-2">
            ← Back to Admin
          </a>
        </div>

        {/* How It Works */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-blue-900 mb-3">How It Works:</h2>
          <div className="space-y-2 text-sm text-blue-800">
            <p><strong>Step 1:</strong> Calculate metrics from Fishbowl sales orders (Total Orders, Lifetime Value, etc.)</p>
            <p><strong>Step 2:</strong> Store metrics in Firestore for preview</p>
            <p><strong>Step 3:</strong> Push metrics to Copper CRM custom fields</p>
          </div>
        </div>

        {/* Stats Cards */}
        {customers.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-600">Total Customers</p>
              <p className="text-2xl font-bold text-gray-900">{customers.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-600">With Metrics</p>
              <p className="text-2xl font-bold text-green-600">{customersWithMetrics.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-600">Without Metrics</p>
              <p className="text-2xl font-bold text-orange-600">{customersWithoutMetrics.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-600">Synced to Copper</p>
              <p className="text-2xl font-bold text-blue-600">{customersSynced.length}</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={calculateMetrics}
              disabled={calculating}
              className="flex items-center gap-2 px-6 py-3 bg-kanva-green text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all"
            >
              <RefreshCw className={`w-5 h-5 ${calculating ? 'animate-spin' : ''}`} />
              {calculating ? 'Calculating...' : 'Step 1: Calculate Metrics'}
            </button>

            <button
              onClick={loadCustomers}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              <Upload className="w-5 h-5" />
              {loading ? 'Loading...' : 'Load Customers'}
            </button>

            {customersWithMetrics.length > 0 && (
              <button
                onClick={syncToCopper}
                disabled={syncing}
                className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <CheckCircle className="w-5 h-5" />
                {syncing ? 'Syncing...' : `Step 3: Sync ${customersWithMetrics.length} to Copper`}
              </button>
            )}
          </div>

          {calculating && (
            <p className="text-sm text-gray-600 mt-4">
              ⏳ Calculating metrics for all matched customers... This may take a few minutes.
            </p>
          )}

          {syncing && progress && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">
                  Syncing {progress.current} of {progress.total}...
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  {Math.round((progress.current / progress.total) * 100)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-red-900">Error</h3>
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Stats from Calculation */}
        {stats && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-green-900 mb-3">✅ Metrics Calculated!</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-green-700">Total Customers</p>
                <p className="text-2xl font-bold text-green-900">{stats.totalCustomers}</p>
              </div>
              <div>
                <p className="text-green-700">Updated</p>
                <p className="text-2xl font-bold text-green-900">{stats.updated}</p>
              </div>
              <div>
                <p className="text-green-700">Total Orders</p>
                <p className="text-2xl font-bold text-green-900">{stats.totalOrders?.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-green-700">Skipped</p>
                <p className="text-2xl font-bold text-green-900">{stats.skipped}</p>
              </div>
            </div>
          </div>
        )}

        {/* Customers Table */}
        {customers.length > 0 && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Customers with Metrics ({customersWithMetrics.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Orders</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lifetime Value</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Order</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Order</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {customersWithMetrics.slice(0, 50).map((customer) => (
                    <tr key={customer.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                        <div className="text-xs text-gray-500">→ {customer.copperCompanyName}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {customer.metrics?.totalOrders || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${customer.metrics?.totalSpent.toLocaleString() || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${customer.metrics?.averageOrderValue.toLocaleString() || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {customer.metrics?.lastOrderDate ? new Date(customer.metrics.lastOrderDate).toLocaleDateString() : '-'}
                        {customer.metrics?.daysSinceLastOrder && (
                          <div className="text-xs text-gray-500">
                            {customer.metrics.daysSinceLastOrder} days ago
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {customer.syncedToCopperAt ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            Synced
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {customersWithMetrics.length > 50 && (
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  Showing first 50 of {customersWithMetrics.length} customers
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

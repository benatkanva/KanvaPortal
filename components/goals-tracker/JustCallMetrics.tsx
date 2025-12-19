'use client';

import { useEffect, useState } from 'react';
import { Phone, PhoneIncoming, PhoneOutgoing, Clock, TrendingUp, Calendar } from 'lucide-react';

interface JustCallMetrics {
  totalCalls: number;
  inboundCalls: number;
  outboundCalls: number;
  completedCalls: number;
  missedCalls: number;
  totalDuration: number;
  averageDuration: number;
  callsByDay: Record<string, number>;
  callsByStatus: Record<string, number>;
}

interface JustCallMetricsProps {
  userEmail: string;
  startDate?: string;
  endDate?: string;
  autoRefresh?: boolean;
  refreshInterval?: number; // in milliseconds
}

export default function JustCallMetrics({
  userEmail,
  startDate,
  endDate,
  autoRefresh = true,
  refreshInterval = 60000, // 1 minute default
}: JustCallMetricsProps) {
  const [metrics, setMetrics] = useState<JustCallMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchMetrics = async () => {
    try {
      setError(null);
      
      const params = new URLSearchParams({ email: userEmail });
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const response = await fetch(`/api/justcall/metrics?${params.toString()}`);
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch metrics');
      }

      const data = await response.json();
      setMetrics(data.metrics);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('[JustCallMetrics] Error fetching metrics:', err);
      setError(err.message || 'Failed to load call metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();

    if (autoRefresh) {
      const interval = setInterval(fetchMetrics, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [userEmail, startDate, endDate, autoRefresh, refreshInterval]);

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-kanva-green"></div>
          <span className="ml-3 text-gray-600">Loading call metrics...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="text-red-600 bg-red-50 border border-red-200 rounded p-4">
          <p className="font-medium">Error loading call metrics</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={fetchMetrics}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <p className="text-gray-600">No metrics available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-kanva-green" />
            <h3 className="text-lg font-semibold">JustCall Metrics</h3>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs text-gray-500">
                Updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={fetchMetrics}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-sm"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Calls */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Calls</p>
              <p className="text-2xl font-bold text-gray-900">{metrics.totalCalls}</p>
            </div>
            <Phone className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        {/* Inbound Calls */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Inbound</p>
              <p className="text-2xl font-bold text-gray-900">{metrics.inboundCalls}</p>
            </div>
            <PhoneIncoming className="w-8 h-8 text-green-500" />
          </div>
        </div>

        {/* Outbound Calls */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Outbound</p>
              <p className="text-2xl font-bold text-gray-900">{metrics.outboundCalls}</p>
            </div>
            <PhoneOutgoing className="w-8 h-8 text-purple-500" />
          </div>
        </div>

        {/* Average Duration */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Duration</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatDuration(metrics.averageDuration)}
              </p>
            </div>
            <Clock className="w-8 h-8 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Completed Calls */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">Completed</p>
            <TrendingUp className="w-4 h-4 text-green-600" />
          </div>
          <p className="text-xl font-bold text-green-600">{metrics.completedCalls}</p>
          <p className="text-xs text-gray-500 mt-1">
            {metrics.totalCalls > 0
              ? `${Math.round((metrics.completedCalls / metrics.totalCalls) * 100)}% success rate`
              : 'N/A'}
          </p>
        </div>

        {/* Missed Calls */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">Missed</p>
            <Phone className="w-4 h-4 text-red-600" />
          </div>
          <p className="text-xl font-bold text-red-600">{metrics.missedCalls}</p>
          <p className="text-xs text-gray-500 mt-1">
            {metrics.totalCalls > 0
              ? `${Math.round((metrics.missedCalls / metrics.totalCalls) * 100)}% missed`
              : 'N/A'}
          </p>
        </div>

        {/* Total Duration */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">Total Time</p>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-xl font-bold text-blue-600">
            {formatDuration(metrics.totalDuration)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Call duration</p>
        </div>
      </div>

      {/* Call Status Breakdown */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Call Status Breakdown</h4>
        <div className="space-y-2">
          {Object.entries(metrics.callsByStatus).map(([status, count]) => (
            <div key={status} className="flex items-center justify-between">
              <span className="text-sm text-gray-600 capitalize">{status}</span>
              <div className="flex items-center gap-2">
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-kanva-green h-2 rounded-full"
                    style={{
                      width: `${(count / metrics.totalCalls) * 100}%`,
                    }}
                  ></div>
                </div>
                <span className="text-sm font-medium text-gray-900 w-8 text-right">
                  {count}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Daily Activity */}
      {Object.keys(metrics.callsByDay).length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-gray-600" />
            <h4 className="text-sm font-semibold text-gray-700">Daily Activity</h4>
          </div>
          <div className="space-y-2">
            {Object.entries(metrics.callsByDay)
              .sort(([a], [b]) => b.localeCompare(a))
              .slice(0, 7)
              .map(([date, count]) => (
                <div key={date} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{date}</span>
                  <span className="text-sm font-medium text-gray-900">{count} calls</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

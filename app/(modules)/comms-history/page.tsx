'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { Phone, MessageSquare, TrendingUp, Calendar, Users, Clock } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, subMonths } from 'date-fns';

interface CallMetrics {
  totalCalls: number;
  inboundCalls: number;
  outboundCalls: number;
  completedCalls: number;
  missedCalls: number;
  totalDuration: number;
  averageDuration: number;
  callsByDay: Record<string, number>;
}

interface TeamMemberMetrics {
  userId: string;
  name: string;
  email: string;
  calls: number;
  sms: number;
  talkTime: number;
  trend: 'up' | 'down' | 'stable';
}

export default function CommsHistoryPage() {
  const { user, userProfile, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  });
  const [myMetrics, setMyMetrics] = useState<CallMetrics | null>(null);
  const [teamMetrics, setTeamMetrics] = useState<TeamMemberMetrics[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter'>('month');

  useEffect(() => {
    if (user?.email) {
      loadMetrics();
    }
  }, [user, dateRange]);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      // Fetch my metrics
      const response = await fetch(
        `/api/justcall/metrics?email=${encodeURIComponent(user?.email || '')}&start_date=${dateRange.start}&end_date=${dateRange.end}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setMyMetrics(data.metrics);
      }

      // If admin, fetch team metrics
      if (isAdmin) {
        // TODO: Implement team metrics aggregation
        // For now, just show placeholder
      }
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getSparklineData = (callsByDay: Record<string, number>) => {
    const days = eachDayOfInterval({
      start: new Date(dateRange.start),
      end: new Date(dateRange.end),
    });
    return days.map(day => callsByDay[format(day, 'yyyy-MM-dd')] || 0);
  };

  const renderSparkline = (data: number[]) => {
    const max = Math.max(...data, 1);
    const width = 100;
    const height = 30;
    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - (value / max) * height;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg width={width} height={height} className="inline-block">
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-kanva-green"
        />
      </svg>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-kanva-green border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading communications data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Phone className="w-7 h-7 text-kanva-green" />
              Communications History
            </h1>
            <p className="text-sm text-gray-500 mt-1">Track your calls, texts, and team performance</p>
          </div>
          
          {/* Period Selector */}
          <div className="flex items-center gap-3">
            <div className="flex bg-gray-100 rounded-lg p-1">
              {(['week', 'month', 'quarter'] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize ${
                    selectedPeriod === period
                      ? 'bg-white text-kanva-green shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* My Metrics */}
      {myMetrics && (
        <>
          {/* Key Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Calls */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <Phone className="w-6 h-6 text-blue-600" />
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Total Calls</p>
                  <p className="text-3xl font-bold text-gray-900">{myMetrics.totalCalls}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">This {selectedPeriod}</span>
                {renderSparkline(getSparklineData(myMetrics.callsByDay))}
              </div>
            </div>

            {/* Inbound */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-green-50 rounded-lg">
                  <Phone className="w-6 h-6 text-green-600 rotate-180" />
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Inbound</p>
                  <p className="text-3xl font-bold text-gray-900">{myMetrics.inboundCalls}</p>
                </div>
              </div>
              <div className="text-xs text-gray-500">
                {myMetrics.totalCalls > 0 
                  ? `${Math.round((myMetrics.inboundCalls / myMetrics.totalCalls) * 100)}% of total`
                  : 'No calls yet'}
              </div>
            </div>

            {/* Outbound */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-purple-50 rounded-lg">
                  <Phone className="w-6 h-6 text-purple-600" />
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Outbound</p>
                  <p className="text-3xl font-bold text-gray-900">{myMetrics.outboundCalls}</p>
                </div>
              </div>
              <div className="text-xs text-gray-500">
                {myMetrics.totalCalls > 0
                  ? `${Math.round((myMetrics.outboundCalls / myMetrics.totalCalls) * 100)}% of total`
                  : 'No calls yet'}
              </div>
            </div>

            {/* Talk Time */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-orange-50 rounded-lg">
                  <Clock className="w-6 h-6 text-orange-600" />
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Talk Time</p>
                  <p className="text-3xl font-bold text-gray-900">{formatDuration(myMetrics.totalDuration)}</p>
                </div>
              </div>
              <div className="text-xs text-gray-500">
                Avg: {formatDuration(myMetrics.averageDuration)} per call
              </div>
            </div>
          </div>

          {/* Call Performance */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-kanva-green" />
              Call Performance
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Completed */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Completed</span>
                  <span className="text-2xl font-bold text-green-600">{myMetrics.completedCalls}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{
                      width: `${myMetrics.totalCalls > 0 ? (myMetrics.completedCalls / myMetrics.totalCalls) * 100 : 0}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {myMetrics.totalCalls > 0
                    ? `${Math.round((myMetrics.completedCalls / myMetrics.totalCalls) * 100)}% success rate`
                    : 'N/A'}
                </p>
              </div>

              {/* Missed */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Missed</span>
                  <span className="text-2xl font-bold text-red-600">{myMetrics.missedCalls}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-red-600 h-2 rounded-full"
                    style={{
                      width: `${myMetrics.totalCalls > 0 ? (myMetrics.missedCalls / myMetrics.totalCalls) * 100 : 0}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {myMetrics.totalCalls > 0
                    ? `${Math.round((myMetrics.missedCalls / myMetrics.totalCalls) * 100)}% missed`
                    : 'N/A'}
                </p>
              </div>

              {/* Connection Rate */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Connection Rate</span>
                  <span className="text-2xl font-bold text-blue-600">
                    {myMetrics.totalCalls > 0
                      ? `${Math.round((myMetrics.completedCalls / myMetrics.totalCalls) * 100)}%`
                      : '0%'}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{
                      width: `${myMetrics.totalCalls > 0 ? (myMetrics.completedCalls / myMetrics.totalCalls) * 100 : 0}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Industry avg: 65%
                </p>
              </div>
            </div>
          </div>

          {/* Daily Activity Chart */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-kanva-green" />
              Daily Activity
            </h2>
            
            <div className="space-y-2">
              {Object.entries(myMetrics.callsByDay)
                .sort(([a], [b]) => b.localeCompare(a))
                .slice(0, 14)
                .map(([date, count]) => (
                  <div key={date} className="flex items-center gap-4">
                    <span className="text-sm text-gray-600 w-24">{format(new Date(date), 'MMM dd')}</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-8 relative">
                      <div
                        className="bg-kanva-green h-8 rounded-full flex items-center justify-end pr-3"
                        style={{
                          width: `${Math.min((count / Math.max(...Object.values(myMetrics.callsByDay))) * 100, 100)}%`,
                        }}
                      >
                        <span className="text-sm font-medium text-white">{count}</span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}

      {/* Team Performance (Admin Only) */}
      {isAdmin && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-kanva-green" />
            Team Performance
          </h2>
          <p className="text-sm text-gray-500">Team metrics coming soon...</p>
        </div>
      )}
    </div>
  );
}

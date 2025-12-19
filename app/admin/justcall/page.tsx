'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase/client';
import JustCallMetrics from '@/components/JustCallMetrics';
import { Phone, Users, Calendar } from 'lucide-react';

interface JustCallUser {
  id: number;
  email: string;
  name: string;
  phone?: string;
  status?: string;
}

export default function JustCallAdminPage() {
  const [users, setUsers] = useState<JustCallUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/justcall/users');
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to load users');
      }

      const data = await response.json();
      setUsers(data.users || []);
      
      // Auto-select current user if available
      const currentUser = auth.currentUser;
      if (currentUser?.email) {
        const matchingUser = data.users.find(
          (u: JustCallUser) => u.email.toLowerCase() === currentUser.email?.toLowerCase()
        );
        if (matchingUser) {
          setSelectedUser(matchingUser.email);
        }
      }
    } catch (err: any) {
      console.error('[JustCall Admin] Error loading users:', err);
      setError(err.message || 'Failed to load JustCall users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (user) {
        loadUsers();
      }
    });
    return () => unsub();
  }, []);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Phone className="w-8 h-8 text-kanva-green" />
          <h1 className="text-3xl font-bold text-gray-900">JustCall Integration</h1>
        </div>
        <p className="text-gray-600">
          Real-time calling metrics from JustCall API
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600 font-medium">Error</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <button
            onClick={loadUsers}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
          >
            Retry
          </button>
        </div>
      )}

      {/* User Selection */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold">Select User</h2>
        </div>
        
        {loading ? (
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-kanva-green"></div>
            <span className="text-gray-600">Loading users...</span>
          </div>
        ) : users.length === 0 ? (
          <p className="text-gray-600">No JustCall users found</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {users.map((user) => (
              <button
                key={user.id}
                onClick={() => setSelectedUser(user.email)}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  selectedUser === user.email
                    ? 'border-kanva-green bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="font-medium text-gray-900">{user.name}</p>
                <p className="text-sm text-gray-600">{user.email}</p>
                {user.phone && (
                  <p className="text-xs text-gray-500 mt-1">{user.phone}</p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Date Range Selection */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold">Date Range</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={() => {
                const today = new Date().toISOString().split('T')[0];
                const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split('T')[0];
                setDateRange({ startDate: last7Days, endDate: today });
              }}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm"
            >
              Last 7 Days
            </button>
            <button
              onClick={() => {
                const today = new Date().toISOString().split('T')[0];
                const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split('T')[0];
                setDateRange({ startDate: last30Days, endDate: today });
              }}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm"
            >
              Last 30 Days
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Display */}
      {selectedUser ? (
        <JustCallMetrics
          userEmail={selectedUser}
          startDate={dateRange.startDate}
          endDate={dateRange.endDate}
          autoRefresh={true}
          refreshInterval={60000}
        />
      ) : (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <Phone className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">Select a user to view their call metrics</p>
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChange } from '@/lib/firebase/client';
import { userService } from '@/lib/firebase/services';
import Link from 'next/link';
import { Settings, Users, Target, Database, Phone, FileText, DollarSign, Sliders, Plug, BarChart3, Wrench, Package } from 'lucide-react';


export default function AdminPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Check authentication and authorization
  useEffect(() => {
    const unsub = onAuthStateChange(async (firebaseUser) => {
      if (!firebaseUser) {
        setCurrentUser(null);
        setLoading(false);
        return;
      }

      const userData = await userService.getUser(firebaseUser.uid);
      if (userData && (userData.role === 'admin' || userData.role === 'manager')) {
        setCurrentUser(userData);
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-kanva-green border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'manager')) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-white shadow-sm rounded-xl p-8 max-w-md w-full text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-sm text-gray-600 mb-6">You need admin or manager privileges to access this page.</p>
          <Link href="/" className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-kanva-green text-white hover:bg-green-600 transition-colors">
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  // Overview Dashboard Component
  const OverviewDashboard = () => (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Total Users</span>
            <Users className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">-</p>
          <p className="text-xs text-gray-500 mt-1">Active team members</p>
        </div>
        
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Products</span>
            <Package className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">-</p>
          <p className="text-xs text-gray-500 mt-1">In catalog</p>
        </div>
        
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Active Goals</span>
            <Target className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">-</p>
          <p className="text-xs text-gray-500 mt-1">Team targets</p>
        </div>
        
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Integrations</span>
            <Plug className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">3</p>
          <p className="text-xs text-gray-500 mt-1">Connected services</p>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Admin Activity</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-gray-600">System running normally</span>
            <span className="ml-auto text-gray-400">Just now</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-gray-600">All integrations connected</span>
            <span className="ml-auto text-gray-400">5 min ago</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* System Settings */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-600" />
            System Settings
          </h3>
          <div className="space-y-3">
            <Link href="/admin/users" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">User Management</span>
              </div>
              <span className="text-xs text-gray-400">→</span>
            </Link>
            <Link href="/admin/goals" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <Target className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">Team Goals</span>
              </div>
              <span className="text-xs text-gray-400">→</span>
            </Link>
            <Link href="/settings" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <DollarSign className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">Commission Settings</span>
              </div>
              <span className="text-xs text-gray-400">→</span>
            </Link>
          </div>
        </div>

        {/* Integrations */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Plug className="w-5 h-5 text-gray-600" />
            Integrations
          </h3>
          <div className="space-y-3">
            <Link href="/admin/tools" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <Wrench className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">Import Tools</span>
              </div>
              <span className="text-xs text-gray-400">→</span>
            </Link>
            <Link href="/admin/justcall" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">JustCall</span>
              </div>
              <span className="text-xs text-gray-400">→</span>
            </Link>
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
              <div className="flex items-center gap-3">
                <Database className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium text-gray-700">Copper CRM</span>
              </div>
              <span className="text-xs text-green-600">Connected</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
            <p className="text-sm text-gray-500 mt-1">Portal-wide administration, integrations, and system settings</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/settings" className="text-sm bg-gray-100 px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-200">
              Commission Settings →
            </Link>
            <Link href="/" className="text-sm text-kanva-green hover:underline">
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <OverviewDashboard />
    </div>
  );
}

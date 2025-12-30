'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChange } from '@/lib/firebase/client';
import { userService } from '@/lib/firebase/services';
import Link from 'next/link';
import { Settings, Users, Target, Database, Phone, FileText, DollarSign, Sliders, Plug, BarChart3, Wrench } from 'lucide-react';

// Import tab components
import TeamGoalsTab from '@/components/admin/TeamGoalsTab';
import CopperMetadataTab from '@/components/admin/CopperMetadataTab';
import DataSyncTab from '@/components/admin/DataSyncTab';
import JustCallTab from '@/components/admin/JustCallTab';
import AdminUtilitiesTab from '@/components/admin/AdminUtilitiesTab';
import FishbowlTab from '@/components/admin/FishbowlTab';
import SettingsTab from '@/components/admin/SettingsTab';
import SalesTeamTab from '@/app/settings/SalesTeamTab';
import OrgChartTab from '@/app/settings/OrgChartTab';

type TabType = 'overview' | 'users' | 'team' | 'organization' | 'goals' | 'copper' | 'sync' | 'justcall' | 'fishbowl' | 'settings' | 'utilities';

// Tab groups for organization
const tabGroups = [
  {
    label: 'Overview',
    tabs: [
      { id: 'overview' as TabType, label: 'Dashboard', icon: BarChart3 },
    ]
  },
  {
    label: 'User Management',
    tabs: [
      { id: 'users' as TabType, label: 'Users', icon: Users },
      { id: 'team' as TabType, label: 'Sales Team', icon: Users },
      { id: 'organization' as TabType, label: 'Organization', icon: Target },
    ]
  },
  {
    label: 'Integrations',
    tabs: [
      { id: 'copper' as TabType, label: 'Copper CRM', icon: Database },
      { id: 'fishbowl' as TabType, label: 'Fishbowl ERP', icon: DollarSign },
      { id: 'justcall' as TabType, label: 'JustCall', icon: Phone },
    ]
  },
  {
    label: 'Data Management',
    tabs: [
      { id: 'sync' as TabType, label: 'Data Sync', icon: FileText },
      { id: 'goals' as TabType, label: 'Team Goals', icon: Target },
    ]
  },
  {
    label: 'System',
    tabs: [
      { id: 'settings' as TabType, label: 'Portal Settings', icon: Sliders },
      { id: 'utilities' as TabType, label: 'Admin Tools', icon: Wrench },
    ]
  }
];

export default function AdminPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Quick Links */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-5 border border-green-200">
          <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
            <Plug className="w-5 h-5" />
            Integrations
          </h3>
          <p className="text-sm text-green-700 mb-3">Configure connections to Copper CRM, Fishbowl ERP, and JustCall.</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setActiveTab('copper')} className="text-xs bg-white px-3 py-1.5 rounded-lg text-green-700 hover:bg-green-50 border border-green-200">
              Copper CRM
            </button>
            <button onClick={() => setActiveTab('fishbowl')} className="text-xs bg-white px-3 py-1.5 rounded-lg text-green-700 hover:bg-green-50 border border-green-200">
              Fishbowl ERP
            </button>
            <button onClick={() => setActiveTab('justcall')} className="text-xs bg-white px-3 py-1.5 rounded-lg text-green-700 hover:bg-green-50 border border-green-200">
              JustCall
            </button>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 border border-blue-200">
          <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Data Management
          </h3>
          <p className="text-sm text-blue-700 mb-3">Sync data between systems and manage team goals.</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setActiveTab('sync')} className="text-xs bg-white px-3 py-1.5 rounded-lg text-blue-700 hover:bg-blue-50 border border-blue-200">
              Data Sync
            </button>
            <button onClick={() => setActiveTab('goals')} className="text-xs bg-white px-3 py-1.5 rounded-lg text-blue-700 hover:bg-blue-50 border border-blue-200">
              Team Goals
            </button>
            <Link href="/admin/tools" className="text-xs bg-white px-3 py-1.5 rounded-lg text-blue-700 hover:bg-blue-50 border border-blue-200">
              Import Tools
            </Link>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-5 border border-orange-200">
          <h3 className="font-semibold text-orange-800 mb-3 flex items-center gap-2">
            <Users className="w-5 h-5" />
            User Management
          </h3>
          <p className="text-sm text-orange-700 mb-3">Manage users, sales team, and organizational structure.</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setActiveTab('users')} className="text-xs bg-white px-3 py-1.5 rounded-lg text-orange-700 hover:bg-orange-50 border border-orange-200">
              Users
            </button>
            <button onClick={() => setActiveTab('team')} className="text-xs bg-white px-3 py-1.5 rounded-lg text-orange-700 hover:bg-orange-50 border border-orange-200">
              Sales Team
            </button>
            <button onClick={() => setActiveTab('organization')} className="text-xs bg-white px-3 py-1.5 rounded-lg text-orange-700 hover:bg-orange-50 border border-orange-200">
              Organization
            </button>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-5 border border-purple-200">
          <h3 className="font-semibold text-purple-800 mb-3 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            System Settings
          </h3>
          <p className="text-sm text-purple-700 mb-3">Configure portal settings and access admin utilities.</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setActiveTab('settings')} className="text-xs bg-white px-3 py-1.5 rounded-lg text-purple-700 hover:bg-purple-50 border border-purple-200">
              Portal Settings
            </button>
            <button onClick={() => setActiveTab('utilities')} className="text-xs bg-white px-3 py-1.5 rounded-lg text-purple-700 hover:bg-purple-50 border border-purple-200">
              Admin Tools
            </button>
          </div>
        </div>
      </div>

      {/* Commission Settings Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <h4 className="font-medium text-amber-800 mb-2">💰 Commission Settings</h4>
        <p className="text-sm text-amber-700">
          <strong>Commission-specific settings</strong> (commission rates, rules, customers, products) 
          are managed in the <Link href="/settings" className="underline font-medium hover:text-amber-900">Commission Settings page</Link>.
          <strong> User management</strong> (sales team, organization) is now centralized here in Admin.
        </p>
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

      {/* Grouped Tabs */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="border-b border-gray-200 px-4 pt-2">
          <div className="flex flex-wrap items-center gap-1">
            {tabGroups.map((group, groupIndex) => (
              <div key={group.label} className="flex items-center">
                {groupIndex > 0 && (
                  <div className="h-6 w-px bg-gray-200 mx-2" />
                )}
                <span className="text-xs text-gray-400 uppercase tracking-wider mr-2 hidden lg:inline">{group.label}:</span>
                {group.tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                        activeTab === tab.id
                          ? 'border-kanva-green text-kanva-green'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'overview' && <OverviewDashboard />}
          {activeTab === 'users' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">User Management</h2>
              <p className="text-gray-600 mb-4">Basic user creation and authentication management. For commission and organizational settings, use the Sales Team and Organization tabs.</p>
              <Link href="/admin/users" className="btn btn-primary">
                Go to User Management →
              </Link>
            </div>
          )}
          {activeTab === 'team' && <SalesTeamTab isAdmin={true} />}
          {activeTab === 'organization' && <OrgChartTab isAdmin={true} />}
          {activeTab === 'goals' && <TeamGoalsTab />}
          {activeTab === 'copper' && <CopperMetadataTab />}
          {activeTab === 'sync' && <DataSyncTab />}
          {activeTab === 'justcall' && <JustCallTab />}
          {activeTab === 'fishbowl' && <FishbowlTab />}
          {activeTab === 'settings' && <SettingsTab />}
          {activeTab === 'utilities' && <AdminUtilitiesTab />}
        </div>
      </div>
    </div>
  );
}

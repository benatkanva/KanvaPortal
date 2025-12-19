'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChange } from '@/lib/firebase/client';
import { userService } from '@/lib/firebase/services';
import Link from 'next/link';
import { Settings, Users, Target, Database, Phone, FileText, DollarSign, Sliders } from 'lucide-react';

// Import tab components
import TeamGoalsTab from '@/components/admin/TeamGoalsTab';
import CopperMetadataTab from '@/components/admin/CopperMetadataTab';
import DataSyncTab from '@/components/admin/DataSyncTab';
import JustCallTab from '@/components/admin/JustCallTab';
import AdminUtilitiesTab from '@/components/admin/AdminUtilitiesTab';
import FishbowlTab from '@/components/admin/FishbowlTab';
import SettingsTab from '@/components/admin/SettingsTab';

type TabType = 'goals' | 'copper' | 'sync' | 'justcall' | 'fishbowl' | 'settings' | 'utilities';

export default function AdminPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('goals');

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
          <p className="text-gray-600">Loading settings...</p>
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

  const tabs = [
    { id: 'goals' as TabType, label: 'Team Goals', icon: Target },
    { id: 'copper' as TabType, label: 'Copper Setup', icon: Database },
    { id: 'sync' as TabType, label: 'Data Sync', icon: FileText },
    { id: 'justcall' as TabType, label: 'JustCall', icon: Phone },
    { id: 'fishbowl' as TabType, label: 'Fishbowl Sales', icon: DollarSign },
    { id: 'settings' as TabType, label: 'Business Settings', icon: Sliders },
    { id: 'utilities' as TabType, label: 'Admin Tools', icon: Settings },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Settings</h1>
            <p className="text-sm text-gray-500 mt-1">Manage team goals, integrations, and system settings</p>
          </div>
          <Link href="/" className="text-sm text-kanva-green hover:underline">
            ← Back to Home
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-kanva-green text-kanva-green'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
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

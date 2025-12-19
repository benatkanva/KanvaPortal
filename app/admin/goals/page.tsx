'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { User, Goal, GoalType, GoalPeriod } from '@/types';
import { auth, onAuthStateChange } from '@/lib/firebase/client';
import { userService, goalService } from '@/lib/firebase/services';
import toast from 'react-hot-toast';
import Link from 'next/link';

const goalTypes: GoalType[] = [
  'phone_call_quantity',
  'email_quantity',
  'sms_quantity',
  'lead_progression_a',
  'lead_progression_b',
  'lead_progression_c',
  'new_sales_wholesale',
  'new_sales_distribution'
];

const periodLabels: Record<GoalPeriod, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
};

interface TeamMemberGoals {
  userId: string;
  userName: string;
  userEmail: string;
  goals: Record<GoalPeriod, Record<GoalType, number>>;
}

export default function AdminGoalsPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<TeamMemberGoals[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<GoalPeriod>('daily');
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [editingGoals, setEditingGoals] = useState<Record<GoalType, number>>({
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
  const [saving, setSaving] = useState(false);

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
        loadTeamData();
      } else {
        setCurrentUser(null);
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const loadTeamData = async () => {
    setLoading(true);
    try {
      // Fetch all users
      const response = await fetch('/api/admin/users', { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to fetch users');
      
      const data = await response.json();
      const users = data.users || [];

      // Fetch goals for each user
      const teamData: TeamMemberGoals[] = [];
      
      for (const user of users) {
        const memberGoals: Record<GoalPeriod, Record<GoalType, number>> = {
          daily: {} as Record<GoalType, number>,
          weekly: {} as Record<GoalType, number>,
          monthly: {} as Record<GoalType, number>,
          quarterly: {} as Record<GoalType, number>,
        };

        // Fetch goals for each period
        for (const period of ['daily', 'weekly', 'monthly', 'quarterly'] as GoalPeriod[]) {
          const goals = await goalService.getUserGoals(user.id, period);
          
          goalTypes.forEach(type => {
            const goal = goals.find(g => g.type === type);
            memberGoals[period][type] = goal?.target || 0;
          });
        }

        teamData.push({
          userId: user.id,
          userName: user.name || user.email?.split('@')[0] || 'Unknown',
          userEmail: user.email || '',
          goals: memberGoals,
        });
      }

      setTeamMembers(teamData);
    } catch (error) {
      console.error('Error loading team data:', error);
      toast.error('Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  const handleEditMember = (member: TeamMemberGoals) => {
    setSelectedMember(member.userId);
    setEditingGoals(member.goals[selectedPeriod]);
  };

  const handleSaveGoals = async () => {
    if (!selectedMember) return;

    setSaving(true);
    try {
      // Save each goal
      const promises = goalTypes.map(async (type) => {
        const target = editingGoals[type];
        if (target > 0) {
          // Create or update goal
          const response = await fetch('/api/admin/goals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: selectedMember,
              type,
              period: selectedPeriod,
              target,
            }),
          });

          if (!response.ok) {
            throw new Error(`Failed to save ${type} goal`);
          }
        }
      });

      await Promise.all(promises);
      
      toast.success('Goals saved successfully');
      setSelectedMember(null);
      loadTeamData(); // Reload data
    } catch (error: any) {
      console.error('Error saving goals:', error);
      toast.error(error.message || 'Failed to save goals');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkApply = async () => {
    if (!window.confirm('Apply these goals to ALL team members?')) return;

    setSaving(true);
    try {
      const promises = teamMembers.map(member =>
        fetch('/api/admin/goals/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: member.userId,
            period: selectedPeriod,
            goals: editingGoals,
          }),
        })
      );

      await Promise.all(promises);
      toast.success('Goals applied to all team members');
      setSelectedMember(null);
      loadTeamData();
    } catch (error) {
      console.error('Error applying bulk goals:', error);
      toast.error('Failed to apply goals to all members');
    } finally {
      setSaving(false);
    }
  };

  const getGoalLabel = (type: GoalType): string => {
    const labels: Record<GoalType, string> = {
      phone_call_quantity: 'Phone Calls',
      talk_time_minutes: 'Talk Time (min)',
      email_quantity: 'Emails',
      sms_quantity: 'Text Messages',
      lead_progression_a: 'Lead Stage A',
      lead_progression_b: 'Lead Stage B',
      lead_progression_c: 'Lead Stage C',
      new_sales_wholesale: 'Wholesale Sales ($)',
      new_sales_distribution: 'Distribution Sales ($)',
    };
    return labels[type];
  };

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Team Goals Management</h1>
            <p className="text-sm text-gray-500 mt-1">Set and manage goals for your team members</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-gray-100 rounded-lg p-1">
              {(['daily', 'weekly', 'monthly', 'quarterly'] as GoalPeriod[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setSelectedPeriod(p)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    selectedPeriod === p ? 'bg-white text-kanva-green shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {periodLabels[p]}
                </button>
              ))}
            </div>
            <Link href="/" className="text-sm text-kanva-green hover:underline">
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>

      {/* Team Members Table */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="text-xl font-bold mb-4">Team Members ({teamMembers.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Team Member</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Calls</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Emails</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Leads</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Sales</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {teamMembers.map((member) => {
                const goals = member.goals[selectedPeriod];
                const totalLeads = (goals.lead_progression_a || 0) + (goals.lead_progression_b || 0) + (goals.lead_progression_c || 0);
                const totalSales = (goals.new_sales_wholesale || 0) + (goals.new_sales_distribution || 0);
                
                return (
                  <tr key={member.userId} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div>
                        <div className="font-semibold text-gray-900">{member.userName}</div>
                        <div className="text-xs text-gray-500">{member.userEmail}</div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right text-gray-900">{goals.phone_call_quantity || 0}</td>
                    <td className="py-4 px-4 text-right text-gray-900">{goals.email_quantity || 0}</td>
                    <td className="py-4 px-4 text-right text-gray-900">{totalLeads}</td>
                    <td className="py-4 px-4 text-right text-gray-900">${totalSales.toLocaleString()}</td>
                    <td className="py-4 px-4 text-center">
                      <button
                        onClick={() => handleEditMember(member)}
                        className="px-3 py-1 rounded-md bg-kanva-green text-white text-sm hover:bg-green-600"
                      >
                        Edit Goals
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Goal Editor Modal */}
      {selectedMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">
                  Edit {periodLabels[selectedPeriod]} Goals
                </h3>
                <button
                  onClick={() => setSelectedMember(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                {goalTypes.map((type) => (
                  <div key={type} className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700 w-1/2">
                      {getGoalLabel(type)}
                    </label>
                    <input
                      type="number"
                      value={editingGoals[type] || 0}
                      onChange={(e) => setEditingGoals({
                        ...editingGoals,
                        [type]: Number(e.target.value) || 0,
                      })}
                      className="w-1/2 border rounded-md px-3 py-2"
                      min="0"
                      step={type.startsWith('new_sales_') ? '100' : '1'}
                    />
                  </div>
                ))}
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleSaveGoals}
                  disabled={saving}
                  className="flex-1 px-4 py-2 rounded-lg bg-kanva-green text-white hover:bg-green-600 disabled:bg-gray-400"
                >
                  {saving ? 'Saving...' : 'Save Goals'}
                </button>
                <button
                  onClick={handleBulkApply}
                  disabled={saving}
                  className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {saving ? 'Applying...' : 'Apply to All'}
                </button>
                <button
                  onClick={() => setSelectedMember(null)}
                  className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

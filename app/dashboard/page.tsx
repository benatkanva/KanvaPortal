'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase/config';
import { collection, query, getDocs, orderBy, limit, where } from 'firebase/firestore';
import { useAuth } from '@/lib/contexts/AuthContext';
import { 
  Phone,
  Mail,
  MessageSquare,
  FileText,
  Calendar,
  CheckCircle2,
  Clock,
  Users,
  Building2,
  UserPlus,
  TrendingUp,
  DollarSign,
  Target,
  ChevronRight,
  Activity,
  Bell
} from 'lucide-react';
import Image from 'next/image';

interface ActivityItem {
  id: string;
  type: 'call' | 'email' | 'sms' | 'note' | 'task' | 'order';
  title: string;
  description: string;
  contact?: string;
  company?: string;
  timestamp: Date;
  user: string;
}

interface QuickStat {
  label: string;
  value: string | number;
  change?: string;
  icon: React.ReactNode;
  color: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, userProfile, loading: authLoading, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [stats, setStats] = useState({
    totalCustomers: 0,
    activeProspects: 0,
    pendingTasks: 0,
    monthlyOrders: 0,
  });

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      router.push('/login');
      return;
    }

    const loadDashboardData = async () => {
      try {
        // Load recent activities (placeholder - will connect to real data)
        const mockActivities: ActivityItem[] = [
          {
            id: '1',
            type: 'call',
            title: 'Phone call with Rob Nichols',
            description: 'Outgoing Call (Unanswered)',
            contact: 'Rob Nichols',
            company: 'Smoke Spot',
            timestamp: new Date(),
            user: userProfile?.name || 'You',
          },
          {
            id: '2',
            type: 'email',
            title: 'Email sent to Kevin',
            description: 'RE: SO 9940 - Kanva Botanicals - Payment confirmation',
            contact: 'Kevin',
            company: 'NorthWest Wholesale',
            timestamp: new Date(Date.now() - 3600000),
            user: userProfile?.name || 'You',
          },
          {
            id: '3',
            type: 'order',
            title: 'New order submitted',
            description: 'SO 9946 - 3 cases Focus + Flow, 2 cases Release',
            contact: 'Wilson Bean',
            company: 'Pacific Distributors',
            timestamp: new Date(Date.now() - 7200000),
            user: userProfile?.name || 'You',
          },
          {
            id: '4',
            type: 'task',
            title: 'Follow up with Luis Orozco',
            description: 'Voicemail Received - callback requested',
            contact: 'Luis Orozco',
            company: 'Kanva Botanicals',
            timestamp: new Date(Date.now() - 86400000),
            user: userProfile?.name || 'You',
          },
          {
            id: '5',
            type: 'sms',
            title: 'SMS to Rob Nichols',
            description: 'Conversation with Rob - AE #2026099391',
            contact: 'Rob Nichols',
            company: 'Smoke Spot',
            timestamp: new Date(Date.now() - 172800000),
            user: userProfile?.name || 'You',
          },
        ];
        setActivities(mockActivities);

        // Load quick stats from Firestore
        const customersSnap = await getDocs(collection(db, 'customers'));
        const ordersQuery = query(
          collection(db, 'fishbowl_sales_orders'),
          orderBy('dateCreated', 'desc'),
          limit(100)
        );
        const ordersSnap = await getDocs(ordersQuery);

        setStats({
          totalCustomers: customersSnap.size,
          activeProspects: Math.floor(customersSnap.size * 0.15), // Placeholder
          pendingTasks: 8, // Placeholder
          monthlyOrders: ordersSnap.size,
        });
      } catch (error) {
        console.error('Error loading dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [authLoading, user, router, userProfile]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'call': return <Phone className="w-4 h-4" />;
      case 'email': return <Mail className="w-4 h-4" />;
      case 'sms': return <MessageSquare className="w-4 h-4" />;
      case 'note': return <FileText className="w-4 h-4" />;
      case 'task': return <CheckCircle2 className="w-4 h-4" />;
      case 'order': return <DollarSign className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'call': return 'bg-blue-100 text-blue-600';
      case 'email': return 'bg-purple-100 text-purple-600';
      case 'sms': return 'bg-green-100 text-green-600';
      case 'note': return 'bg-gray-100 text-gray-600';
      case 'task': return 'bg-orange-100 text-orange-600';
      case 'order': return 'bg-emerald-100 text-emerald-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-[#93D500] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const quickStats: QuickStat[] = [
    { 
      label: 'Total Customers', 
      value: stats.totalCustomers, 
      icon: <Building2 className="w-5 h-5" />,
      color: 'text-blue-600'
    },
    { 
      label: 'Active Prospects', 
      value: stats.activeProspects, 
      icon: <UserPlus className="w-5 h-5" />,
      color: 'text-purple-600'
    },
    { 
      label: 'Pending Tasks', 
      value: stats.pendingTasks, 
      icon: <Clock className="w-5 h-5" />,
      color: 'text-orange-600'
    },
    { 
      label: 'Monthly Orders', 
      value: stats.monthlyOrders, 
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'text-green-600'
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome to your Feed, {userProfile?.name?.split(' ')[0] || 'there'} 👋
          </h1>
          <p className="text-gray-500 mt-1">
            Your relationships, your activities, the heartbeat of your business. All in one place.
          </p>
        </div>
        <button className="bg-[#93D500] hover:bg-[#84c000] text-black font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
          <Bell className="w-4 h-4" />
          Activity Report
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {quickStats.map((stat, index) => (
          <div key={index} className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className={`${stat.color}`}>{stat.icon}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-sm text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Activity Feed - Main Column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
            <div className="flex items-center gap-2 text-sm">
              <button className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 font-medium">All</button>
              <button className="px-3 py-1.5 rounded-lg text-gray-500 hover:bg-gray-50">Following</button>
            </div>
          </div>

          {/* Activity Items */}
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {activities.map((activity) => (
              <div key={activity.id} className="p-4 hover:bg-gray-50 transition-colors cursor-pointer">
                <div className="flex items-start gap-3">
                  {/* Activity Icon */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getActivityColor(activity.type)}`}>
                    {getActivityIcon(activity.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-gray-900">{activity.user}</span>
                      <span className="text-gray-400">to</span>
                      <span className="font-medium text-[#93D500]">{activity.contact}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">{activity.title}</p>
                    <p className="text-sm text-gray-500 mt-1 truncate">{activity.description}</p>
                    {activity.company && (
                      <span className="inline-block mt-2 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                        {activity.company}
                      </span>
                    )}
                  </div>

                  {/* Timestamp */}
                  <div className="text-xs text-gray-400 whitespace-nowrap">
                    {formatTime(activity.timestamp)}
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-3 mt-3 ml-11">
                  <button className="text-gray-400 hover:text-gray-600 text-sm">Reply</button>
                  <button className="text-gray-400 hover:text-gray-600 text-sm">Forward</button>
                  <button className="text-gray-400 hover:text-gray-600 text-sm">Add Note</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Follow-up Reminders */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-4">Keep things moving</h3>
            
            <div className="space-y-3">
              <div className="p-3 bg-orange-50 rounded-lg border border-orange-100">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">Reply to Deyana</p>
                    <p className="text-xs text-gray-500 mt-0.5">Kanva Botanicals</p>
                  </div>
                  <button className="text-xs bg-orange-500 text-white px-2 py-1 rounded">REPLY</button>
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  You have not responded to an email that Deyana sent you 7 days ago.
                </p>
              </div>

              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">Follow up with Jackie Martin</p>
                    <p className="text-xs text-gray-500 mt-0.5">Kanva Botanicals</p>
                  </div>
                  <button className="text-xs text-blue-600 hover:underline">FOLLOW UP</button>
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  Jackie has not responded to an email you sent 4 days ago.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <button 
                onClick={() => router.push('/customers')}
                className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-700">View Customers</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
              <button 
                onClick={() => router.push('/commissions')}
                className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <DollarSign className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-700">View Commissions</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
              <button 
                onClick={() => router.push('/goals/dashboard')}
                className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Target className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-700">Sales Goals</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
              <button 
                onClick={() => router.push('/quotes')}
                className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-700">Create Quote</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Team Members (Admin only) */}
          {isAdmin && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Invite Team Members</h3>
              <p className="text-xs text-gray-500 mb-3">Add team members to collaborate with them on Copper.</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#93D500]/20 flex items-center justify-center text-xs font-medium text-[#93D500]">
                      BT
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Blessing Team</p>
                      <p className="text-xs text-gray-500">production@...</p>
                    </div>
                  </div>
                  <button className="text-xs bg-[#93D500] text-black px-3 py-1 rounded font-medium">ADD</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

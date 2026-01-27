'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { X, Mail, CheckCircle2, Clock, Calendar, User as UserIcon, Building2, Plus, MoreVertical, Paperclip } from 'lucide-react';
import Image from 'next/image';

type TabType = 'DETAILS' | 'NOTES' | 'RELATED';

export default function TaskDetailPage() {
  const router = useRouter();
  const params = useParams();
  const taskId = params?.id as string;
  const { user, loading: authLoading } = useAuth();
  
  const [activeTab, setActiveTab] = useState<TabType>('DETAILS');
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!taskId || !user) return;
    
    // TODO: Fetch task data from Supabase
    const fetchTask = async () => {
      try {
        setLoading(true);
        // Placeholder - will implement actual fetch
        setTask({
          id: taskId,
          name: 'Sample Task',
          status: 'pending',
          priority: 'high',
          due_date: new Date().toISOString(),
          owner: 'John Doe',
          details: 'Task details here...',
          related_to_type: 'person',
          related_to_id: '123',
        });
      } catch (error) {
        console.error('Error fetching task:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTask();
  }, [taskId, user]);

  // Auth check
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Image 
          src="/images/kanva_logo_rotate.gif" 
          alt="Loading..." 
          width={64}
          height={64}
          priority
          unoptimized
        />
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#93D500]"></div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-white" style={{ top: '64px' }}>
      <div className="h-full flex">
        {/* Main Content - Task List View */}
        <div className="flex-1 overflow-auto bg-gray-50">
          {/* Placeholder - keep the main tasks view visible */}
          <div className="p-6">
            <button
              onClick={() => router.push('/tasks')}
              className="text-sm text-gray-600 hover:text-gray-900 mb-4"
            >
              ← Back to Tasks
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Task View</h1>
          </div>
        </div>

        {/* Right Sidebar - Task Details */}
        <div className="w-[480px] border-l border-gray-200 bg-white flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const isCompleted = task?.status === 'completed';
                  // TODO: Toggle completion
                  console.log('Toggle completion');
                }}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  task?.status === 'completed' 
                    ? 'bg-green-500' 
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                {task?.status === 'completed' ? (
                  <CheckCircle2 className="w-6 h-6 text-white" />
                ) : (
                  <Clock className="w-6 h-6 text-gray-600" />
                )}
              </button>
              <div>
                <div className="text-xs text-gray-500">
                  Due: {task?.due_date ? new Date(task.due_date).toLocaleDateString() : 'No date'}
                </div>
                <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                    <CheckCircle2 className="w-3 h-3" />
                    Task
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 hover:bg-gray-100 rounded-md transition-colors">
                <Mail className="w-5 h-5 text-gray-600" />
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium">
                Follow
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-md transition-colors">
                <MoreVertical className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={() => router.push('/tasks')}
                className="p-2 hover:bg-gray-100 rounded-md transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Task Name */}
          <div className="px-4 py-3 border-b border-gray-200">
            <input
              type="text"
              value={task?.name || ''}
              onChange={(e) => {
                // TODO: Update task name
                console.log('Update name:', e.target.value);
              }}
              className="w-full text-lg font-semibold text-gray-900 border-none outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
              placeholder="Task name"
            />
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 flex">
            {(['DETAILS', 'NOTES', 'RELATED'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-auto p-4">
            {activeTab === 'DETAILS' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    value={task?.name || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    readOnly
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Activity Type</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                    <option>To Do</option>
                    <option>Email</option>
                    <option>Meeting</option>
                    <option>Phone Call</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Related To</label>
                  <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-md">
                    <UserIcon className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-blue-700">Contact Name</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={task?.due_date ? new Date(task.due_date).toISOString().split('T')[0] : ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Time</label>
                  <input
                    type="time"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Priority</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                    <option>None</option>
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Owner</label>
                  <input
                    type="text"
                    value={task?.owner || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    readOnly
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={task?.details || ''}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="Add description..."
                  />
                </div>
              </div>
            )}

            {activeTab === 'NOTES' && (
              <div className="space-y-4">
                <button className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-gray-400 hover:text-gray-700 transition-colors">
                  Create Note
                </button>
                
                <div className="space-y-4">
                  <div className="text-sm font-medium text-gray-900 mb-2">Today</div>
                  {/* Activity timeline will go here */}
                  <div className="text-sm text-gray-500 text-center py-8">
                    No notes yet
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'RELATED' && (
              <div className="space-y-6">
                {/* Subtasks Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-900">Subtasks (0)</h3>
                    <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                      <Plus className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    <button className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded border border-gray-200">
                      + Add subtask...
                    </button>
                  </div>
                </div>

                {/* Files Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-900">Files (0)</h3>
                    <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                      <Paperclip className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                  <div className="text-sm text-gray-500 text-center py-4 border-2 border-dashed border-gray-200 rounded-lg">
                    No files attached
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

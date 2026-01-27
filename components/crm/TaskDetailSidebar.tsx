'use client';

import { useState, useEffect } from 'react';
import { X, Mail, CheckCircle2, Clock, Calendar, User as UserIcon, Building2, Plus, MoreVertical, Paperclip, ChevronRight } from 'lucide-react';
import type { Task } from '@/lib/crm/types-crm';

type TabType = 'DETAILS' | 'NOTES' | 'RELATED';

interface TaskDetailSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  onUpdate?: (taskId: string, updates: Partial<Task>) => void;
  onToggleComplete?: (taskId: string, currentStatus: string) => void;
}

export function TaskDetailSidebar({ 
  isOpen, 
  onClose, 
  task,
  onUpdate,
  onToggleComplete 
}: TaskDetailSidebarProps) {
  const [activeTab, setActiveTab] = useState<TabType>('DETAILS');
  const [taskName, setTaskName] = useState('');
  const [taskDetails, setTaskDetails] = useState('');

  useEffect(() => {
    if (task) {
      setTaskName(task.name);
      setTaskDetails(task.details || '');
    }
  }, [task]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen || !task) return null;

  const isCompleted = task.status === 'completed' || task.status === 'Completed';

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-30 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className={`fixed top-0 right-0 h-full w-[520px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => onToggleComplete?.(task.id, task.status || 'pending')}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  isCompleted 
                    ? 'bg-green-500 hover:bg-green-600' 
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
                title={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-6 h-6 text-white" />
                ) : (
                  <Clock className="w-6 h-6 text-gray-600" />
                )}
              </button>
              <div>
                <div className="text-xs text-gray-500">
                  Due: {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No date'}
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
                onClick={onClose}
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
              value={taskName}
              onChange={(e) => {
                setTaskName(e.target.value);
                onUpdate?.(task.id, { name: e.target.value });
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
                    value={taskName}
                    onChange={(e) => setTaskName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Activity Type</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option>To Do</option>
                    <option>Email</option>
                    <option>Meeting</option>
                    <option>Phone Call</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Related To</label>
                  <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-md">
                    {task.related_to_type === 'person' ? (
                      <UserIcon className="w-4 h-4 text-blue-600" />
                    ) : task.related_to_type === 'account' ? (
                      <Building2 className="w-4 h-4 text-blue-600" />
                    ) : null}
                    <span className="text-sm text-blue-700">
                      {task.related_to_type ? `${task.related_to_type} ID: ${task.related_to_id}` : 'None'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Due Date</label>
                    <input
                      type="date"
                      value={task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : ''}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Time</label>
                    <input
                      type="time"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Priority</label>
                  <select 
                    value={task.priority || 'none'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="none">None</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Owner</label>
                  <input
                    type="text"
                    value={task.owner || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50"
                    readOnly
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                  <select 
                    value={task.status || 'pending'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={taskDetails}
                    onChange={(e) => {
                      setTaskDetails(e.target.value);
                      onUpdate?.(task.id, { details: e.target.value });
                    }}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Add description..."
                  />
                </div>
              </div>
            )}

            {activeTab === 'NOTES' && (
              <div className="space-y-4">
                <button className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-gray-400 hover:text-gray-700 transition-colors font-medium">
                  + Create Note
                </button>
                
                <div className="space-y-4">
                  <div className="text-sm font-medium text-gray-900 mb-2">Today</div>
                  <div className="text-sm text-gray-500 text-center py-8 bg-gray-50 rounded-lg">
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
                    <h3 className="text-sm font-semibold text-gray-900">Subtasks (0)</h3>
                    <button className="p-1.5 hover:bg-gray-100 rounded transition-colors">
                      <Plus className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    <button className="w-full text-left px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 rounded-md border border-gray-200 transition-colors">
                      + Add subtask...
                    </button>
                  </div>
                </div>

                {/* Files Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900">Files (0)</h3>
                    <button className="p-1.5 hover:bg-gray-100 rounded transition-colors">
                      <Paperclip className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                  <div className="text-sm text-gray-500 text-center py-6 border-2 border-dashed border-gray-200 rounded-lg">
                    Drag files here or click to upload
                  </div>
                </div>

                {/* Related Contact/Account */}
                {task.related_to_type && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-900">Related To</h3>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                      {task.related_to_type === 'person' ? (
                        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
                          <UserIcon className="w-5 h-5 text-white" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-white" />
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900 capitalize">
                          {task.related_to_type}
                        </div>
                        <div className="text-xs text-gray-500">ID: {task.related_to_id}</div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

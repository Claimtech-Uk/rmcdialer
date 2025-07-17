import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth';
import { 
  UserCircleIcon,
  PhoneIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  CogIcon,
  CalendarIcon,
  ChartBarIcon,
  EyeIcon,
  PencilIcon
} from '@heroicons/react/24/outline';

interface AgentStatus {
  id: string;
  agentId: number;
  status: 'available' | 'on_call' | 'break' | 'offline';
  currentCallSessionId?: string;
  loginAt: Date;
  logoutAt?: Date;
  callsCompletedToday: number;
  totalTalkTimeSeconds: number;
  lastActivity: Date;
}

interface AgentPerformance {
  today: {
    callsCompleted: number;
    totalTalkTime: number;
    averageCallDuration: number;
    successfulContacts: number;
    successRate: number;
  };
  thisWeek: {
    callsCompleted: number;
    totalTalkTime: number;
    averageCallDuration: number;
    successRate: number;
  };
  thisMonth: {
    callsCompleted: number;
    totalTalkTime: number;
    successRate: number;
  };
}

interface CallHistoryItem {
  id: string;
  userId: number;
  userName: string;
  phoneNumber: string;
  startedAt: Date;
  endedAt?: Date;
  durationSeconds?: number;
  status: string;
  outcome?: {
    type: string;
    notes: string;
  };
}

interface AgentProfile {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  preferences?: {
    autoBreakDuration?: number;
    callNotifications?: boolean;
    emailNotifications?: boolean;
  };
}

interface StatusControlsProps {
  currentStatus: string;
  onStatusChange: (status: string) => void;
  isUpdating: boolean;
}

function StatusControls({ currentStatus, onStatusChange, isUpdating }: StatusControlsProps) {
  const statusOptions = [
    { value: 'available', label: 'Available', icon: CheckCircleIcon, color: 'green' },
    { value: 'break', label: 'On Break', icon: ClockIcon, color: 'yellow' },
    { value: 'offline', label: 'Offline', icon: XCircleIcon, color: 'gray' }
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Agent Status</h3>
      
      <div className="space-y-2">
        {statusOptions.map((option) => {
          const Icon = option.icon;
          const isSelected = currentStatus === option.value;
          const colorClasses = {
            green: isSelected ? 'bg-green-50 border-green-500 text-green-700' : 'border-gray-200 text-gray-700 hover:bg-green-50',
            yellow: isSelected ? 'bg-yellow-50 border-yellow-500 text-yellow-700' : 'border-gray-200 text-gray-700 hover:bg-yellow-50',
            gray: isSelected ? 'bg-gray-50 border-gray-500 text-gray-700' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
          };

          return (
            <button
              key={option.value}
              onClick={() => onStatusChange(option.value)}
              disabled={isUpdating || currentStatus === 'on_call'}
              className={`w-full flex items-center p-3 border rounded-lg transition-colors ${
                colorClasses[option.color as keyof typeof colorClasses]
              } ${currentStatus === 'on_call' ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Icon className="h-5 w-5 mr-3" />
              <span className="font-medium">{option.label}</span>
              {isSelected && (
                <div className="ml-auto">
                  <div className={`w-2 h-2 rounded-full ${
                    option.color === 'green' ? 'bg-green-500' :
                    option.color === 'yellow' ? 'bg-yellow-500' : 'bg-gray-500'
                  }`} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {currentStatus === 'on_call' && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center text-blue-700">
            <PhoneIcon className="h-5 w-5 mr-2" />
            <span className="text-sm font-medium">Currently on a call</span>
          </div>
          <p className="text-sm text-blue-600 mt-1">
            Status will automatically return to "Available" when call ends
          </p>
        </div>
      )}
    </div>
  );
}

interface PerformanceMetricsProps {
  performance: AgentPerformance;
}

function PerformanceMetrics({ performance }: PerformanceMetricsProps) {
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const formatCallDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Today's Performance */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Performance</h3>
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{performance.today.callsCompleted}</div>
            <div className="text-sm text-gray-600">Calls Completed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {formatDuration(performance.today.totalTalkTime)}
            </div>
            <div className="text-sm text-gray-600">Talk Time</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {formatCallDuration(performance.today.averageCallDuration)}
            </div>
            <div className="text-sm text-gray-600">Avg Duration</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{performance.today.successRate}%</div>
            <div className="text-sm text-gray-600">Success Rate</div>
          </div>
        </div>
      </div>

      {/* Weekly & Monthly Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">This Week</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Calls Completed:</span>
              <span className="font-medium">{performance.thisWeek.callsCompleted}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Talk Time:</span>
              <span className="font-medium">{formatDuration(performance.thisWeek.totalTalkTime)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Success Rate:</span>
              <span className="font-medium">{performance.thisWeek.successRate}%</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">This Month</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Calls Completed:</span>
              <span className="font-medium">{performance.thisMonth.callsCompleted}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Talk Time:</span>
              <span className="font-medium">{formatDuration(performance.thisMonth.totalTalkTime)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Success Rate:</span>
              <span className="font-medium">{performance.thisMonth.successRate}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface RecentCallsProps {
  calls: CallHistoryItem[];
  onViewDetails: (callId: string) => void;
}

function RecentCalls({ calls, onViewDetails }: RecentCallsProps) {
  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getOutcomeColor = (outcome?: string) => {
    switch (outcome) {
      case 'contacted': return 'bg-green-100 text-green-800';
      case 'callback_requested': return 'bg-blue-100 text-blue-800';
      case 'not_interested': return 'bg-red-100 text-red-800';
      case 'no_answer': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Recent Calls</h3>
      </div>
      
      <div className="divide-y divide-gray-200">
        {calls.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No recent calls found
          </div>
        ) : (
          calls.map((call) => (
            <div key={call.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <div>
                      <div className="font-medium text-gray-900">{call.userName}</div>
                      <div className="text-sm text-gray-600">{call.phoneNumber}</div>
                    </div>
                    
                    {call.outcome && (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        getOutcomeColor(call.outcome.type)
                      }`}>
                        {call.outcome.type.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                  
                  <div className="mt-2 flex items-center space-x-4 text-sm text-gray-600">
                    <span>{formatTime(call.startedAt)}</span>
                    <span>{formatDuration(call.durationSeconds)}</span>
                    <span className="capitalize">{call.status}</span>
                  </div>
                  
                  {call.outcome?.notes && (
                    <div className="mt-2 text-sm text-gray-600 truncate max-w-md">
                      {call.outcome.notes}
                    </div>
                  )}
                </div>
                
                <button
                  onClick={() => onViewDetails(call.id)}
                  className="ml-4 p-2 text-gray-400 hover:text-gray-600"
                >
                  <EyeIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

interface ProfileSettingsProps {
  profile: AgentProfile;
  onSave: (preferences: any) => void;
}

function ProfileSettings({ profile, onSave }: ProfileSettingsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [preferences, setPreferences] = useState(profile.preferences || {});

  const handleSave = () => {
    onSave(preferences);
    setIsEditing(false);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Profile Settings</h3>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="text-blue-600 hover:text-blue-700 flex items-center"
        >
          <PencilIcon className="h-4 w-4 mr-1" />
          {isEditing ? 'Cancel' : 'Edit'}
        </button>
      </div>
      
      <div className="space-y-4">
        {/* Basic Info */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <div className="text-gray-900">
            {profile.firstName} {profile.lastName}
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <div className="text-gray-900">{profile.email}</div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <div className="text-gray-900 capitalize">{profile.role}</div>
        </div>

        {/* Preferences */}
        <div className="border-t pt-4">
          <h4 className="font-medium text-gray-900 mb-3">Preferences</h4>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-700">Call Notifications</label>
              <input
                type="checkbox"
                checked={preferences.callNotifications ?? true}
                onChange={(e) => setPreferences(prev => ({ 
                  ...prev, 
                  callNotifications: e.target.checked 
                }))}
                disabled={!isEditing}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-700">Email Notifications</label>
              <input
                type="checkbox"
                checked={preferences.emailNotifications ?? false}
                onChange={(e) => setPreferences(prev => ({ 
                  ...prev, 
                  emailNotifications: e.target.checked 
                }))}
                disabled={!isEditing}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-700">Auto-break duration (minutes)</label>
              <input
                type="number"
                value={preferences.autoBreakDuration ?? 15}
                onChange={(e) => setPreferences(prev => ({ 
                  ...prev, 
                  autoBreakDuration: parseInt(e.target.value) 
                }))}
                disabled={!isEditing}
                min="5"
                max="60"
                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
              />
            </div>
          </div>
        </div>
        
        {isEditing && (
          <div className="flex space-x-2 pt-4">
            <button
              onClick={handleSave}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              Save Changes
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function ProfilePage() {
  const { agent } = useAuthStore();
  const queryClient = useQueryClient();
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);

  // Fetch agent status
  const { data: agentStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['agent-status', agent?.id],
    queryFn: () => apiClient.get<AgentStatus>(`/api/agents/${agent?.id}/status`),
    enabled: !!agent?.id,
    refetchInterval: 10000 // Refresh every 10 seconds
  });

  // Fetch agent performance
  const { data: performance, isLoading: performanceLoading } = useQuery({
    queryKey: ['agent-performance', agent?.id],
    queryFn: () => apiClient.get<AgentPerformance>(`/api/agents/${agent?.id}/performance`),
    enabled: !!agent?.id,
    refetchInterval: 60000 // Refresh every minute
  });

  // Fetch recent calls
  const { data: recentCalls, isLoading: callsLoading } = useQuery({
    queryKey: ['agent-calls', agent?.id],
    queryFn: () => apiClient.get<CallHistoryItem[]>(`/api/agents/${agent?.id}/calls?limit=10`),
    enabled: !!agent?.id,
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Update agent status mutation
  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => 
      apiClient.put(`/api/agents/${agent?.id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-status', agent?.id] });
    }
  });

  // Update preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: (preferences: any) =>
      apiClient.put(`/api/agents/${agent?.id}/preferences`, { preferences }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-status', agent?.id] });
    }
  });

  const handleStatusChange = (status: string) => {
    updateStatusMutation.mutate(status);
  };

  const handlePreferencesUpdate = (preferences: any) => {
    updatePreferencesMutation.mutate(preferences);
  };

  const handleViewCallDetails = (callId: string) => {
    setSelectedCallId(callId);
    // Here you could open a modal or navigate to call details
    console.log('View call details:', callId);
  };

  if (statusLoading || performanceLoading) {
    return (
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center space-x-3">
          <UserCircleIcon className="h-8 w-8 text-gray-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {agent?.firstName} {agent?.lastName}
            </h1>
            <p className="text-gray-600">Agent Profile & Settings</p>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Status & Settings */}
        <div className="space-y-6">
          {/* Status Controls */}
          {agentStatus && (
            <StatusControls
              currentStatus={agentStatus.status}
              onStatusChange={handleStatusChange}
              isUpdating={updateStatusMutation.isPending}
            />
          )}

          {/* Profile Settings */}
          {agent && (
            <ProfileSettings
              profile={agent}
              onSave={handlePreferencesUpdate}
            />
          )}
        </div>

        {/* Right Column - Performance & History */}
        <div className="lg:col-span-2 space-y-6">
          {/* Performance Metrics */}
          {performance && (
            <PerformanceMetrics performance={performance} />
          )}

          {/* Recent Calls */}
          <RecentCalls
            calls={recentCalls || []}
            onViewDetails={handleViewCallDetails}
          />
        </div>
      </div>

      {/* Session Info */}
      {agentStatus && (
        <div className="mt-8 bg-gray-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Session Information</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Login Time:</span>
              <div className="font-medium">
                {new Date(agentStatus.loginAt).toLocaleTimeString()}
              </div>
            </div>
            <div>
              <span className="text-gray-600">Calls Today:</span>
              <div className="font-medium">{agentStatus.callsCompletedToday}</div>
            </div>
            <div>
              <span className="text-gray-600">Talk Time Today:</span>
              <div className="font-medium">
                {Math.floor(agentStatus.totalTalkTimeSeconds / 3600)}h {Math.floor((agentStatus.totalTalkTimeSeconds % 3600) / 60)}m
              </div>
            </div>
            <div>
              <span className="text-gray-600">Last Activity:</span>
              <div className="font-medium">
                {new Date(agentStatus.lastActivity).toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 
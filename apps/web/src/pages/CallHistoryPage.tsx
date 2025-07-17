import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth';
import { 
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  PhoneIcon,
  ClockIcon,
  CalendarIcon,
  UserIcon,
  DocumentTextIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';

interface CallRecord {
  id: string;
  userId: number;
  user: {
    firstName: string;
    lastName: string;
    phoneNumber: string;
    email: string;
  };
  agent: {
    firstName: string;
    lastName: string;
  };
  claim?: {
    id: number;
    type: string;
    lender: string;
  };
  startedAt: Date;
  connectedAt?: Date;
  endedAt?: Date;
  durationSeconds?: number;
  talkTimeSeconds?: number;
  status: 'initiated' | 'connecting' | 'connected' | 'completed' | 'failed';
  direction: 'outbound' | 'inbound';
  outcome?: {
    type: string;
    notes: string;
    magicLinkSent: boolean;
    smsSent: boolean;
    callbackScheduled: boolean;
  };
  twilioCallSid?: string;
}

interface CallHistoryFilters {
  dateFrom?: string;
  dateTo?: string;
  outcome?: string;
  status?: string;
  agentId?: number;
  search?: string;
  direction?: 'outbound' | 'inbound';
}

interface CallStatsProps {
  stats: {
    totalCalls: number;
    completedCalls: number;
    totalTalkTime: number;
    averageDuration: number;
    successRate: number;
  };
}

function CallStats({ stats }: CallStatsProps) {
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center">
          <PhoneIcon className="h-8 w-8 text-blue-500 mr-3" />
          <div>
            <div className="text-2xl font-bold text-gray-900">{stats.totalCalls}</div>
            <div className="text-sm text-gray-600">Total Calls</div>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center">
          <ClockIcon className="h-8 w-8 text-green-500 mr-3" />
          <div>
            <div className="text-2xl font-bold text-gray-900">{stats.completedCalls}</div>
            <div className="text-sm text-gray-600">Completed</div>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center">
          <CalendarIcon className="h-8 w-8 text-purple-500 mr-3" />
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {formatDuration(stats.totalTalkTime)}
            </div>
            <div className="text-sm text-gray-600">Talk Time</div>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center">
          <DocumentTextIcon className="h-8 w-8 text-orange-500 mr-3" />
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {formatTime(stats.averageDuration)}
            </div>
            <div className="text-sm text-gray-600">Avg Duration</div>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center">
          <UserIcon className="h-8 w-8 text-yellow-500 mr-3" />
          <div>
            <div className="text-2xl font-bold text-gray-900">{stats.successRate}%</div>
            <div className="text-sm text-gray-600">Success Rate</div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface FiltersProps {
  filters: CallHistoryFilters;
  onFiltersChange: (filters: CallHistoryFilters) => void;
  agents: Array<{ id: number; firstName: string; lastName: string }>;
}

function Filters({ filters, onFiltersChange, agents }: FiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const outcomeOptions = [
    { value: '', label: 'All Outcomes' },
    { value: 'contacted', label: 'Successfully Contacted' },
    { value: 'callback_requested', label: 'Callback Requested' },
    { value: 'not_interested', label: 'Not Interested' },
    { value: 'no_answer', label: 'No Answer' },
    { value: 'voicemail', label: 'Left Voicemail' },
    { value: 'wrong_number', label: 'Wrong Number' },
    { value: 'busy', label: 'Line Busy' }
  ];

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'completed', label: 'Completed' },
    { value: 'failed', label: 'Failed' },
    { value: 'initiated', label: 'Initiated' },
    { value: 'connecting', label: 'Connecting' }
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <FunnelIcon className="h-5 w-5 mr-2" />
          Filters
        </h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
        >
          {isExpanded ? 'Collapse' : 'Expand'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={filters.search || ''}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Date From */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">From Date</label>
          <input
            type="date"
            value={filters.dateFrom || ''}
            onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Date To */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">To Date</label>
          <input
            type="date"
            value={filters.dateTo || ''}
            onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Direction */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Direction</label>
          <select
            value={filters.direction || ''}
            onChange={(e) => onFiltersChange({ ...filters, direction: e.target.value as any })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Directions</option>
            <option value="outbound">Outbound</option>
            <option value="inbound">Inbound</option>
          </select>
        </div>
      </div>

      {isExpanded && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Outcome */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Outcome</label>
            <select
              value={filters.outcome || ''}
              onChange={(e) => onFiltersChange({ ...filters, outcome: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {outcomeOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status || ''}
              onChange={(e) => onFiltersChange({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          {/* Agent */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Agent</label>
            <select
              value={filters.agentId || ''}
              onChange={(e) => onFiltersChange({ ...filters, agentId: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Agents</option>
              {agents.map(agent => (
                <option key={agent.id} value={agent.id}>
                  {agent.firstName} {agent.lastName}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Clear Filters */}
      <div className="flex justify-end mt-4">
        <button
          onClick={() => onFiltersChange({})}
          className="text-sm text-gray-600 hover:text-gray-800"
        >
          Clear All Filters
        </button>
      </div>
    </div>
  );
}

interface CallTableProps {
  calls: CallRecord[];
  onViewDetails: (call: CallRecord) => void;
  isLoading: boolean;
}

function CallTable({ calls, onViewDetails, isLoading }: CallTableProps) {
  const formatTime = (date: Date | string) => {
    return new Date(date).toLocaleString();
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'connecting': return 'bg-yellow-100 text-yellow-800';
      case 'initiated': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading call history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contact
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Agent
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Duration
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Outcome
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {calls.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  No calls found matching your criteria
                </td>
              </tr>
            ) : (
              calls.map((call) => (
                <tr key={call.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {call.user.firstName} {call.user.lastName}
                      </div>
                      <div className="text-sm text-gray-500">{call.user.phoneNumber}</div>
                      {call.claim && (
                        <div className="text-xs text-gray-400">
                          {call.claim.type} - {call.claim.lender}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {call.agent.firstName} {call.agent.lastName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{formatTime(call.startedAt)}</div>
                    <div className="text-xs text-gray-500 capitalize">
                      {call.direction}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDuration(call.durationSeconds)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(call.status)}`}>
                      {call.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {call.outcome ? (
                      <div>
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getOutcomeColor(call.outcome.type)}`}>
                          {call.outcome.type.replace('_', ' ')}
                        </span>
                        <div className="flex items-center mt-1 space-x-1">
                          {call.outcome.magicLinkSent && (
                            <span className="text-xs bg-blue-100 text-blue-600 px-1 py-0.5 rounded">Link</span>
                          )}
                          {call.outcome.smsSent && (
                            <span className="text-xs bg-green-100 text-green-600 px-1 py-0.5 rounded">SMS</span>
                          )}
                          {call.outcome.callbackScheduled && (
                            <span className="text-xs bg-purple-100 text-purple-600 px-1 py-0.5 rounded">Callback</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">No outcome</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => onViewDetails(call)}
                      className="text-blue-600 hover:text-blue-900 flex items-center"
                    >
                      <EyeIcon className="h-4 w-4 mr-1" />
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CallHistoryPage() {
  const { agent } = useAuthStore();
  const [filters, setFilters] = useState<CallHistoryFilters>({
    dateFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Last 7 days
    dateTo: new Date().toISOString().split('T')[0]
  });
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);

  // Fetch call history
  const { data: callHistoryData, isLoading: historyLoading } = useQuery({
    queryKey: ['call-history', filters, page, limit],
    queryFn: () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== undefined && value !== '')
        )
      });
      return apiClient.get(`/api/calls/history?${params}`);
    },
    refetchInterval: 60000 // Refresh every minute
  });

  // Fetch call stats
  const { data: statsData } = useQuery({
    queryKey: ['call-stats', filters],
    queryFn: () => {
      const params = new URLSearchParams(
        Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== undefined && value !== '')
        )
      );
      return apiClient.get(`/api/calls/stats?${params}`);
    },
    refetchInterval: 60000
  });

  // Fetch agents list for filter
  const { data: agentsData } = useQuery({
    queryKey: ['agents-list'],
    queryFn: () => apiClient.get('/api/agents'),
  });

  const handleExport = async () => {
    try {
      const params = new URLSearchParams(
        Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== undefined && value !== '')
        )
      );
      
      const response = await fetch(`/api/calls/export?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `call-history-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const calls = (callHistoryData as any)?.data || [];
  const totalPages = (callHistoryData as any)?.meta?.totalPages || 1;
  const stats = (statsData as any)?.data || { totalCalls: 0, completedCalls: 0, totalTalkTime: 0, averageDuration: 0, successRate: 0 };
  const agents = (agentsData as any)?.data || [];

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">📞 Call History</h1>
          <button
            onClick={handleExport}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center"
          >
            <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
            Export CSV
          </button>
        </div>
        <p className="text-gray-600 mt-1">View and analyze call records and performance</p>
      </div>

      {/* Stats */}
      <CallStats stats={stats} />

      {/* Filters */}
      <Filters
        filters={filters}
        onFiltersChange={setFilters}
        agents={agents}
      />

      {/* Call Table */}
      <CallTable
        calls={calls}
        onViewDetails={setSelectedCall}
        isLoading={historyLoading}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Page {page} of {totalPages}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeftIcon className="h-4 w-4 mr-1" />
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRightIcon className="h-4 w-4 ml-1" />
            </button>
          </div>
        </div>
      )}

      {/* Call Details Modal (placeholder) */}
      {selectedCall && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Call Details</h3>
              <button
                onClick={() => setSelectedCall(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <strong>Contact:</strong> {selectedCall.user.firstName} {selectedCall.user.lastName}
              </div>
              <div>
                <strong>Phone:</strong> {selectedCall.user.phoneNumber}
              </div>
              <div>
                <strong>Agent:</strong> {selectedCall.agent.firstName} {selectedCall.agent.lastName}
              </div>
              <div>
                <strong>Started:</strong> {new Date(selectedCall.startedAt).toLocaleString()}
              </div>
              {selectedCall.outcome && (
                <div>
                  <strong>Notes:</strong> {selectedCall.outcome.notes}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 
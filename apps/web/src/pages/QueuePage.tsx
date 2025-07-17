import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PhoneIcon, ClockIcon, UserIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { apiClient, getErrorMessage } from '../lib/api-client';
import { useAuthStore } from '../store/auth';

interface QueueItem {
  id: string;
  userId: number;
  claimId?: number;
  priorityScore: number;
  queuePosition: number;
  queueReason: string;
  status: string;
  queueType: string;
  availableFrom: string;
  createdAt: string;
  actualPosition: number;
  user: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    address?: {
      fullAddress: string;
      postCode: string;
      county: string;
    };
    claims: Array<{
      id: number;
      type: string;
      status: string;
      lender: string;
      requirements: Array<{
        type: string;
        status: string;
        reason: string;
      }>;
    }>;
  };
}

interface QueueStats {
  queue: {
    pending: number;
    assigned: number;
    completedToday: number;
  };
  lastRefresh: string;
  averageWaitTime: string;
  topPriorityUser: string | null;
}

export function QueuePage() {
  const { agent } = useAuthStore();
  const queryClient = useQueryClient();
  const [selectedFilters, setSelectedFilters] = useState({
    status: 'pending',
    limit: '20'
  });

  // Fetch queue data
  const { data: queueData, isLoading, error, refetch } = useQuery({
    queryKey: ['queue', selectedFilters],
    queryFn: () => apiClient.get<QueueItem[]>(`/api/queue?status=${selectedFilters.status}&limit=${selectedFilters.limit}`),
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Fetch queue statistics
  const { data: statsData } = useQuery({
    queryKey: ['queue-stats'],
    queryFn: () => apiClient.get<QueueStats>('/api/queue/stats'),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Assign call mutation
  const assignCallMutation = useMutation({
    mutationFn: (queueId: string) => apiClient.post(`/api/queue/${queueId}/assign`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      queryClient.invalidateQueries({ queryKey: ['queue-stats'] });
    },
  });

  // Refresh queue mutation
  const refreshQueueMutation = useMutation({
    mutationFn: () => apiClient.post('/api/queue/refresh'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      queryClient.invalidateQueries({ queryKey: ['queue-stats'] });
    },
  });

  const handleAssignCall = (queueId: string) => {
    assignCallMutation.mutate(queueId);
  };

  const handleRefreshQueue = () => {
    refreshQueueMutation.mutate();
  };

  const formatPriorityReason = (reason: string) => {
    const reasons = reason.split(',').map(r => {
      if (r.includes('pending_requirements')) {
        const count = r.split('_')[0];
        return `${count} pending requirements`;
      }
      return r.replace(/_/g, ' ');
    });
    return reasons.join(', ');
  };

  const getPriorityColor = (score: number) => {
    if (score <= 20) return 'text-red-600 bg-red-50'; // High priority
    if (score <= 50) return 'text-orange-600 bg-orange-50'; // Medium priority
    return 'text-gray-600 bg-gray-50'; // Low priority
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Call Queue</h1>
          <p className="text-gray-600 mt-1">
            Prioritized users ready for contact - {agent?.firstName} {agent?.lastName}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <ClockIcon className="w-4 h-4" />
            Refresh
          </button>
          {(agent?.role === 'supervisor' || agent?.role === 'admin') && (
            <button
              onClick={handleRefreshQueue}
              disabled={refreshQueueMutation.isPending}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {refreshQueueMutation.isPending ? 'Refreshing...' : 'Rebuild Queue'}
            </button>
          )}
        </div>
      </div>

      {/* Statistics Cards */}
      {statsData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <UserIcon className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending Calls</p>
                <p className="text-2xl font-bold text-gray-900">{statsData.queue.pending}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <PhoneIcon className="w-6 h-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">In Progress</p>
                <p className="text-2xl font-bold text-gray-900">{statsData.queue.assigned}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <DocumentTextIcon className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Completed Today</p>
                <p className="text-2xl font-bold text-gray-900">{statsData.queue.completedToday}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <ClockIcon className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg Wait Time</p>
                <p className="text-2xl font-bold text-gray-900">{statsData.averageWaitTime}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow border mb-6">
        <div className="flex gap-4 items-center">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={selectedFilters.status}
              onChange={(e) => setSelectedFilters(prev => ({ ...prev, status: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="pending">Pending</option>
              <option value="assigned">Assigned</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Show</label>
            <select
              value={selectedFilters.limit}
              onChange={(e) => setSelectedFilters(prev => ({ ...prev, limit: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="10">10 users</option>
              <option value="20">20 users</option>
              <option value="50">50 users</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">
            Error loading queue: {getErrorMessage(error)}
          </p>
        </div>
      )}

      {/* Queue Table */}
      <div className="bg-white rounded-lg shadow border overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            Call Queue ({queueData?.length || 0} users)
          </h2>
        </div>

        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading queue...</p>
          </div>
        ) : !queueData || queueData.length === 0 ? (
          <div className="p-8 text-center">
            <UserIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No users in queue</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Position
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Claim Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Requirements
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {queueData.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-gray-900">
                          #{item.actualPosition}
                        </span>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <UserIcon className="h-6 w-6 text-blue-600" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {item.user.firstName} {item.user.lastName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {item.user.phoneNumber}
                          </div>
                          <div className="text-xs text-gray-400">
                            {item.user.address?.postCode}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {item.user.claims[0]?.type || 'No claim type'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {item.user.claims[0]?.lender || 'No lender'}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(item.priorityScore)}`}>
                        Score: {item.priorityScore}
                      </span>
                      <div className="text-xs text-gray-500 mt-1">
                        {formatPriorityReason(item.queueReason)}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {item.user.claims[0]?.requirements?.length || 0} pending
                      </div>
                      <div className="text-xs text-gray-500">
                        {item.user.claims[0]?.requirements?.slice(0, 2).map(req => req.type).join(', ')}
                        {(item.user.claims[0]?.requirements?.length || 0) > 2 && '...'}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {selectedFilters.status === 'pending' && (
                        <button
                          onClick={() => handleAssignCall(item.id)}
                          disabled={assignCallMutation.isPending}
                          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                          <PhoneIcon className="w-4 h-4 mr-2" />
                          {assignCallMutation.isPending ? 'Assigning...' : 'Take Call'}
                        </button>
                      )}
                      {selectedFilters.status === 'assigned' && (
                        <span className="text-orange-600 font-medium">In Progress</span>
                      )}
                      {selectedFilters.status === 'completed' && (
                        <span className="text-green-600 font-medium">Completed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Success/Error Messages */}
      {assignCallMutation.isSuccess && (
        <div className="fixed bottom-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded z-50">
          Call assigned successfully!
        </div>
      )}

      {assignCallMutation.isError && (
        <div className="fixed bottom-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-50">
          Error: {getErrorMessage(assignCallMutation.error)}
        </div>
      )}
    </div>
  );
} 
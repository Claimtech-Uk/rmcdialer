'use client';
export const dynamic = 'force-dynamic'

import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { 
  Search,
  Filter,
  Download,
  Eye,
  Phone,
  Clock,
  Calendar,
  User,
  FileText,
  ChevronLeft,
  ChevronRight,
  TrendingUp
} from 'lucide-react';
import { Button } from '@/modules/core/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/core/components/ui/card';
import { Badge } from '@/modules/core/components/ui/badge';
import { useToast } from '@/modules/core/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/modules/core/components/ui/select';

// Types for call history - using actual tRPC response types
interface CallHistoryFilters {
  page?: number;
  limit?: number;
  startDate?: Date;
  endDate?: Date;
  outcome?: string;
  status?: string;
  agentId?: number;
  userId?: number;
}

interface CallStatsProps {
  stats: {
    totalCalls: number;
    completedCalls: number;
    successfulContacts: number;
    avgDurationMinutes: number;
    avgTalkTimeMinutes: number;
    contactRate: number;
  };
}

function CallStats({ stats }: CallStatsProps) {
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatTime = (minutes: number) => {
    const mins = Math.floor(minutes);
    const secs = Math.floor((minutes % 1) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center">
            <Phone className="h-8 w-8 text-primary mr-3" />
            <div>
              <div className="text-2xl font-bold">{stats.totalCalls}</div>
              <div className="text-sm text-muted-foreground">Total Calls</div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-green-500 mr-3" />
            <div>
              <div className="text-2xl font-bold">{stats.completedCalls}</div>
              <div className="text-sm text-muted-foreground">Completed</div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center">
            <Calendar className="h-8 w-8 text-purple-500 mr-3" />
            <div>
              <div className="text-2xl font-bold">
                {formatDuration(stats.avgTalkTimeMinutes)}
              </div>
              <div className="text-sm text-muted-foreground">Avg Talk Time</div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center">
            <FileText className="h-8 w-8 text-orange-500 mr-3" />
            <div>
              <div className="text-2xl font-bold">
                {formatTime(stats.avgDurationMinutes)}
              </div>
              <div className="text-sm text-muted-foreground">Avg Duration</div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-yellow-500 mr-3" />
            <div>
              <div className="text-2xl font-bold">{stats.contactRate.toFixed(1)}%</div>
              <div className="text-sm text-muted-foreground">Success Rate</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function CallHistoryPage() {
  const { toast } = useToast();
  const [filters, setFilters] = useState<CallHistoryFilters>({
    page: 1,
    limit: 20,
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
    endDate: new Date()
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);

  // Get current agent session
  const { data: session } = api.auth.me.useQuery();

  // Fetch call history
  const { 
    data: callHistoryData, 
    isLoading: historyLoading 
  } = api.calls.getCallHistory.useQuery(filters, {
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Fetch call analytics for stats
  const { 
    data: analyticsData, 
    isLoading: analyticsLoading 
  } = api.calls.getAnalytics.useQuery({
    startDate: filters.startDate,
    endDate: filters.endDate,
    agentId: session?.agent?.role === 'agent' ? session.agent.id : filters.agentId
  }, {
    refetchInterval: 60000 // Refresh every minute
  });

  const calls = callHistoryData?.calls || [];
  const stats = analyticsData || {
    totalCalls: 0,
    completedCalls: 0,
    successfulContacts: 0,
    avgDurationMinutes: 0,
    avgTalkTimeMinutes: 0,
    contactRate: 0
  };

  const outcomeOptions = [
    { value: '', label: 'All Outcomes' },
    { value: 'contacted', label: 'Successfully Contacted' },
    { value: 'callback_requested', label: 'Callback Requested' },
    { value: 'not_interested', label: 'Not Interested' },
    { value: 'no_answer', label: 'No Answer' },
    { value: 'left_voicemail', label: 'Left Voicemail' },
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

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      completed: 'default',
      connected: 'default',
      failed: 'destructive',
      initiated: 'secondary',
      connecting: 'secondary'
    };
    return variants[status] || 'secondary';
  };

  const getOutcomeBadge = (outcome?: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      contacted: 'default',
      callback_requested: 'default',
      not_interested: 'destructive',
      no_answer: 'secondary',
      left_voicemail: 'secondary',
      wrong_number: 'destructive',
      busy: 'secondary'
    };
    return variants[outcome || ''] || 'secondary';
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDateTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  };

  const handleFiltersChange = (newFilters: Partial<CallHistoryFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters, page: 1 }));
  };

  const handlePageChange = (direction: 'prev' | 'next') => {
    const currentPage = filters.page || 1;
    const newPage = direction === 'next' ? currentPage + 1 : currentPage - 1;
    setFilters(prev => ({ ...prev, page: Math.max(1, newPage) }));
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Clock className="w-6 h-6 text-primary" />
          Call History
        </h1>
        <p className="text-muted-foreground mt-1">
          View and analyze call performance and outcomes
        </p>
      </div>

      {/* Statistics */}
      {!analyticsLoading && <CallStats stats={stats} />}

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filters
            </CardTitle>
            <Button
              onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
              variant="ghost"
              size="sm"
            >
              {isFiltersExpanded ? 'Collapse' : 'Expand'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {/* Search */}
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Date From */}
            <div>
              <label className="block text-sm font-medium mb-1">From Date</label>
              <input
                type="date"
                value={filters.startDate?.toISOString().split('T')[0] || ''}
                onChange={(e) => handleFiltersChange({ 
                  startDate: e.target.value ? new Date(e.target.value) : undefined 
                })}
                className="w-full px-3 py-2 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-sm font-medium mb-1">To Date</label>
              <input
                type="date"
                value={filters.endDate?.toISOString().split('T')[0] || ''}
                onChange={(e) => handleFiltersChange({ 
                  endDate: e.target.value ? new Date(e.target.value) : undefined 
                })}
                className="w-full px-3 py-2 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <Select
                value={filters.status || ''}
                onValueChange={(value) => handleFiltersChange({ status: value || undefined })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isFiltersExpanded && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Outcome Filter */}
              <div>
                <label className="block text-sm font-medium mb-1">Outcome</label>
                <Select
                  value={filters.outcome || ''}
                  onValueChange={(value) => handleFiltersChange({ outcome: value || undefined })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Outcomes" />
                  </SelectTrigger>
                  <SelectContent>
                    {outcomeOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Results per page */}
              <div>
                <label className="block text-sm font-medium mb-1">Results per page</label>
                <Select
                  value={filters.limit?.toString() || '20'}
                  onValueChange={(value) => handleFiltersChange({ limit: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Call Records Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              Call Records ({callHistoryData?.meta?.total || 0} total)
            </CardTitle>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground">Loading call history...</p>
              </div>
            </div>
          ) : calls.length === 0 ? (
            <div className="text-center py-12">
              <Phone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No call records found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 text-sm font-medium">User</th>
                      <th className="text-left p-3 text-sm font-medium">Agent</th>
                      <th className="text-left p-3 text-sm font-medium">Date/Time</th>
                      <th className="text-left p-3 text-sm font-medium">Duration</th>
                      <th className="text-left p-3 text-sm font-medium">Status</th>
                      <th className="text-left p-3 text-sm font-medium">Outcome</th>
                      <th className="text-left p-3 text-sm font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calls.map((call) => (
                      <tr key={call.id} className="border-b hover:bg-muted/50">
                        <td className="p-3">
                          <div>
                            <div className="font-medium">
                              {call.userContext.firstName} {call.userContext.lastName}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {call.userContext.phoneNumber}
                            </div>
                          </div>
                        </td>
                        
                        <td className="p-3">
                          <div className="text-sm">
                            {call.agent.firstName} {call.agent.lastName}
                          </div>
                        </td>
                        
                        <td className="p-3">
                          <div className="text-sm">
                            {formatDateTime(call.startedAt)}
                          </div>
                        </td>
                        
                        <td className="p-3">
                          <div className="text-sm">
                            {formatDuration(call.durationSeconds)}
                          </div>
                        </td>
                        
                        <td className="p-3">
                          <Badge variant={getStatusBadge(call.status)}>
                            {call.status.replace('_', ' ')}
                          </Badge>
                        </td>
                        
                        <td className="p-3">
                          <Badge variant="secondary">
                            Call Complete
                          </Badge>
                        </td>
                        
                        <td className="p-3">
                          <Button variant="ghost" size="sm">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {callHistoryData?.meta && callHistoryData.meta.totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <div className="text-sm text-muted-foreground">
                    Showing {((callHistoryData.meta.page - 1) * callHistoryData.meta.limit) + 1} to{' '}
                    {Math.min(callHistoryData.meta.page * callHistoryData.meta.limit, callHistoryData.meta.total)} of{' '}
                    {callHistoryData.meta.total} records
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={callHistoryData.meta.page <= 1}
                      onClick={() => handlePageChange('prev')}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={callHistoryData.meta.page >= callHistoryData.meta.totalPages}
                      onClick={() => handlePageChange('next')}
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 
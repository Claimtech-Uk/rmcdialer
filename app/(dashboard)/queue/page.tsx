'use client';

import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { 
  Phone, 
  Clock, 
  User, 
  FileText, 
  RefreshCw,
  Users,
  PhoneCall,
  CheckCircle
} from 'lucide-react';
import { Button } from '@/modules/core/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/core/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/modules/core/components/ui/select';
import { Badge } from '@/modules/core/components/ui/badge';
import { Alert, AlertDescription } from '@/modules/core/components/ui/alert';
import { useToast } from '@/modules/core/hooks/use-toast';

export default function QueuePage() {
  const { toast } = useToast();
  const [filters, setFilters] = useState({
    status: 'pending' as 'pending' | 'assigned' | 'completed',
    limit: 20,
    page: 1
  });

  // Get current session for user info and role checks
  const { data: session } = api.auth.me.useQuery();
  
  // Fetch queue data
  const { 
    data: queueResult, 
    isLoading, 
    error, 
    refetch 
  } = api.queue.getQueue.useQuery(filters, {
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Fetch queue statistics
  const { data: stats } = api.queue.getStats.useQuery(undefined, {
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Assign call mutation
  const assignCallMutation = api.queue.assignCall.useMutation({
    onSuccess: () => {
      toast({
        title: "Call Assigned",
        description: "Call has been assigned to you successfully",
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Refresh queue mutation
  const refreshQueueMutation = api.queue.refreshQueue.useMutation({
    onSuccess: (result) => {
      toast({
        title: "Queue Refreshed",
        description: `${result.usersAdded} users added to queue`,
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleAssignCall = (queueId: string) => {
    assignCallMutation.mutate({ queueId });
  };

  const handleRefreshQueue = () => {
    refreshQueueMutation.mutate();
  };

  const getPriorityColor = (score: number) => {
    if (score <= 20) return 'destructive'; // High priority
    if (score <= 50) return 'default'; // Medium priority
    return 'secondary'; // Low priority
  };

  const getPriorityLabel = (score: number) => {
    if (score <= 20) return 'High Priority';
    if (score <= 50) return 'Medium Priority';
    return 'Low Priority';
  };

  const formatPriorityReason = (reason: string | undefined) => {
    if (!reason) return 'Standard priority';
    return reason.split(',').map(r => {
      if (r.includes('pending_requirements')) {
        const count = r.split('_')[0];
        return `${count} pending requirements`;
      }
      return r.replace(/_/g, ' ');
    }).join(', ');
  };

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <Alert variant="destructive">
          <AlertDescription>
            Error loading queue: {error.message}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Call Queue</h1>
          <p className="text-muted-foreground">
            Prioritized users ready for contact - {session?.agent?.firstName} {session?.agent?.lastName}
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => refetch()}
            disabled={isLoading}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          {(session?.agent?.role === 'supervisor' || session?.agent?.role === 'admin') && (
            <Button
              onClick={handleRefreshQueue}
              disabled={refreshQueueMutation.isPending}
              size="sm"
            >
              {refreshQueueMutation.isPending ? 'Rebuilding...' : 'Rebuild Queue'}
            </Button>
          )}
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Calls</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.queue.pending}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <PhoneCall className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.queue.assigned}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.queue.completedToday}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Wait Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.averageWaitTime || '0m'}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-center">
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select
                value={filters.status}
                onValueChange={(value: 'pending' | 'assigned' | 'completed') => 
                  setFilters(prev => ({ ...prev, status: value, page: 1 }))
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Show</label>
              <Select
                value={filters.limit.toString()}
                onValueChange={(value) => 
                  setFilters(prev => ({ ...prev, limit: parseInt(value), page: 1 }))
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 users</SelectItem>
                  <SelectItem value="20">20 users</SelectItem>
                  <SelectItem value="50">50 users</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Queue Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Call Queue ({queueResult?.entries.length || 0} users)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">Loading queue...</p>
            </div>
          ) : !queueResult?.entries || queueResult.entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No users in queue</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium">Position</th>
                    <th className="text-left p-2 font-medium">User ID</th>
                    <th className="text-left p-2 font-medium">Queue Type</th>
                    <th className="text-left p-2 font-medium">Priority</th>
                    <th className="text-left p-2 font-medium">Reason</th>
                    <th className="text-left p-2 font-medium">Created</th>
                    <th className="text-left p-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {queueResult.entries.map((entry, index) => (
                    <tr key={entry.id} className="border-b hover:bg-muted/50">
                      <td className="p-2">
                        <Badge variant="outline">
                          #{entry.queuePosition || index + 1}
                        </Badge>
                      </td>
                      
                      <td className="p-2">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium">User #{entry.userId}</div>
                            <div className="text-sm text-muted-foreground">
                              {entry.claimId ? `Claim #${entry.claimId}` : 'No claim'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="p-2">
                        <Badge variant="outline">
                          {entry.queueType.replace('_', ' ')}
                        </Badge>
                      </td>

                      <td className="p-2">
                        <div className="space-y-1">
                          <Badge variant={getPriorityColor(entry.priorityScore)}>
                            Score: {entry.priorityScore}
                          </Badge>
                          <div className="text-xs text-muted-foreground">
                            {getPriorityLabel(entry.priorityScore)}
                          </div>
                        </div>
                      </td>

                      <td className="p-2">
                        <div className="text-sm max-w-48 truncate" title={entry.queueReason}>
                          {formatPriorityReason(entry.queueReason)}
                        </div>
                      </td>

                      <td className="p-2">
                        <div className="text-sm text-muted-foreground">
                          {new Date(entry.createdAt).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(entry.createdAt).toLocaleTimeString()}
                        </div>
                      </td>

                      <td className="p-2">
                        {filters.status === 'pending' && (
                          <Button
                            onClick={() => handleAssignCall(entry.id)}
                            disabled={assignCallMutation.isPending}
                            size="sm"
                          >
                            <Phone className="w-4 h-4 mr-2" />
                            {assignCallMutation.isPending ? 'Assigning...' : 'Take Call'}
                          </Button>
                        )}
                        {filters.status === 'assigned' && (
                          <Badge variant="default">In Progress</Badge>
                        )}
                        {filters.status === 'completed' && (
                          <Badge variant="outline">Completed</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {queueResult?.meta && queueResult.meta.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {((queueResult.meta.page - 1) * queueResult.meta.limit) + 1} to{' '}
                {Math.min(queueResult.meta.page * queueResult.meta.limit, queueResult.meta.total)} of{' '}
                {queueResult.meta.total} entries
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={queueResult.meta.page <= 1}
                  onClick={() => setFilters(prev => ({ ...prev, page: prev.page - 1 }))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={queueResult.meta.page >= queueResult.meta.totalPages}
                  onClick={() => setFilters(prev => ({ ...prev, page: prev.page + 1 }))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 
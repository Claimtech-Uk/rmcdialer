'use client';

import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { 
  Phone, 
  Clock, 
  User, 
  FileText, 
  RefreshCw,
  AlertTriangle,
  Folder,
  CheckCircle
} from 'lucide-react';
import { Button } from '@/modules/core/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/core/components/ui/card';
import { Badge } from '@/modules/core/components/ui/badge';
import { Alert, AlertDescription } from '@/modules/core/components/ui/alert';
import { useToast } from '@/modules/core/hooks/use-toast';

export default function RequirementsQueuePage() {
  const { toast } = useToast();
  const [filters, setFilters] = useState({
    status: 'pending' as 'pending' | 'assigned' | 'completed',
    limit: 20,
    page: 1
  });

  // Get current session for user info and role checks
  const { data: session } = api.auth.me.useQuery();
  
  // Fetch outstanding requests users specifically
  const { 
    data: usersResult, 
    isLoading, 
    error, 
    refetch 
  } = api.users.getEligibleUsersByQueueType.useQuery({
    queueType: 'outstanding_requests',
    limit: filters.limit,
    offset: (filters.page - 1) * filters.limit
  }, {
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Fetch queue statistics
  const { data: stats } = api.queue.getStats.useQuery(undefined, {
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Refresh queue mutation
  const refreshQueueMutation = api.queue.refreshQueue.useMutation({
    onSuccess: () => {
      toast({
        title: "Queue Refreshed",
        description: "Requirements queue has been updated",
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

  const handleRefreshQueue = () => {
    refreshQueueMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading requirements queue...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to load queue: {error.message}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const users = usersResult?.data || [];
  const requirementsStats = stats?.queue; // Use queue stats for now

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-600" />
            Requirements
          </h1>
          <p className="text-muted-foreground mt-1">
            Users with pending document requirements (signatures already provided)
          </p>
        </div>
        <Button 
          onClick={handleRefreshQueue}
          disabled={refreshQueueMutation.isPending}
          variant="outline"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshQueueMutation.isPending ? 'animate-spin' : ''}`} />
          Refresh Queue
        </Button>
      </div>

      {/* Queue Stats */}
      {requirementsStats && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{requirementsStats.pending}</div>
              <p className="text-xs text-muted-foreground">Awaiting documents</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Phone className="w-4 h-4 text-purple-500" />
                In Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{requirementsStats.assigned}</div>
              <p className="text-xs text-muted-foreground">Currently calling</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Completed Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{requirementsStats.completedToday}</div>
              <p className="text-xs text-muted-foreground">Documents received</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Users with Pending Requirements ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No pending requirements found
              </h3>
              <p className="text-gray-500">
                All users have provided their required documents!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {users.map((user: any) => (
                <div 
                  key={user.user.id} 
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 hover:border-blue-200 transition-colors cursor-pointer"
                  onClick={() => {
                    // Navigate to user detail view when clicking anywhere on the tile
                    window.location.href = `/users/${user.user.id}`;
                  }}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <FileText className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-medium text-lg">
                          {user.user.firstName} {user.user.lastName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {user.user.phoneNumber} • {user.claims.length} claim(s)
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-3 ml-13">
                      <div className="text-sm text-gray-600 mb-2">
                        <strong>Pending Requirements:</strong>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {user.claims.map((claim: any) => 
                          claim.requirements.map((req: any) => (
                            <Badge key={req.id} variant="outline" className="text-xs bg-blue-50">
                              {req.type} • {req.reason || 'Document required'}
                            </Badge>
                          ))
                        )}
                        {user.claims.map((claim: any, index: number) => (
                          <Badge key={claim.id} variant="secondary" className="text-xs">
                            {claim.type} Claim • {claim.lender}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div 
                      className="text-center text-sm bg-blue-50 px-3 py-2 rounded-md border border-blue-200"
                      onClick={(e) => e.stopPropagation()} // Prevent card click when clicking the badge
                    >
                      <div className="text-blue-600 font-medium">
                        {user.claims.reduce((acc: number, claim: any) => 
                          acc + claim.requirements.length, 0)}
                      </div>
                      <div className="text-xs text-blue-500">Requirements</div>
                    </div>
                    
                    <div className="flex flex-col gap-2 min-w-[140px]">
                      <Button 
                        size="sm"
                        variant="outline"
                        className="w-full justify-start hover:bg-orange-50 border-orange-200 text-orange-700 hover:text-orange-800"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent card click
                          // Navigate to user detail view
                          window.location.href = `/users/${user.user.id}`;
                        }}
                      >
                        <User className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                      
                      <Button 
                        size="sm"
                        className="w-full justify-start bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent card click
                          // Navigate to call interface
                          window.location.href = `/calls/${user.user.id}`;
                        }}
                      >
                        <Phone className="w-4 h-4 mr-2" />
                        Call Now
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {usersResult?.meta && usersResult.meta.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            disabled={filters.page === 1}
            onClick={() => setFilters(prev => ({ ...prev, page: prev.page - 1 }))}
          >
            Previous
          </Button>
          <span className="flex items-center px-4 text-sm text-gray-600">
            Page {filters.page} of {usersResult.meta.totalPages}
          </span>
          <Button
            variant="outline"
            disabled={filters.page === usersResult.meta.totalPages}
            onClick={() => setFilters(prev => ({ ...prev, page: prev.page + 1 }))}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
} 
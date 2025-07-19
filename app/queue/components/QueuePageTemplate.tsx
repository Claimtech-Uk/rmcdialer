'use client';

import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { 
  Phone, 
  Clock, 
  User, 
  FileText, 
  RefreshCw,
  PenTool,
  AlertTriangle,
  Calendar
} from 'lucide-react';
import { Button } from '@/modules/core/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/core/components/ui/card';
import { Badge } from '@/modules/core/components/ui/badge';
import { Alert, AlertDescription } from '@/modules/core/components/ui/alert';
import { useToast } from '@/modules/core/hooks/use-toast';
import { QueueType } from '@/modules/queue/types/queue.types';
import UserDetailsModal from './UserDetailsModal';

interface QueueConfig {
  type: QueueType;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  primaryColor: string;
  hoverColor: string;
  missingText: string;
  emptyStateText: string;
  completedText: string;
  showRequirementsCount?: boolean;
}

const queueConfigs: Record<QueueType, QueueConfig> = {
  unsigned_users: {
    type: 'unsigned_users',
    title: 'Unsigned Users',
    description: 'Users who need to provide their signature to proceed with their claim',
    icon: PenTool,
    primaryColor: 'orange',
    hoverColor: 'orange',
    missingText: 'Digital signature required to proceed',
    emptyStateText: 'All users in the system have provided their signatures!',
    completedText: 'Signatures obtained',
    showRequirementsCount: false
  },
  outstanding_requests: {
    type: 'outstanding_requests',
    title: 'Requirements',
    description: 'Users with pending document requirements (signatures already provided)',
    icon: FileText,
    primaryColor: 'blue',
    hoverColor: 'blue',
    missingText: 'Pending document requirements',
    emptyStateText: 'All users have provided their required documents!',
    completedText: 'Documents received',
    showRequirementsCount: true
  },
  callback: {
    type: 'callback',
    title: 'Callbacks',
    description: 'Users who requested to be called back',
    icon: Phone,
    primaryColor: 'purple',
    hoverColor: 'purple',
    missingText: 'Callback requested',
    emptyStateText: 'No pending callbacks!',
    completedText: 'Callbacks completed',
    showRequirementsCount: false
  }
};

interface QueuePageTemplateProps {
  queueType: QueueType;
}

export default function QueuePageTemplate({ queueType }: QueuePageTemplateProps) {
  const { toast } = useToast();
  const config = queueConfigs[queueType];
  const IconComponent = config.icon;
  
  const [filters, setFilters] = useState({
    status: 'pending' as 'pending' | 'assigned' | 'completed',
    limit: 20,
    page: 1
  });

  // Modal state for user details
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openUserModal = (userId: number) => {
    setSelectedUserId(userId);
    setIsModalOpen(true);
  };

  const closeUserModal = () => {
    setSelectedUserId(null);
    setIsModalOpen(false);
  };

  // Get current session for user info and role checks
  const { data: session } = api.auth.me.useQuery();
  
  // Fetch users for this specific queue type
  const { 
    data: usersResult, 
    isLoading, 
    error, 
    refetch 
  } = api.users.getEligibleUsersByQueueType.useQuery({
    queueType: queueType,
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
        description: `${config.title} queue has been updated`,
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
            <p className="text-gray-600">Loading {config.title.toLowerCase()} queue...</p>
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
  const queueStats = stats?.queue; // Use queue stats for now

  // Dynamic styling based on queue type
  const getColorClasses = (type: 'primary' | 'light' | 'border' | 'hover') => {
    const color = config.primaryColor;
    switch (type) {
      case 'primary':
        return color === 'orange' ? 'text-orange-600' : 
               color === 'blue' ? 'text-blue-600' : 'text-purple-600';
      case 'light':
        return color === 'orange' ? 'bg-orange-100' : 
               color === 'blue' ? 'bg-blue-100' : 'bg-purple-100';
      case 'border':
        return color === 'orange' ? 'border-orange-200' : 
               color === 'blue' ? 'border-blue-200' : 'border-purple-200';
      case 'hover':
        return color === 'orange' ? 'hover:border-orange-200' : 
               color === 'blue' ? 'hover:border-blue-200' : 'hover:border-purple-200';
    }
  };

  const getButtonClasses = () => {
    const color = config.primaryColor;
    return color === 'orange' ? 'bg-orange-600 hover:bg-orange-700' : 
           color === 'blue' ? 'bg-blue-600 hover:bg-blue-700' : 
           'bg-purple-600 hover:bg-purple-700';
  };

  const getSecondaryButtonClasses = () => {
    const color = config.hoverColor;
    return color === 'orange' ? 'hover:bg-orange-50 border-orange-200 text-orange-700 hover:text-orange-800' : 
           color === 'blue' ? 'hover:bg-blue-50 border-blue-200 text-blue-700 hover:text-blue-800' : 
           'hover:bg-purple-50 border-purple-200 text-purple-700 hover:text-purple-800';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className={`text-3xl font-bold tracking-tight flex items-center gap-3 ${getColorClasses('primary')}`}>
            <IconComponent className="w-8 h-8" />
            {config.title}
          </h1>
          <p className="text-muted-foreground mt-1">
            {config.description}
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
      {queueStats && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className={`text-sm font-medium flex items-center gap-2 ${getColorClasses('primary')}`}>
                <Clock className="w-4 h-4" />
                Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getColorClasses('primary')}`}>{queueStats.pending}</div>
              <p className="text-xs text-muted-foreground">Awaiting contact</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-blue-500">
                <Phone className="w-4 h-4" />
                In Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{queueStats.assigned}</div>
              <p className="text-xs text-muted-foreground">Currently calling</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-green-500">
                <IconComponent className="w-4 h-4" />
                Completed Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{queueStats.completedToday}</div>
              <p className="text-xs text-muted-foreground">{config.completedText}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            {config.title} ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-12">
              <IconComponent className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No {config.title.toLowerCase()} found
              </h3>
              <p className="text-gray-500">
                {config.emptyStateText}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {users.map((user: any) => (
                <div 
                  key={user.user.id} 
                  className={`flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 ${getColorClasses('hover')} transition-colors cursor-pointer`}
                  onClick={() => {
                    // Open user details modal instead of navigating
                    openUserModal(user.user.id);
                  }}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 ${getColorClasses('light')} rounded-full flex items-center justify-center`}>
                        <IconComponent className={`w-5 h-5 ${getColorClasses('primary')}`} />
                      </div>
                      <div>
                        <div className="font-medium text-lg">
                          {user.user.firstName} {user.user.lastName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {user.user.phoneNumber} • {user.claims.length} claim(s)
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                          <Calendar className="w-3 h-3" />
                          Created {user.user.createdAt ? new Date(user.user.createdAt).toLocaleDateString() : 'Unknown'}
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-3 ml-13">
                      <div className="text-sm text-gray-600 mb-2">
                        <strong>Missing:</strong> {config.missingText}
                      </div>
                      <div className="flex gap-2">
                        {queueType === 'outstanding_requests' ? (
                          // Show requirements for requirements queue
                          user.claims.flatMap((claim: any) => 
                            claim.requirements.slice(0, 3).map((req: any) => (
                              <Badge key={req.id} variant="outline" className="text-xs bg-blue-50">
                                {req.type} • {req.reason || 'Document required'}
                              </Badge>
                            ))
                          ).slice(0, 3)
                        ) : (
                          // Show claims for other queues  
                          user.claims.map((claim: any, index: number) => (
                            <Badge key={claim.id} variant="outline" className="text-xs">
                              {claim.type} Claim • {claim.lender}
                            </Badge>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {config.showRequirementsCount && (
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
                    )}
                    
                    <div className="flex flex-col gap-2 min-w-[140px]">
                      <Button 
                        size="sm"
                        variant="outline"
                        className={`w-full justify-start ${getSecondaryButtonClasses()}`}
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent card click
                          // Open user details modal
                          openUserModal(user.user.id);
                        }}
                      >
                        <User className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                      
                      <Button 
                        size="sm"
                        className={`w-full justify-start ${getButtonClasses()} text-white shadow-sm`}
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent card click
                          // Open call interface in new tab to keep queue open
                          window.open(`/calls/${user.user.id}`, '_blank');
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

      {/* User Details Modal */}
      <UserDetailsModal 
        userId={selectedUserId}
        isOpen={isModalOpen}
        onClose={closeUserModal}
      />
    </div>
  );
} 
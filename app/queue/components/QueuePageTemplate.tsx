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
import { getFriendlyLenderName, getShortLenderName } from '@/lib/utils/lender-names';
import UserDetailsModal from './UserDetailsModal';
import InPageCallInterface from './InPageCallInterface';

interface QueueConfig {
  type: QueueType;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  primaryColor: string;
  hoverColor: string;
  lightColor: string;
  missingText: string;
  showRequirementsCount: boolean;
}

const queueConfigs: Record<QueueType, QueueConfig> = {
  unsigned_users: {
    type: 'unsigned_users',
    title: 'Unsigned Users',
    description: 'Users who need to provide their signature to proceed with their claim',
    icon: PenTool,
    primaryColor: 'text-orange-600',
    hoverColor: 'hover:bg-orange-50',
    lightColor: 'bg-orange-50',
    missingText: 'Digital signature required to proceed',
    showRequirementsCount: false
  },
  outstanding_requests: {
    type: 'outstanding_requests',
    title: 'Requirements',
    description: 'Users with pending document requirements but who have signatures',
    icon: FileText,
    primaryColor: 'text-blue-600',
    hoverColor: 'hover:bg-blue-50',
    lightColor: 'bg-blue-50',
    missingText: 'Outstanding document requirements',
    showRequirementsCount: true
  },
  callback: {
    type: 'callback',
    title: 'Callbacks',
    description: 'Users requesting callback appointments',
    icon: Phone,
    primaryColor: 'text-purple-600',
    hoverColor: 'hover:bg-purple-50',
    lightColor: 'bg-purple-50',
    missingText: 'Callback requested',
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

  // Call state for in-page calling
  const [activeCall, setActiveCall] = useState<{
    userId: number;
    name: string;
    phoneNumber: string;
    status: 'connecting' | 'connected' | 'ended' | 'failed';
    startTime?: Date;
  } | null>(null);

  const openUserModal = (userId: number) => {
    setSelectedUserId(userId);
    setIsModalOpen(true);
  };

  const closeUserModal = () => {
    setSelectedUserId(null);
    setIsModalOpen(false);
  };

  // Pre-call validation: Get next valid user for calling
  const getNextUserMutation = api.queue.getNextUserForCall.useMutation({
    onSuccess: (result) => {
      if (result) {
        // Start call with validated user
        const { userId, userContext } = result;
        startCall(
          userId, 
          userContext.user.firstName, 
          userContext.user.lastName, 
          userContext.user.phoneNumber
        );
        
        toast({
          title: "✅ Valid user found",
          description: `Starting call with ${userContext.user.firstName} ${userContext.user.lastName}`,
        });
      } else {
        toast({
          title: "No valid users available",
          description: "Queue is empty or all users need attention. Try refreshing the queue.",
          variant: "default",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Failed to find valid user",
        description: error.message || "Unable to validate next user for calling",
        variant: "destructive",
      });
    }
  });

  const handleCallNextValidUser = async () => {
    try {
      await getNextUserMutation.mutateAsync({ queueType });
    } catch (error) {
      // Error handling is done in onError callback
      console.error('Call next user failed:', error);
    }
  };

  const startCall = (userId: number, firstName: string, lastName: string, phoneNumber: string) => {
    // Set up active call state
    setActiveCall({
      userId,
      name: `${firstName} ${lastName}`,
      phoneNumber,
      status: 'connecting',
      startTime: new Date()
    });
    
    toast({
      title: "Starting call...",
      description: `Connecting to ${firstName} ${lastName} (${phoneNumber})`,
    });

    // Simulate call connection after 2 seconds
    setTimeout(() => {
      setActiveCall(prev => prev ? { ...prev, status: 'connected' } : null);
      toast({
        title: "Call connected",
        description: "You are now connected to the user",
      });
    }, 2000);
  };

  const endCall = () => {
    if (activeCall) {
      setActiveCall(prev => prev ? { ...prev, status: 'ended' } : null);
      toast({
        title: "Call ended",
        description: "Call has been disconnected",
      });
      
      // Clear call state after a short delay
      setTimeout(() => {
        setActiveCall(null);
      }, 2000);
    }
  };

  const openFullInterface = () => {
    if (activeCall) {
      // Open full call interface in new tab while keeping the in-page call active
      window.open(`/calls/${activeCall.userId}`, '_blank');
    }
  };

  // Get current session for user info and role checks
  const { data: session } = api.auth.me.useQuery();

  // Fetch queue data based on queue type
  const { 
    data: usersResult, 
    isLoading, 
    error,
    refetch 
  } = api.users.getEligibleUsersByQueueType.useQuery(
    { 
      queueType,
      limit: filters.limit,
      offset: (filters.page - 1) * filters.limit
    },
    {
      refetchInterval: 30000, // Auto-refresh every 30 seconds
      refetchOnWindowFocus: true
    }
  );

  // Fetch queue statistics
  const { data: statsData } = api.queue.getStats.useQuery(undefined, {
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const users = usersResult?.data || [];
  const stats = statsData?.queue || { pending: 0, assigned: 0, completedToday: 0 };

  const handleRefresh = async () => {
    try {
      await refetch();
      toast({
        title: "Queue refreshed",
        description: "Latest queue data has been loaded",
      });
    } catch (error) {
      toast({
        title: "Refresh failed",
        description: "Unable to refresh queue data",
        variant: "destructive",
      });
    }
  };

  // Dynamic styling helpers
  const getColorClasses = (type: 'primary' | 'hover' | 'light') => {
    switch (type) {
      case 'primary': return config.primaryColor;
      case 'hover': return config.hoverColor;
      case 'light': return config.lightColor;
      default: return '';
    }
  };

  const getButtonClasses = () => {
    switch (queueType) {
      case 'unsigned_users': 
        return 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-500';
      case 'outstanding_requests': 
        return 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500';
      case 'callback': 
        return 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500';
      default: 
        return 'bg-gray-600 hover:bg-gray-700 focus:ring-gray-500';
    }
  };

  const getSecondaryButtonClasses = () => {
    switch (queueType) {
      case 'unsigned_users': 
        return 'border-orange-200 text-orange-700 hover:bg-orange-50 hover:border-orange-300';
      case 'outstanding_requests': 
        return 'border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300';
      case 'callback': 
        return 'border-purple-200 text-purple-700 hover:bg-purple-50 hover:border-purple-300';
      default: 
        return 'border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300';
    }
  };

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Queue Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 ${getColorClasses('light')} rounded-lg flex items-center justify-center`}>
            <IconComponent className={`w-6 h-6 ${getColorClasses('primary')}`} />
          </div>
          <div>
            <h1 className={`text-2xl font-bold ${getColorClasses('primary')}`}>
              {config.title}
            </h1>
            <p className="text-gray-600 text-sm">{config.description}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            onClick={handleCallNextValidUser}
            disabled={getNextUserMutation.isLoading || isLoading}
            className={`${getButtonClasses()} text-white flex items-center gap-2`}
          >
            <Phone className={`w-4 h-4 ${getNextUserMutation.isLoading ? 'animate-pulse' : ''}`} />
            {getNextUserMutation.isLoading ? 'Finding User...' : 'Call Next Valid User'}
          </Button>
          
          <Button 
            onClick={handleRefresh} 
            variant="outline"
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Queue
          </Button>
        </div>
      </div>

      {/* Queue Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className={`${getColorClasses('hover')} transition-colors`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className={`w-8 h-8 ${getColorClasses('primary')}`} />
              <div>
                <div className="text-sm text-gray-500">Pending</div>
                <div className={`text-2xl font-bold ${getColorClasses('primary')}`}>
                  {stats.pending}
                </div>
                <div className="text-xs text-gray-500">Awaiting contact</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:bg-blue-50 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Phone className="w-8 h-8 text-blue-600" />
              <div>
                <div className="text-sm text-gray-500">In Progress</div>
                <div className="text-2xl font-bold text-blue-600">{stats.assigned}</div>
                <div className="text-xs text-gray-500">Currently calling</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:bg-green-50 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <User className="w-8 h-8 text-green-600" />
              <div>
                <div className="text-sm text-gray-500">Completed Today</div>
                <div className="text-2xl font-bold text-green-600">{stats.completedToday}</div>
                <div className="text-xs text-gray-500">Signatures obtained</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Queue List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconComponent className={`w-5 h-5 ${getColorClasses('primary')}`} />
            {config.title} ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading queue...</p>
              </div>
            </div>
          ) : error ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Failed to load queue data. Please try refreshing the page.
              </AlertDescription>
            </Alert>
          ) : users.length === 0 ? (
            <div className="text-center py-8">
              <IconComponent className={`w-12 h-12 ${getColorClasses('primary')} mx-auto mb-4 opacity-50`} />
              <p className="text-gray-500">No users in the queue</p>
              <p className="text-sm text-gray-400 mt-1">All users have been processed</p>
            </div>
          ) : (
            <div className="space-y-4">
              {users.map((user: any) => (
                <div 
                  key={user.id} 
                  className={`flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 ${getColorClasses('hover')} transition-colors cursor-pointer`}
                  onClick={() => {
                    // Open user details modal instead of navigating
                    openUserModal(user.id);
                  }}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 ${getColorClasses('light')} rounded-full flex items-center justify-center`}>
                        <IconComponent className={`w-5 h-5 ${getColorClasses('primary')}`} />
                      </div>
                      <div>
                        <div className="font-medium text-lg">
                          {user.firstName} {user.lastName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {user.phoneNumber} • {user.claims.length} claim(s)
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                          <Calendar className="w-3 h-3" />
                          Created {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
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
                          // Show claims for other queues with friendly lender names
                          user.claims.map((claim: any, index: number) => (
                            <Badge key={claim.id} variant="outline" className="text-xs">
                              {claim.type} Claim • {getShortLenderName(claim.lender)}
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
                    
                    <div className="flex flex-col gap-3 min-w-[160px]">
                      <Button 
                        size="default"
                        variant="outline"
                        className={`w-full justify-start ${getSecondaryButtonClasses()} h-11 px-4 py-3 font-medium transition-all duration-200 hover:scale-[1.02] hover:shadow-md border-2`}
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent card click
                          // Open user details modal
                          openUserModal(user.id);
                        }}
                      >
                        <User className="w-4 h-4 mr-3" />
                        View Details
                      </Button>
                      
                      <Button 
                        size="default"
                        className={`w-full justify-start ${getButtonClasses()} text-white shadow-lg h-11 px-4 py-3 font-medium transition-all duration-200 hover:scale-[1.02] hover:shadow-xl border-0`}
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent card click
                          // Start in-page call
                          startCall(user.id, user.firstName, user.lastName, user.phoneNumber);
                        }}
                      >
                        <Phone className="w-4 h-4 mr-3" />
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

      {/* User Details Modal */}
      <UserDetailsModal 
        userId={selectedUserId}
        isOpen={isModalOpen}
        onClose={closeUserModal}
      />

      {/* In-Page Call Interface */}
      {activeCall && (
        <InPageCallInterface 
          callData={activeCall}
          onEndCall={endCall}
          onOpenFullInterface={openFullInterface}
        />
      )}
    </div>
  );
} 
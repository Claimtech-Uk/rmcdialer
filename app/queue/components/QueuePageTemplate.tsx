'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
// UserDetailsModal import removed - now navigating directly to user detail pages
import InPageCallInterface from './InPageCallInterface';

interface QueueConfig {
  type: QueueType;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  missingText: string;
  showRequirementsCount: boolean;
}

const queueConfigs: Record<QueueType, QueueConfig> = {
  unsigned_users: {
    type: 'unsigned_users',
    title: 'Unsigned Users',
    description: 'Users who need to provide their signature to proceed with their claim',
    icon: PenTool,
    gradient: 'bg-gradient-to-br from-orange-500 to-red-600',
    missingText: 'Digital signature required to proceed',
    showRequirementsCount: false
  },
  outstanding_requests: {
    type: 'outstanding_requests',
    title: 'Requirements',
    description: 'Users with pending document requirements but who have signatures',
    icon: FileText,
    gradient: 'bg-gradient-to-br from-blue-500 to-cyan-600',
    missingText: 'Outstanding document requirements',
    showRequirementsCount: true
  },
  callback: {
    type: 'callback',
    title: 'Callbacks',
    description: 'Users requesting callback appointments',
    icon: Phone,
    gradient: 'bg-gradient-to-br from-purple-500 to-pink-600',
    missingText: 'Callback requested',
    showRequirementsCount: false
  }
};

interface QueuePageTemplateProps {
  queueType: QueueType;
}

export default function QueuePageTemplate({ queueType }: QueuePageTemplateProps) {
  console.log('QueuePageTemplate rendering with queueType:', queueType);
  const { toast } = useToast();
  const router = useRouter();
  const config = queueConfigs[queueType];
  const IconComponent = config.icon;
  
  const [filters, setFilters] = useState({
    status: 'pending' as 'pending' | 'assigned' | 'completed',
    limit: 20,
    page: 1
  });

  // Modal state removed - now navigating directly to user detail pages

  // Call state for in-page calling
  const [activeCall, setActiveCall] = useState<{
    userId: number;
    name: string;
    phoneNumber: string;
    status: 'connecting' | 'connected' | 'ended' | 'failed';
    startTime?: Date;
  } | null>(null);

  // Modal functions removed - now navigating directly to user detail pages

  // Pre-call validation: Get next valid user for calling
  const getNextUserMutation = api.queue.getNextUserForCall.useMutation({
    onSuccess: (result) => {
      if (result) {
        // Navigate to calls page for the validated user
        const { userId, userContext } = result;
        
        toast({
          title: "✅ Valid user found",
          description: `Opening call interface for ${userContext.user.firstName} ${userContext.user.lastName}`,
        });
        
        // Navigate to user detail page for calling
        router.push(`/users/${userId}`);
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
    console.log('CALL NEXT VALID USER CLICKED - queueType:', queueType);
    alert(`Finding next valid user for ${queueType}`);
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

  const users = (usersResult as any)?.data || [];
  
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

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
            <p className="text-slate-600 text-lg">Loading session...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="space-y-6 p-6">
        {/* Queue Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 ${config.gradient} rounded-xl flex items-center justify-center shadow-lg`}>
              <IconComponent className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {config.title}
              </h1>
              <p className="text-slate-600 text-lg mt-1">{config.description}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button 
              onClick={handleCallNextValidUser}
              disabled={getNextUserMutation.isLoading || isLoading}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-200 text-white"
            >
              <Phone className={`w-5 h-5 mr-2 ${getNextUserMutation.isLoading ? 'animate-pulse' : ''}`} />
              {getNextUserMutation.isLoading ? 'Finding User...' : 'Call Next Valid User'}
            </Button>
            
            <Button 
              onClick={handleRefresh} 
              variant="outline"
              disabled={isLoading}
              className="border-slate-300 hover:bg-slate-100 shadow-md hover:shadow-lg transition-all duration-200"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh Queue
            </Button>
          </div>
        </div>

        {/* Queue Stats */}
        <div className="grid grid-cols-3 gap-6">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-500 to-red-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-white/20 backdrop-blur-sm">
                  <Clock className="w-8 h-8 text-white" />
                </div>
                <div>
                  <div className="text-sm text-white/80 mb-1">Pending</div>
                  <div className="text-3xl font-bold text-white">{stats.pending}</div>
                  <div className="text-xs text-white/70">Awaiting contact</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-500 to-cyan-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-white/20 backdrop-blur-sm">
                  <Phone className="w-8 h-8 text-white" />
                </div>
                <div>
                  <div className="text-sm text-white/80 mb-1">In Progress</div>
                  <div className="text-3xl font-bold text-white">{stats.assigned}</div>
                  <div className="text-xs text-white/70">Currently calling</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-white/20 backdrop-blur-sm">
                  <User className="w-8 h-8 text-white" />
                </div>
                <div>
                  <div className="text-sm text-white/80 mb-1">Completed Today</div>
                  <div className="text-3xl font-bold text-white">{stats.completedToday}</div>
                  <div className="text-xs text-white/70">Successfully processed</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Queue List */}
        <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
            <CardTitle className="flex items-center gap-3 text-slate-800 text-xl">
              <IconComponent className="w-6 h-6 text-blue-600" />
              {config.title} ({users.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                  <p className="text-slate-600 text-lg">Loading queue...</p>
                </div>
              </div>
            ) : error ? (
              <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  Failed to load queue data. Please try refreshing the page.
                </AlertDescription>
              </Alert>
            ) : users.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center">
                  <IconComponent className="w-8 h-8 text-slate-400" />
                </div>
                <p className="font-medium text-lg text-slate-700">No users in the queue</p>
                <p className="text-sm text-slate-500 mt-1">All users have been processed</p>
              </div>
            ) : (
              <div className="space-y-4">
                {users.map((userContext: any) => {
                  // Extract user data from UserCallContext structure
                  const user = userContext.user || userContext;
                  const claims = userContext.claims || [];
                  
                  return (
                  <div 
                    key={user.id} 
                    className="flex items-center justify-between p-6 border border-slate-200 rounded-xl hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:border-blue-300 transition-all duration-200 bg-white/60 backdrop-blur-sm shadow-sm hover:shadow-md"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 ${config.gradient} rounded-full flex items-center justify-center shadow-md`}>
                          <IconComponent className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <div className="font-semibold text-xl text-slate-900">
                            {user.firstName} {user.lastName}
                          </div>
                          <div className="text-slate-600 flex items-center gap-3 mt-1">
                            <span>{user.phoneNumber}</span>
                            <span>•</span>
                            <span>{claims.length} claim(s)</span>
                            <span>•</span>
                            <div className="flex items-center gap-1 text-xs">
                              <Calendar className="w-3 h-3" />
                              Created {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-4 ml-16">
                        <div className="text-sm text-slate-700 mb-3 font-medium">
                          <strong>Missing:</strong> {config.missingText}
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {queueType === 'outstanding_requests' ? (
                            // Show requirements for requirements queue
                            claims.flatMap((claim: any) => 
                              claim.requirements.map((req: any) => (
                                <Badge 
                                  key={req.id} 
                                  className="text-xs px-3 py-1 bg-red-100 text-red-700 border border-red-200 hover:bg-red-200 transition-colors"
                                >
                                  {req.type.replace(/([A-Z])/g, ' $1').trim()}
                                </Badge>
                              ))
                            )
                          ) : (
                            // Show claim types for unsigned users
                            claims.map((claim: any) => (
                              <Badge 
                                key={claim.id} 
                                className="text-xs px-3 py-1 bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors"
                              >
                                {getFriendlyLenderName(claim.lender)}
                              </Badge>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      {config.showRequirementsCount && (
                        <div 
                          className="text-center text-sm bg-blue-50 px-4 py-3 rounded-lg border border-blue-200 min-w-[100px]"
                          onClick={(e) => e.stopPropagation()} // Prevent card click when clicking the badge
                        >
                          <div className="text-blue-600 font-bold text-lg">
                            {claims.reduce((acc: number, claim: any) => 
                              acc + claim.requirements.length, 0)}
                          </div>
                          <div className="text-xs text-blue-500">Requirements</div>
                        </div>
                      )}
                      
                      <div className="flex flex-col gap-3 min-w-[180px]">
                        <Button 
                          size="default"
                          variant="outline"
                          className="w-full justify-start border-2 border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400 h-12 px-4 py-3 font-medium transition-all duration-200 hover:scale-[1.02] hover:shadow-md"
                          onClick={() => {
                            console.log('VIEW DETAILS CLICKED - FULL USER OBJECT:', userContext);
                            console.log('VIEW DETAILS CLICKED - USER ID:', user.id);
                            console.log('VIEW DETAILS CLICKED - USER KEYS:', Object.keys(user));
                            
                            const userId = user.id;
                            const targetUrl = `/users/${userId}`;
                            
                            console.log('Attempting navigation to user details page:', targetUrl);
                            
                            if (userId) {
                              console.log('User ID is valid, navigating to user detail page');
                              try {
                                router.push(targetUrl as any);
                                console.log('router.push called successfully for user details');
                                
                                setTimeout(() => {
                                  console.log('Current window location after navigation attempt:', window.location.href);
                                }, 100);
                                
                              } catch (error) {
                                console.error('Error during user details navigation:', error);
                                alert(`Navigation error: ${error}`);
                              }
                            } else {
                              console.error('User ID is undefined or falsy:', userId);
                              alert('Error: User ID is undefined');
                            }
                          }}
                        >
                          <User className="w-4 h-4 mr-3" />
                          View Details
                        </Button>
                        
                        <Button 
                          size="default"
                          className="w-full justify-start bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg h-12 px-4 py-3 font-medium transition-all duration-200 hover:scale-[1.02] hover:shadow-xl border-0"
                          onClick={() => {
                            console.log('CALL NOW CLICKED - FULL USER OBJECT:', userContext);
                            console.log('CALL NOW CLICKED - USER ID:', user.id);
                            console.log('CALL NOW CLICKED - USER KEYS:', Object.keys(user));
                            
                            const userId = user.id;
                            const targetUrl = `/users/${userId}`;
                            
                            console.log('Attempting navigation to:', targetUrl);
                            console.log('Router object:', router);
                            
                            alert(`Call Now clicked for user ${userId}. Check console for navigation details.`);
                            
                            if (userId) {
                              console.log('User ID is valid, calling router.push');
                              try {
                                router.push(targetUrl as any);
                                console.log('router.push called successfully');
                                
                                // Add a slight delay to see if navigation occurs
                                setTimeout(() => {
                                  console.log('Current window location after navigation attempt:', window.location.href);
                                }, 100);
                                
                              } catch (error) {
                                console.error('Error during router.push:', error);
                                alert(`Navigation error: ${error}`);
                              }
                            } else {
                              console.error('User ID is undefined or falsy:', userId);
                              alert('Error: User ID is undefined');
                            }
                          }}
                        >
                          <Phone className="w-4 h-4 mr-3" />
                          Call Now
                        </Button>
                      </div>
                    </div>
                  </div>
                )})}
              </div>
            )}
          </CardContent>
        </Card>

        {/* User Details Modal removed - now navigating directly to user detail pages */}

        {/* In-Page Call Interface */}
        {activeCall && (
          <InPageCallInterface 
            callData={activeCall}
            onEndCall={endCall}
            onOpenFullInterface={openFullInterface}
          />
        )}
      </div>
    </div>
  );
} 
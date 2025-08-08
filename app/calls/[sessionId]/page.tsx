'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Phone, ArrowLeft, User, AlertCircle, Activity, Loader2 } from 'lucide-react';
import { Button } from '@/modules/core/components/ui/button';
import { Card, CardContent } from '@/modules/core/components/ui/card';
import { CallInterface } from '@/modules/calls/components/CallInterface';
import { api } from '@/lib/trpc/client';
import { callSessionValidation } from '@/lib/validation/call-session';
import React from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';

// New Call Interface Component for handling fresh calls
function NewCallInterface({ 
  userId, 
  phoneNumber, 
  userName 
}: { 
  userId: number; 
  phoneNumber: string; 
  userName: string; 
}) {
  const router = useRouter();
  const { toast } = useToast();

  // Fetch user context for the call - PERFORMANCE OPTIMIZED
  const { data: userContextResponse, isLoading: userContextLoading, error: userContextError } = api.users.getUserContext.useQuery(
    { userId },
    { 
      enabled: !!userId,
      retry: 1, // Only retry once to avoid hanging
      staleTime: 10 * 60 * 1000, // INCREASED: 10 minutes cache (was 2)
      refetchOnWindowFocus: false,
      refetchOnMount: false, // Don't refetch on mount if cached
      refetchInterval: false // ADDED: Disable auto-refetching
    }
  );

  // Transform user context from users module format to calls module format
  const userContextData = userContextResponse?.data ? {
    userId: userContextResponse.data.user.id,
    firstName: userContextResponse.data.user.firstName || 'Unknown',
    lastName: userContextResponse.data.user.lastName || 'User',
    email: userContextResponse.data.user.email || '',
    phoneNumber: userContextResponse.data.user.phoneNumber || '',
    dateOfBirth: userContextResponse.data.user.dateOfBirth || null,
    createdAt: userContextResponse.data.user.createdAt || null,
    address: userContextResponse.data.user.address ? {
      fullAddress: userContextResponse.data.user.address.fullAddress || '',
      houseNumber: userContextResponse.data.user.address.houseNumber || '',
      street: userContextResponse.data.user.address.street || '',
      buildingName: userContextResponse.data.user.address.buildingName || '',
      postCode: userContextResponse.data.user.address.postCode || '',
      county: userContextResponse.data.user.address.county || '',
      district: userContextResponse.data.user.address.district || '',
      postTown: userContextResponse.data.user.address.postTown || ''
    } : undefined,
    claims: userContextResponse.data.claims.map(claim => ({
      id: claim.id,
      type: claim.type || 'unknown',
      status: claim.status || 'unknown',
      lender: claim.lender || 'unknown',
      value: 0, // Not available in users module data
      requirements: claim.requirements.map(req => ({
        id: req.id,
        type: req.type || 'unknown',
        status: req.status || 'unknown',
        reason: req.reason || 'No reason provided'
      }))
    })),
    callScore: userContextResponse.data.callScore ? {
      currentScore: userContextResponse.data.callScore.currentScore,
      totalAttempts: userContextResponse.data.callScore.totalAttempts,
      lastOutcome: userContextResponse.data.callScore.lastOutcome || 'no_attempt'
    } : {
      currentScore: 50,
      totalAttempts: 0,
      lastOutcome: 'no_attempt'
    }
  } : null;

  if (userContextLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <Card className="w-full max-w-md mx-auto border-0 shadow-xl bg-white/80 backdrop-blur-sm">
          <CardContent className="p-8 text-center">
            <Activity className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Preparing Call</h2>
            <p className="text-slate-600">
              Loading user context for {userName}...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (userContextError || !userContextData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <Card className="w-full max-w-md mx-auto border-0 shadow-xl bg-white/80 backdrop-blur-sm">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <User className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="text-lg font-semibold mb-2 text-red-700">Unable to Load User</h2>
            <p className="text-red-600 mb-4">
              {userContextError?.message || 'Failed to load user context for call'}
            </p>
            <Button 
              onClick={() => router.push(`/users/${userId}`)}
              variant="outline"
              className="w-full"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to User Details
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success - show call interface with user context
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="p-4 max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-6">
          <Button 
            onClick={() => router.push(`/users/${userId}`)}
            variant="ghost" 
            size="sm"
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to User Details
          </Button>
          
          <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-slate-800">Starting New Call</h1>
                  <p className="text-slate-600 mt-1">
                    Calling {userName} at {phoneNumber}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-slate-500">User ID</div>
                  <div className="font-mono text-slate-800">{userId}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Call Interface - This will handle both Twilio call AND database session creation */}
        <CallInterface 
          userContext={userContextData}
          onCallComplete={(outcome) => {
            toast({
              title: "Call Completed",
              description: `Outcome: ${outcome.outcomeType.replace('_', ' ').toUpperCase()}`,
            });
            // Navigate back to user details
            router.push(`/users/${userId}`);
          }}
        />
      </div>
    </div>
  );
}

export default function CallSessionPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const sessionId = params.sessionId as string;
  const userId = searchParams.get('userId');
  const phoneNumber = searchParams.get('phone');
  const userName = searchParams.get('name');

  // Handle new call flow - redirect to proper call interface
  if (sessionId === 'new' && userId && phoneNumber) {
    return <NewCallInterface 
      userId={parseInt(userId)} 
      phoneNumber={phoneNumber} 
      userName={userName || 'Unknown User'} 
    />;
  }

  // Validate session ID early
  React.useEffect(() => {
    if (sessionId) {
      try {
        // Validate the session ID format
        callSessionValidation.validateWithContext(sessionId, 'Call Session Page Load');
      } catch (error: any) {
        console.error('❌ Invalid session ID detected:', error.message);
        
        // If it's a legacy format, redirect appropriately
        if (callSessionValidation.detectLegacyFormat(sessionId)) {
          toast({
            title: "Invalid Call Session",
            description: "This call session format is no longer supported. Please start a new call.",
            variant: "destructive"
          });
          
          // Redirect to user page if we have userId, otherwise to dashboard
          if (userId) {
            router.replace(`/users/${userId}`);
          } else {
            router.replace('/dashboard');
          }
          return;
        }
        
        // For other invalid formats, show error and redirect
        toast({
          title: "Invalid Session ID",
          description: "The call session ID is not valid. Redirecting...",
          variant: "destructive"
        });
        router.replace('/dashboard');
        return;
      }
    }
  }, [sessionId, userId, router]);

  // Try to get user context - first try from URL params, then from session ID
  const userIdFromUrl = userId ? parseInt(userId) : null;
  
  // Fetch user context from URL params if available - PERFORMANCE OPTIMIZED
  const { data: userContextResponse, isLoading: userContextLoading, error: userContextError } = api.users.getUserContext.useQuery(
    { userId: userIdFromUrl || 0 },
    { 
      enabled: !!userIdFromUrl,
      retry: 1, // Reduced retries for faster failure
      staleTime: 10 * 60 * 1000, // INCREASED: 10 minutes cache (was 2)
      refetchOnWindowFocus: false, // Don't refetch on focus
      refetchOnMount: false, // Don't refetch on mount if cached
      refetchInterval: false // ADDED: Disable auto-refetching
    }
  );

  // Fallback: Get call session data if no URL params (includes user context) - PERFORMANCE OPTIMIZED
  const { data: callSessionResponse, isLoading: sessionLoading, error: sessionError } = api.calls.getCallSession.useQuery(
    { sessionId },
    { 
      enabled: !userIdFromUrl && !!sessionId,
      retry: 1, // Reduced retries
      staleTime: 5 * 60 * 1000, // INCREASED: 5 minutes cache (was 2)
      refetchOnWindowFocus: false,
      refetchOnMount: false, // Don't refetch on mount if cached
      refetchInterval: false // ADDED: Disable auto-refetching
    }
  );

  // Determine which data source to use
  const isLoading = userContextLoading || sessionLoading;
  const error = userContextError || sessionError;
  const userContextData = userContextResponse?.data || callSessionResponse?.userContext;

  // Progressive timeout handling
  const [loadingTimeout, setLoadingTimeout] = React.useState(false);
  React.useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        setLoadingTimeout(true);
      }, 3000); // Show timeout message after 3 seconds
      
      return () => clearTimeout(timer);
    } else {
      setLoadingTimeout(false);
    }
  }, [isLoading]);

  // End call mutation to clear stuck call state
  const endCallMutation = api.calls.updateCallStatus.useMutation({
    onSuccess: () => {
      router.push('/dashboard');
    },
    onError: () => {
      // Force redirect even if API call fails
      router.push('/dashboard');
    }
  });

  const handleEndCall = () => {
    // Try to end the call session, but redirect regardless
    endCallMutation.mutate({
      sessionId,
      status: 'completed',
      endedAt: new Date()
    });
  };

  // Loading state with progressive feedback
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <Card className="w-full max-w-md mx-auto border-0 shadow-xl bg-white/80 backdrop-blur-sm">
          <CardContent className="p-8 text-center">
            <Activity className={`w-8 h-8 ${loadingTimeout ? 'animate-pulse text-amber-500' : 'animate-spin text-blue-600'} mx-auto mb-4`} />
            
            {loadingTimeout ? (
              <>
                <h2 className="text-lg font-semibold mb-2 text-amber-700">Loading Taking Longer...</h2>
                <p className="text-amber-600 mb-4">
                  The system is working to load user data. This may take a moment due to database processing.
                </p>
                <div className="text-sm text-slate-500 mb-6">
                  Session ID: {sessionId.slice(0, 8)}...
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold mb-2 text-slate-800">Loading User Data</h2>
                <p className="text-slate-600 mb-6">Fetching user context for call session...</p>
              </>
            )}
            
            <div className="space-y-3">
              <Button 
                onClick={handleEndCall}
                variant="destructive"
                className="w-full"
                disabled={endCallMutation.isLoading}
              >
                {endCallMutation.isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Ending Call...
                  </>
                ) : (
                  'End Call & Exit'
                )}
              </Button>
              <Button 
                variant="outline"
                onClick={() => router.push('/dashboard')}
                className="w-full"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </div>
            
            {loadingTimeout && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-700">
                  💡 If this continues, the system may be processing a large amount of user data. 
                  You can safely end the call and try again.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error || !userContextData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <Card className="w-full max-w-md mx-auto border-0 shadow-xl bg-white/80 backdrop-blur-sm">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2 text-slate-800">User Data Error</h2>
            <p className="text-slate-600 mb-4">
              {error?.message || 'Could not load user data for this call session'}
            </p>
            <div className="space-y-2">
              <Button 
                onClick={() => router.push('/queue/unsigned')}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
              >
                Back to Queue
              </Button>
              <Button 
                variant="outline"
                onClick={() => window.location.reload()}
                className="w-full"
              >
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Transform the user context to match CallInterface expectations
  // Handle different data structures from getUserContext vs getCallSession
    const userData = (userContextData as any).user || userContextData; // Type assertion to handle union types
  const userContext = {
    userId: userData.id || userData.userId,
    firstName: userData.firstName || 'Unknown',
    lastName: userData.lastName || 'User',
    email: userData.email || `user${userData.id || userData.userId}@unknown.com`,
    // Ensure phoneNumber present even for minimal missed-call contexts
    phoneNumber: userData.phoneNumber || (userData as any).phone || phoneNumber || '+44000000000',
    dateOfBirth: userData.dateOfBirth || userData.date_of_birth || null,
    createdAt: userData.createdAt || userData.created_at || null,
    address: userData.address ? {
      fullAddress: userData.address.fullAddress || 'Address not available',
      houseNumber: userData.address.houseNumber || '',
      street: userData.address.street || '',
      buildingName: userData.address.buildingName || '',
      postCode: userData.address.postCode || '',
      county: userData.address.county || '',
      district: userData.address.district || '',
      postTown: userData.address.postTown || ''
    } : undefined,
    
    // Convert claims to the format expected by CallInterface
    claims: (userContextData.claims || []).map((claim: any) => ({
      id: claim.id,
      type: claim.type || 'unknown',
      status: claim.status || 'pending',
      value: claim.value || 0,
      lender: claim.lender || 'Unknown',
      requirements: (claim.requirements || []).map((req: any) => ({
        id: req.id,
        type: req.type || 'unknown',
        status: req.status || 'pending',
        reason: req.reason || 'No reason provided'
      }))
    })),
    
    // Transform other context - flatten requirements from all claims
    requirements: (userContextData.claims || []).flatMap((claim: any) => 
      (claim.requirements || []).map((req: any) => ({
        id: req.id,
        type: req.type || 'unknown',
        status: req.status || 'pending',
        reason: req.reason || 'No reason provided'
      }))
    ),
    callScore: userContextData.callScore ? {
      currentScore: userContextData.callScore.currentScore,
      totalAttempts: userContextData.callScore.totalAttempts,
      lastOutcome: userContextData.callScore.lastOutcome || undefined,
      lastCallAt: userContextData.callScore.lastCallAt || undefined
    } : ((userContextData as any).callScore ? {
      // Support minimal missed-call contexts that already provide a default callScore
      currentScore: (userContextData as any).callScore.currentScore,
      totalAttempts: (userContextData as any).callScore.totalAttempts,
      lastOutcome: (userContextData as any).callScore.lastOutcome
    } : {
      currentScore: 75,
      totalAttempts: 1,
      lastCallAt: undefined
    })
  };

  const handleCallComplete = (outcome: any) => {
    console.log('Call completed with outcome:', outcome);
    // Navigate back to user page or queue
    if (userId) {
      router.push(`/users/${userId}`);
    } else {
      router.push('/queue/unsigned');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-white/20 shadow-lg px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="default"
              responsive="nowrap"
              onClick={() => router.push(userId ? `/users/${userId}` : '/queue/unsigned')}
              className="border-2 border-slate-300 hover:bg-slate-100 shadow-md hover:shadow-lg transition-all duration-200"
            >
              <ArrowLeft className="w-4 h-4 mr-2 flex-shrink-0" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-3 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                <Phone className="w-6 h-6 text-blue-600" />
                Call Session: {userContext.firstName} {userContext.lastName}
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Session ID: {sessionId} • {userContext.phoneNumber}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-gradient-to-r from-green-50 to-emerald-50 px-4 py-2 rounded-lg border border-green-200 shadow-sm">
            <User className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-700">Agent: Authenticated User</span>
          </div>
        </div>
      </div>

      {/* Main Call Interface */}
      <div className="max-w-7xl mx-auto p-6">
        <CallInterface
          userContext={userContext}
          onCallComplete={handleCallComplete}
        />
      </div>
    </div>
  );
} 
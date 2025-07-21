'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Phone, ArrowLeft, User, AlertCircle, Activity } from 'lucide-react';
import { Button } from '@/modules/core/components/ui/button';
import { Card, CardContent } from '@/modules/core/components/ui/card';
import { CallInterface } from '@/modules/calls/components/CallInterface';
import { api } from '@/lib/trpc/client';

export default function CallSessionPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const sessionId = params.sessionId as string;
  const userId = searchParams.get('userId');
  const phoneNumber = searchParams.get('phone');
  const userName = searchParams.get('name');

  // Try to get user context - first try from URL params, then from session ID
  const userIdFromUrl = userId ? parseInt(userId) : null;
  
  // Fetch user context from URL params if available
  const { data: userContextResponse, isLoading: userContextLoading, error: userContextError } = api.users.getUserContext.useQuery(
    { userId: userIdFromUrl || 0 },
    { 
      enabled: !!userIdFromUrl,
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  // Fallback: Get call session data if no URL params (includes user context)
  const { data: callSessionResponse, isLoading: sessionLoading, error: sessionError } = api.calls.getCallSession.useQuery(
    { sessionId },
    { 
      enabled: !userIdFromUrl && !!sessionId,
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  // Determine which data source to use
  const isLoading = userContextLoading || sessionLoading;
  const error = userContextError || sessionError;
  const userContextData = userContextResponse?.data || callSessionResponse?.userContext;

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

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <Card className="w-full max-w-md mx-auto border-0 shadow-xl bg-white/80 backdrop-blur-sm">
          <CardContent className="p-8 text-center">
            <Activity className="w-8 h-8 animate-pulse text-blue-600 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2 text-slate-800">Loading User Data</h2>
            <p className="text-slate-600 mb-6">Fetching user context for call session...</p>
            
            <div className="space-y-3">
              <Button 
                onClick={handleEndCall}
                variant="destructive"
                className="w-full"
                disabled={endCallMutation.isLoading}
              >
                {endCallMutation.isLoading ? 'Ending Call...' : 'End Call & Exit'}
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
    phoneNumber: userData.phoneNumber || phoneNumber || '+44000000000',
    address: userData.address ? {
      fullAddress: userData.address.fullAddress || 'Address not available',
      postCode: userData.address.postCode || '',
      county: userData.address.county || ''
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
    } : {
      currentScore: 75,
      totalAttempts: 1,
      lastCallAt: undefined
    }
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
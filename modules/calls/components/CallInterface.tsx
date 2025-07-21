'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/core/components/ui/card';
import { Button } from '@/modules/core/components/ui/button';
import { Badge } from '@/modules/core/components/ui/badge';
import { Alert, AlertDescription } from '@/modules/core/components/ui/alert';
import { 
  Phone, 
  PhoneOff, 
  Mic, 
  MicOff, 
  Clock, 
  User,
  MapPin,
  FileText,
  DollarSign,
  Building,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Send,
  MessageSquare,
  Activity
} from 'lucide-react';
import { api } from '@/lib/trpc/client';
import { useToast } from '@/modules/core/hooks/use-toast';
import { useTwilioVoice } from '../hooks/useTwilioVoice';
import { CallOutcomeModal } from './CallOutcomeModal';
import { CallHistoryTable } from './CallHistoryTable';
import type { UserCallContext, CallOutcomeOptions } from '../types/call.types';

interface CallInterfaceProps {
  userContext: UserCallContext;
  onCallComplete?: (outcome: CallOutcomeOptions) => void;
  // Remove agentId and agentEmail props - get from auth context
}

export function CallInterface({ 
  userContext, 
  onCallComplete
}: CallInterfaceProps) {
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);
  const [callSessionId, setCallSessionId] = useState<string>('');
  const [submittingOutcome, setSubmittingOutcome] = useState(false);
  const { toast } = useToast();

  // Get authenticated agent context from tRPC
  const { data: agentContext, isLoading: agentLoading, error: agentError } = api.auth.me.useQuery();

  // Wait for agent context to load before proceeding
  if (agentLoading) {
    return (
      <Card className="w-full max-w-4xl mx-auto border-0 shadow-xl bg-white/80 backdrop-blur-sm">
        <CardContent className="p-8 text-center">
          <Activity className="w-8 h-8 animate-pulse text-blue-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2 text-slate-800">Loading Agent Context</h2>
          <p className="text-slate-600">Verifying authentication...</p>
        </CardContent>
      </Card>
    );
  }

  if (agentError || !agentContext?.agent) {
    return (
      <Card className="w-full max-w-4xl mx-auto border-0 shadow-xl bg-white/80 backdrop-blur-sm">
        <CardContent className="p-8 text-center">
          <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2 text-slate-800">Authentication Required</h2>
          <p className="text-slate-600">Please log in to access the call interface</p>
          <Button 
            className="mt-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-md hover:shadow-lg transition-all duration-200" 
            onClick={() => window.location.href = '/login'}
            size="default"
            responsive="nowrap"
          >
            Go to Login
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Extract agent info from authenticated context
  const agentId = agentContext.agent.id.toString(); // Convert to string for compatibility
  const agentEmail = agentContext.agent.email;

  // Fetch additional data that was on the user detail page
  // Determine queue type for call context
  const { data: queueType } = api.users.determineUserQueueType.useQuery(
    { userId: userContext.userId },
    { enabled: !!userContext.userId }
  );

  // Fetch call history
  const { data: callHistoryResponse, isLoading: callHistoryLoading } = api.calls.getCallHistoryTable.useQuery(
    { 
      userId: userContext.userId,
      limit: 20,
      page: 1
    },
    { enabled: !!userContext.userId }
  );

  // Fetch SMS conversations - Re-enabled with optimized polling
  const { data: smsConversationsResponse, isLoading: smsLoading } = api.communications.sms.getConversations.useQuery(
    { 
      userId: userContext.userId,
      limit: 10,
      page: 1,
      status: 'active'
    },
    { 
      enabled: !!userContext.userId,
      refetchInterval: 30000, // Refresh every 30 seconds
      staleTime: 15000 // Consider data fresh for 15 seconds
    }
  );

  // Fetch magic link history
  const { data: magicLinkHistoryResponse, isLoading: magicLinkLoading } = api.communications.magicLinks.getUserHistory.useQuery(
    { userId: userContext.userId },
    { enabled: !!userContext.userId }
  );

  // Call session creation mutation
  const initiateCallMutation = api.calls.initiateCall.useMutation({
    onSuccess: (result) => {
      console.log('✅ Call session created in database:', result);
      setCallSessionId(result.callSession.id);
      toast({
        title: "Call Session Started",
        description: "Call session created and tracking started",
      });
    },
    onError: (error) => {
      console.error('❌ Failed to create call session:', error);
      toast({
        title: "Session Creation Failed",
        description: error.message || "Could not create call session",
        variant: "destructive"
      });
    }
  });

  // Call outcome recording mutation
  const recordCallOutcomeMutation = api.calls.recordOutcome.useMutation({
    onSuccess: (result: any) => {
      console.log('✅ Call outcome recorded in database:', result);
      toast({
        title: "Call Completed Successfully",
        description: `Outcome: ${result.outcomeType.replace('_', ' ').toUpperCase()}`,
      });
    },
    onError: (error: any) => {
      console.error('❌ Failed to record call outcome:', error);
      toast({
        title: "Error Saving Outcome",
        description: error.message || "Please try again or contact support",
        variant: "destructive"
      });
    }
  });

  // Call status update mutation
  const updateCallStatusMutation = api.calls.updateCallStatus.useMutation({
    onSuccess: (result: any) => {
      console.log('✅ Call status updated:', result);
    },
    onError: (error: any) => {
      console.error('❌ Failed to update call status:', error);
    }
  });

  // Magic link sending mutation
  const sendMagicLinkMutation = api.communications.sendMagicLinkSMS.useMutation({
    onSuccess: (result) => {
      console.log('✅ Magic link sent successfully:', result);
      toast({ 
        title: "Magic Link Sent!", 
        description: "User will receive the claim portal link via SMS" 
      });
    },
    onError: (error) => {
      console.error('❌ Magic link failed:', error);
      toast({
        title: "Failed to Send Link",
        description: error.message || "Could not send magic link",
        variant: "destructive"
      });
    }
  });

  const {
    isReady,
    isConnecting,
    isInCall,
    isIncomingCall,
    callStatus,
    error,
    makeCall,
    hangUp,
    toggleMute,
    sendDigits,
    callDuration,
    isMuted,
    acceptIncomingCall,
    rejectIncomingCall,
    incomingCallInfo
  } = useTwilioVoice({
    agentId,
    agentEmail,
    autoConnect: true,
    onIncomingCall: (callInfo) => {
      console.log('📞 Incoming call received in CallInterface:', callInfo);
      toast({
        title: "Incoming Call",
        description: `Call from ${callInfo.from}`,
      });
    }
  });

  // Track previous call state to detect when call ends
  const [wasInCall, setWasInCall] = useState(false);

  // Handle incoming call acceptance
  const handleAcceptIncomingCall = () => {
    console.log('✅ Accepting incoming call');
    acceptIncomingCall();
    
    // Create call session for accepted incoming call if we don't have one
    if (!callSessionId && incomingCallInfo) {
      console.log('📝 Creating call session for accepted incoming call');
      initiateCallMutation.mutate({
        userId: 999999, // Unknown caller ID - will be handled by backend
        direction: 'inbound',
        phoneNumber: incomingCallInfo.from
      });
    }
  };

  // Handle incoming call rejection
  const handleRejectIncomingCall = () => {
    console.log('❌ Rejecting incoming call');
    rejectIncomingCall();
  };

  // Watch for call status changes to update call session with Twilio SID
  useEffect(() => {
    if (callStatus?.state === 'connected' && callStatus.callSid && callSessionId) {
      console.log('📞 Updating call session with Twilio SID:', callStatus.callSid);
      updateCallStatusMutation.mutate({
        sessionId: callSessionId,
        twilioCallSid: callStatus.callSid,
        status: 'connected',
        connectedAt: new Date()
      });
    }
  }, [callStatus?.state, callStatus?.callSid, callSessionId]);

  // Handle call status changes and automatic disposition modal
  useEffect(() => {
    console.log('📊 Call state tracking:', {
      isInCall,
      wasInCall,
      callStatus: callStatus?.state,
      showOutcomeModal
    });

    // Track when we enter a call
    if (isInCall && !wasInCall) {
      console.log('📞 Call started - setting wasInCall to true');
      setWasInCall(true);
      
      // If we don't have a session ID yet, this is a manual call - create a session
      if (!callSessionId) {
        console.log('🆔 Manual call detected - creating call session in database');
        initiateCallMutation.mutate({
          userId: userContext.userId,
          direction: 'outbound',
          phoneNumber: userContext.phoneNumber
        });
      }
    }
    
    // Detect when call ends (was in call, now disconnected OR not in call anymore)
    if (wasInCall && !isInCall) {
      console.log('🔚 Call ended detected - showing disposition modal');
      setWasInCall(false);
      // Show modal immediately - no delay
      setShowOutcomeModal(true);
    }
  }, [isInCall, wasInCall, callStatus?.state, showOutcomeModal]);

  const handleMakeCall = async () => {
    try {
      // 1. Create call session in database first
      console.log('📋 Creating call session in database...');
      const callSessionResult = await initiateCallMutation.mutateAsync({
        userId: userContext.userId,
        phoneNumber: userContext.phoneNumber,
        direction: 'outbound'
      });
      
      console.log('✅ Call session created:', callSessionResult.callSession.id);
      
      // 2. Then start the actual Twilio call
      console.log('📞 Starting Twilio call...');
      await makeCall({
        phoneNumber: userContext.phoneNumber,
        userContext: {
          userId: userContext.userId,
          firstName: userContext.firstName,
          lastName: userContext.lastName,
          claimId: userContext.claims[0]?.id
        }
      });
      
      console.log('✅ Call started successfully');
    } catch (error: any) {
      console.error('❌ Failed to start call:', error);
      toast({
        title: "Call Failed",
        description: error.message || "Could not start call",
        variant: "destructive"
      });
    }
  };

  const handleCallEnd = () => {
    console.log('🔚 Agent ending call manually');
    
    // First hang up the call
    hangUp();
    
    // Immediately show disposition modal for manual end
    console.log('📝 Triggering disposition modal immediately');
    setShowOutcomeModal(true);
    setWasInCall(false); // Reset state
  };

  const handleOutcomeSubmit = async (outcome: CallOutcomeOptions) => {
    setSubmittingOutcome(true);
    try {
      let sessionId = callSessionId;
      
      // If no session ID exists (race condition), create one now
      if (!sessionId || sessionId === '') {
        console.log('⚠️ No session ID available - creating call session now');
        
        toast({
          title: "Creating Call Session",
          description: "Initializing call tracking...",
        });
        
        const result = await initiateCallMutation.mutateAsync({
          userId: userContext.userId,
          direction: 'outbound',
          phoneNumber: userContext.phoneNumber
        });
        
        sessionId = result.callSession.id;
        setCallSessionId(sessionId);
        console.log('✅ Created call session for outcome:', sessionId);
      }

      console.log('📋 Recording call outcome in database:', {
        sessionId: sessionId,
        outcome,
        userContext
      });
      
      toast({
        title: "Recording Call Outcome",
        description: "Saving call notes and disposition...",
      });
      
      // Record outcome in database via tRPC
      await recordCallOutcomeMutation.mutateAsync({
        sessionId: sessionId,
        outcomeType: outcome.outcomeType,
        outcomeNotes: outcome.outcomeNotes || '',
        callbackDateTime: outcome.callbackDateTime,
        callbackReason: outcome.callbackReason,
        magicLinkSent: outcome.magicLinkSent || false,
        smsSent: outcome.smsSent || false,
        documentsRequested: outcome.documentsRequested,
        scoreAdjustment: outcome.scoreAdjustment,
        nextCallDelayHours: outcome.nextCallDelayHours
      });
      
      setShowOutcomeModal(false);
      setWasInCall(false); // Reset call tracking
      onCallComplete?.(outcome);
    } catch (error: any) {
      console.error('❌ Failed to save call outcome:', error);
      toast({
        title: "Error Saving Outcome",
        description: error.message || "Please try again or contact support",
        variant: "destructive"
      });
    } finally {
      setSubmittingOutcome(false);
    }
  };

  // Prevent closing modal without disposition
  const handleModalClose = () => {
    toast({
      title: "Disposition Required",
      description: "Please select a call outcome before closing",
      variant: "destructive"
    });
  };

  const handleSendMagicLink = () => {
    const payload = {
      userId: userContext.userId,
      phoneNumber: userContext.phoneNumber,
      linkType: 'claimPortal' as const
    };
    
    console.log('📤 Sending magic link with payload:', payload);
    
    if (!userContext.phoneNumber) {
      console.error('❌ No phone number available');
      toast({
        title: "No Phone Number",
        description: "This user doesn't have a phone number on file",
        variant: "destructive"
      });
      return;
    }
    
    sendMagicLinkMutation.mutate(payload);
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getPendingRequirements = () => {
    return userContext.claims.flatMap(claim => 
      claim.requirements.filter(req => req.status === 'PENDING')
    );
  };

  return (
    <>
      {/* Disposition Required Alert */}
      {wasInCall && !isInCall && !showOutcomeModal && (
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-l-4 border-yellow-500 p-4 mb-6 rounded-r-lg shadow-lg backdrop-blur-sm">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-yellow-500 mr-3 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-yellow-800 font-medium">
                ⚠️ Call Disposition Required
              </p>
              <p className="text-yellow-700 text-sm">
                Please complete the call outcome form to finish this call session.
              </p>
            </div>
            <Button 
              onClick={() => setShowOutcomeModal(true)}
              size="default"
              responsive="nowrap"
              className="bg-yellow-600 hover:bg-yellow-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
            >
              Complete Disposition
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Information */}
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
              <CardTitle className="flex items-center gap-2 text-slate-800">
                <User className="w-5 h-5 text-blue-600" />
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-2xl font-bold text-slate-900">
                    {userContext.firstName} {userContext.lastName}
                  </div>
                  <div className="text-slate-600 flex items-center gap-2 mt-1">
                    <Phone className="w-4 h-4 flex-shrink-0" />
                    {userContext.phoneNumber}
                  </div>
                  {userContext.address && (
                    <div className="text-slate-600 flex items-center gap-2 mt-1">
                      <MapPin className="w-4 h-4 flex-shrink-0" />
                      {userContext.address.fullAddress}
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="flex items-center gap-1 border-blue-200 text-blue-700 bg-blue-50">
                      <FileText className="w-3 h-3" />
                      {userContext.claims.length} Claims
                    </Badge>
                    <Badge 
                      variant={getPendingRequirements().length > 0 ? "destructive" : "default"}
                      className="flex items-center gap-1"
                    >
                      <AlertCircle className="w-3 h-3" />
                      {getPendingRequirements().length} Pending
                    </Badge>
                  </div>
                  
                  <div className="text-sm text-slate-500 bg-slate-50 px-3 py-2 rounded-lg">
                    Score: {userContext.callScore.currentScore} | 
                    Attempts: {userContext.callScore.totalAttempts}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Claims Overview */}
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
              <CardTitle className="text-slate-800">Active Claims</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {userContext.claims.map((claim, index) => (
                  <div key={claim.id} className="border border-slate-200 rounded-xl p-4 bg-gradient-to-r from-white to-slate-50 shadow-sm hover:shadow-md transition-all duration-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50">{claim.type}</Badge>
                        <span className="font-medium text-slate-800">{claim.lender}</span>
                      </div>
                      <Badge 
                        variant={claim.status === 'documents_needed' ? 'destructive' : 'default'}
                        className="bg-emerald-100 text-emerald-700 border-emerald-200"
                      >
                        {claim.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm text-slate-700">Pending Requirements:</h4>
                      {claim.requirements.filter(req => req.status === 'PENDING').map((req, reqIndex) => (
                        <div key={req.id} className="flex items-center gap-2 text-sm">
                          <AlertCircle className="w-3 h-3 text-amber-500 flex-shrink-0" />
                          <span className="text-slate-600">{req.type.replace(/_/g, ' ')}</span>
                          {req.reason && (
                            <span className="text-slate-500">- {req.reason}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Call History */}
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
              <CardTitle className="flex items-center gap-2 text-slate-800">
                <Phone className="w-5 h-5 text-blue-600" />
                Call History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {callHistoryLoading ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-sm text-slate-500 mt-2">Loading call history...</p>
                </div>
              ) : callHistoryResponse?.calls?.length ? (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {callHistoryResponse.calls.slice(0, 5).map((call: any, index: number) => (
                    <div key={index} className="border-l-2 border-blue-200 pl-3 pb-2 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 rounded-r-lg p-2">
                      <div className="flex justify-between items-start">
                        <div className="text-sm">
                          <div className="font-medium text-slate-800">{call.direction === 'outbound' ? 'Outbound' : 'Inbound'}</div>
                          <div className="text-slate-500">{call.startedAt ? new Date(call.startedAt).toLocaleDateString() : 'Unknown date'}</div>
                        </div>
                        <Badge variant="outline" className="text-xs border-blue-200 text-blue-700 bg-blue-50">
                          {call.status || 'unknown'}
                        </Badge>
                      </div>
                      {call.lastOutcomeNotes && (
                        <p className="text-xs text-slate-600 mt-1">{call.lastOutcomeNotes}</p>
                      )}
                    </div>
                  ))}
                  {callHistoryResponse.calls.length > 5 && (
                    <p className="text-xs text-center text-slate-500 pt-2">
                      ... and {callHistoryResponse.calls.length - 5} more calls
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500 text-center py-4">No call history found</p>
              )}
            </CardContent>
          </Card>

          {/* SMS Conversations */}
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
              <CardTitle className="flex items-center gap-2 text-slate-800">
                <MessageSquare className="w-5 h-5 text-blue-600" />
                SMS History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {smsLoading ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-sm text-slate-500 mt-2">Loading SMS history...</p>
                </div>
              ) : smsConversationsResponse?.data?.length ? (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {smsConversationsResponse.data.slice(0, 3).map((conversation: any, index: number) => (
                    <div key={index} className="border border-slate-200 rounded-lg p-3 bg-gradient-to-r from-white to-slate-50 shadow-sm">
                      <div className="flex justify-between items-start mb-1">
                        <div className="text-xs text-slate-500">
                          {conversation.lastMessageAt ? new Date(conversation.lastMessageAt).toLocaleDateString() : 'Unknown date'}
                        </div>
                        <Badge variant="outline" className="text-xs border-blue-200 text-blue-700 bg-blue-50">
                          {conversation.messageCount} messages
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-700">{conversation.lastMessage || 'No preview available'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 text-center py-4">No SMS conversations found</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar - Call Controls and Actions */}
        <div className="space-y-6">
          {/* Call Status */}
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
              <CardTitle className="flex items-center gap-2 text-slate-800">
                <Phone className="w-5 h-5 text-blue-600" />
                Call Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              {/* Connection Status */}
              <div className={`p-3 rounded-lg ${
                isReady ? 'bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-800 border border-emerald-200' : 
                isConnecting ? 'bg-gradient-to-r from-yellow-50 to-amber-50 text-yellow-800 border border-yellow-200' : 
                'bg-gradient-to-r from-slate-50 to-gray-50 text-slate-800 border border-slate-200'
              }`}>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    isReady ? 'bg-emerald-500' : 
                    isConnecting ? 'bg-yellow-500' : 
                    'bg-slate-500'
                  }`} />
                  <span className="font-medium">
                    {isConnecting ? 'Connecting...' : isReady ? 'Ready' : 'Not Connected'}
                  </span>
                </div>
                {error && (
                  <div className="text-red-600 text-sm mt-1">{error}</div>
                )}
              </div>

              {/* Call Duration */}
              {isInCall && (
                <div className="text-center bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
                  <div className="text-3xl font-mono font-bold text-blue-600">
                    {formatDuration(callDuration)}
                  </div>
                  <div className="text-sm text-blue-500">Call Duration</div>
                </div>
              )}

              {/* Main Call Button */}
              <div className="flex justify-center">
                {!isInCall ? (
                  <Button
                    onClick={handleMakeCall}
                    disabled={!isReady}
                    size="xl"
                    responsive="nowrap"
                    className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    <Phone className="w-6 h-6 mr-2 flex-shrink-0" />
                    Call {userContext.firstName}
                  </Button>
                ) : (
                  <Button
                    onClick={handleCallEnd}
                    size="xl"
                    responsive="nowrap"
                    className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    <PhoneOff className="w-6 h-6 mr-2 flex-shrink-0" />
                    End Call & Add Notes
                  </Button>
                )}
              </div>

              {/* In-Call Controls */}
              {isInCall && (
                <div className="flex justify-center gap-4">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={toggleMute}
                    className={`border-2 transition-all duration-200 ${isMuted ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' : 'border-slate-300 hover:bg-slate-100'} shadow-md hover:shadow-lg`}
                  >
                    {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </Button>
                </div>
              )}

              {/* DTMF Controls (if needed for transfers) */}
              {isInCall && (
                <div className="text-center">
                  <p className="text-sm text-slate-500 mb-2">DTMF available via sendDigits() if needed</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Call Context & Reason */}
          {queueType?.data?.queueType && (
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm border-l-4 border-l-blue-500">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-lg">
                <CardTitle className="flex items-center gap-2 text-blue-700">
                  <AlertCircle className="w-5 h-5" />
                  Call Reason
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-2">
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800 border border-blue-200">
                    {queueType.data.queueType.replace('_', ' ').toUpperCase()}
                  </Badge>
                  <p className="text-sm text-slate-600">
                    {queueType.data.queueType === 'unsigned_users' && 'User has not signed their claim documents yet'}
                    {queueType.data.queueType === 'outstanding_requests' && 'User has outstanding document requirements'}
                    {queueType.data.queueType === 'callback' && 'User has requested a callback'}
                  </p>
                  <div className="text-xs text-slate-500 mt-2 bg-slate-50 px-3 py-2 rounded-lg">
                    Queue determination: {queueType.data.eligible ? 'Eligible' : 'Not eligible'}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
              <CardTitle className="flex items-center gap-2 text-slate-800">
                <Send className="w-5 h-5 text-blue-600" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-6">
              <Button 
                onClick={handleSendMagicLink}
                disabled={sendMagicLinkMutation.isPending}
                size="default"
                responsive="nowrap"
                className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white shadow-md hover:shadow-lg transition-all duration-200"
              >
                <Send className="w-4 h-4 mr-2 flex-shrink-0" />
                {sendMagicLinkMutation.isPending ? 'Sending...' : 'Send Claim Portal Link'}
              </Button>
              <Button 
                variant="outline" 
                size="default"
                responsive="nowrap"
                className="w-full justify-start border-2 border-slate-300 hover:bg-slate-100 shadow-md hover:shadow-lg transition-all duration-200"
              >
                <Calendar className="w-4 h-4 mr-2 flex-shrink-0" />
                Schedule Callback
              </Button>
              <Button 
                variant="outline" 
                size="default"
                responsive="nowrap"
                className="w-full justify-start border-2 border-slate-300 hover:bg-slate-100 shadow-md hover:shadow-lg transition-all duration-200"
              >
                <CheckCircle2 className="w-4 h-4 mr-2 flex-shrink-0" />
                Mark as Complete
              </Button>
            </CardContent>
          </Card>

          {/* Magic Link History */}
          {magicLinkHistoryResponse?.data?.length && (
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
                <CardTitle className="flex items-center gap-2 text-slate-800">
                  <Send className="w-5 h-5 text-blue-600" />
                  Magic Links Sent
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {magicLinkHistoryResponse.data.slice(0, 3).map((link: any, index: number) => (
                    <div key={index} className="flex justify-between items-center text-sm p-2 bg-gradient-to-r from-green-50/50 to-emerald-50/50 rounded-lg">
                      <div>
                        <div className="font-medium text-slate-800">{link.linkType}</div>
                        <div className="text-slate-500 text-xs">{new Date(link.sentAt).toLocaleDateString()}</div>
                      </div>
                      <Badge variant="outline" className="text-xs border-emerald-200 text-emerald-700 bg-emerald-50">
                        {link.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Call Outcome Modal - Required after every call */}
      <CallOutcomeModal
        isOpen={showOutcomeModal}
        onClose={handleModalClose}
        onSubmit={handleOutcomeSubmit}
        callSessionId={callSessionId || 'pending'}
        userContext={userContext}
        callDuration={callDuration}
        isSubmitting={submittingOutcome || initiateCallMutation.isPending}
      />

      {/* Incoming Call Notification Modal */}
      {isIncomingCall && incomingCallInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <Card className="w-full max-w-md bg-white shadow-2xl border-0 animate-pulse">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <Phone className="w-8 h-8 text-green-600 animate-bounce" />
              </div>
              <CardTitle className="text-xl font-semibold text-slate-800">
                Incoming Call
              </CardTitle>
              <p className="text-slate-600 mt-2">
                Call from: <span className="font-medium text-slate-800">{incomingCallInfo.from}</span>
              </p>
              <p className="text-sm text-slate-500">
                Call ID: {incomingCallInfo.callSid.slice(-8)}
              </p>
            </CardHeader>
            
            <CardContent className="text-center">
              <div className="flex gap-4 justify-center">
                <Button
                  onClick={handleRejectIncomingCall}
                  variant="outline"
                  size="lg"
                  className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                >
                  <PhoneOff className="w-5 h-5 mr-2" />
                  Decline
                </Button>
                
                <Button
                  onClick={handleAcceptIncomingCall}
                  size="lg"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white shadow-lg"
                >
                  <Phone className="w-5 h-5 mr-2" />
                  Accept
                </Button>
              </div>
              
              <p className="text-xs text-slate-400 mt-4">
                Click Accept to start the conversation or Decline to end the call
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
} 
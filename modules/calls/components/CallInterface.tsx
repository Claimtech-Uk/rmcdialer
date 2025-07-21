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
  agentId: string;
  agentEmail: string;
}

export function CallInterface({ 
  userContext, 
  onCallComplete,
  agentId,
  agentEmail
}: CallInterfaceProps) {
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);
  const [callSessionId, setCallSessionId] = useState<string>('');
  const [submittingOutcome, setSubmittingOutcome] = useState(false);
  const { toast } = useToast();

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

  // Fetch SMS conversations
  const { data: smsConversationsResponse, isLoading: smsLoading } = api.communications.sms.getConversations.useQuery(
    { 
      userId: userContext.userId,
      limit: 10,
      page: 1,
      status: 'active'
    },
    { enabled: !!userContext.userId }
  );

  // Fetch magic link history
  const { data: magicLinkHistoryResponse, isLoading: magicLinkLoading } = api.communications.magicLinks.getUserHistory.useQuery(
    { userId: userContext.userId },
    { enabled: !!userContext.userId }
  );

  // Magic link sending mutation
  const sendMagicLinkMutation = api.communications.sendMagicLinkSMS.useMutation({
    onSuccess: () => {
      toast({ 
        title: "Magic Link Sent!", 
        description: "User will receive the claim portal link via SMS" 
      });
    },
    onError: (error) => {
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
    callStatus,
    error,
    makeCall,
    hangUp,
    toggleMute,
    sendDigits,
    callDuration,
    isMuted
  } = useTwilioVoice({
    agentId,
    agentEmail,
    autoConnect: true
  });

  // Handle call end - show outcome modal
  useEffect(() => {
    if (callStatus?.state === 'disconnected' && callDuration > 0) {
      // Generate a session ID (in production, this would come from the service)
      setCallSessionId(`session_${Date.now()}`);
      setShowOutcomeModal(true);
    }
  }, [callStatus?.state, callDuration]);

  const handleMakeCall = async () => {
    try {
      await makeCall({
        phoneNumber: userContext.phoneNumber,
        userContext: {
          userId: userContext.userId,
          firstName: userContext.firstName,
          lastName: userContext.lastName,
          claimId: userContext.claims[0]?.id
        }
      });
    } catch (error) {
      console.error('Failed to make call:', error);
    }
  };

  const handleCallEnd = () => {
    hangUp();
  };

  const handleOutcomeSubmit = async (outcome: CallOutcomeOptions) => {
    setSubmittingOutcome(true);
    try {
      // In production, this would call the CallService via tRPC
      console.log('Submitting call outcome:', {
        sessionId: callSessionId,
        outcome,
        userContext
      });
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setShowOutcomeModal(false);
      onCallComplete?.(outcome);
    } catch (error) {
      console.error('Failed to save call outcome:', error);
    } finally {
      setSubmittingOutcome(false);
    }
  };

  const handleSendMagicLink = () => {
    sendMagicLinkMutation.mutate({
      userId: userContext.userId,
      phoneNumber: userContext.phoneNumber,
      linkType: 'claimPortal'
    });
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

  const getTotalClaimValue = () => {
    return userContext.claims.reduce((total, claim) => total + (claim.value || 0), 0);
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Context Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-2xl font-bold">
                    {userContext.firstName} {userContext.lastName}
                  </div>
                  <div className="text-gray-600 flex items-center gap-2 mt-1">
                    <Phone className="w-4 h-4" />
                    {userContext.phoneNumber}
                  </div>
                  {userContext.address && (
                    <div className="text-gray-600 flex items-center gap-2 mt-1">
                      <MapPin className="w-4 h-4" />
                      {userContext.address.fullAddress}
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="flex items-center gap-1">
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
                  
                  {getTotalClaimValue() > 0 && (
                    <div className="flex items-center gap-2 text-green-600">
                      <DollarSign className="w-4 h-4" />
                      <span className="font-semibold">
                        £{getTotalClaimValue().toLocaleString()}
                      </span>
                      <span className="text-sm text-gray-500">total value</span>
                    </div>
                  )}
                  
                  <div className="text-sm text-gray-500">
                    Score: {userContext.callScore.currentScore} | 
                    Attempts: {userContext.callScore.totalAttempts}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Claims Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Active Claims</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {userContext.claims.map((claim, index) => (
                  <div key={claim.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{claim.type}</Badge>
                        <span className="font-medium">{claim.lender}</span>
                      </div>
                      <Badge 
                        variant={claim.status === 'documents_needed' ? 'destructive' : 'default'}
                      >
                        {claim.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    
                    {claim.value && (
                      <div className="text-lg font-semibold text-green-600 mb-2">
                        £{claim.value.toLocaleString()}
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Pending Requirements:</h4>
                      {claim.requirements.filter(req => req.status === 'PENDING').map((req, reqIndex) => (
                        <div key={req.id} className="flex items-center gap-2 text-sm">
                          <AlertCircle className="w-3 h-3 text-amber-500" />
                          <span>{req.type.replace(/_/g, ' ')}</span>
                          {req.reason && (
                            <span className="text-gray-500">- {req.reason}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Call Controls Panel */}
        <div className="space-y-6">
          {/* Call Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Call Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Connection Status */}
              <div className={`p-3 rounded-lg ${
                isReady ? 'bg-green-50 text-green-800' : 
                isConnecting ? 'bg-yellow-50 text-yellow-800' : 
                'bg-gray-50 text-gray-800'
              }`}>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    isReady ? 'bg-green-500' : 
                    isConnecting ? 'bg-yellow-500' : 
                    'bg-gray-500'
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
                <div className="text-center">
                  <div className="text-3xl font-mono font-bold text-blue-600">
                    {formatDuration(callDuration)}
                  </div>
                  <div className="text-sm text-gray-500">Call Duration</div>
                </div>
              )}

              {/* Main Call Button */}
              <div className="flex justify-center">
                {!isInCall ? (
                  <Button
                    onClick={handleMakeCall}
                    disabled={!isReady}
                    size="lg"
                    className="bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-full"
                  >
                    <Phone className="w-6 h-6 mr-2" />
                    Call {userContext.firstName}
                  </Button>
                ) : (
                  <Button
                    onClick={handleCallEnd}
                    size="lg"
                    className="bg-red-500 hover:bg-red-600 text-white px-8 py-4 rounded-full"
                  >
                    <PhoneOff className="w-6 h-6 mr-2" />
                    End Call
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
                    className={isMuted ? 'bg-red-50 text-red-600' : ''}
                  >
                    {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </Button>
                </div>
              )}

              {/* DTMF Controls (if needed for transfers) */}
              {isInCall && (
                <div className="text-center">
                  <p className="text-sm text-gray-500 mb-2">DTMF available via sendDigits() if needed</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Call Context & Reason */}
          {queueType?.data?.queueType && (
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-700">
                  <AlertCircle className="w-5 h-5" />
                  Call Reason
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    {queueType.data.queueType.replace('_', ' ').toUpperCase()}
                  </Badge>
                  <p className="text-sm text-gray-600">
                    {queueType.data.queueType === 'unsigned_users' && 'User has not signed their claim documents yet'}
                    {queueType.data.queueType === 'outstanding_requests' && 'User has outstanding document requirements'}
                    {queueType.data.queueType === 'callback' && 'User has requested a callback'}
                  </p>
                  <div className="text-xs text-gray-500 mt-2">
                    Queue determination: {queueType.data.eligible ? 'Eligible' : 'Not eligible'}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Send Magic Link */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="w-5 h-5" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                onClick={handleSendMagicLink}
                disabled={sendMagicLinkMutation.isPending}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                <Send className="w-4 h-4 mr-2" />
                {sendMagicLinkMutation.isPending ? 'Sending...' : 'Send Claim Portal Link'}
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Calendar className="w-4 h-4 mr-2" />
                Schedule Callback
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Mark as Complete
              </Button>
            </CardContent>
          </Card>

          {/* Call History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Call History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {callHistoryLoading ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-sm text-gray-500 mt-2">Loading call history...</p>
                </div>
              ) : callHistoryResponse?.data?.calls?.length ? (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {callHistoryResponse.data.calls.slice(0, 5).map((call, index) => (
                    <div key={index} className="border-l-2 border-gray-200 pl-3 pb-2">
                      <div className="flex justify-between items-start">
                        <div className="text-sm">
                          <div className="font-medium">{call.direction === 'outbound' ? 'Outbound' : 'Inbound'}</div>
                          <div className="text-gray-500">{call.startedAt ? new Date(call.startedAt).toLocaleDateString() : 'Unknown date'}</div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {call.status || 'unknown'}
                        </Badge>
                      </div>
                      {call.lastOutcomeNotes && (
                        <p className="text-xs text-gray-600 mt-1">{call.lastOutcomeNotes}</p>
                      )}
                    </div>
                  ))}
                  {callHistoryResponse.data.calls.length > 5 && (
                    <p className="text-xs text-center text-gray-500 pt-2">
                      ... and {callHistoryResponse.data.calls.length - 5} more calls
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">No call history found</p>
              )}
            </CardContent>
          </Card>

          {/* SMS Conversations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                SMS History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {smsLoading ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-sm text-gray-500 mt-2">Loading SMS history...</p>
                </div>
              ) : smsConversationsResponse?.data?.conversations?.length ? (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {smsConversationsResponse.data.conversations.slice(0, 3).map((conversation, index) => (
                    <div key={index} className="border border-gray-200 rounded p-2">
                      <div className="flex justify-between items-start mb-1">
                        <div className="text-xs text-gray-500">
                          {conversation.lastMessageAt ? new Date(conversation.lastMessageAt).toLocaleDateString() : 'Unknown date'}
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {conversation.messageCount} messages
                        </Badge>
                      </div>
                      <p className="text-sm">{conversation.lastMessage || 'No preview available'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">No SMS conversations found</p>
              )}
            </CardContent>
          </Card>

          {/* Magic Link History */}
          {magicLinkHistoryResponse?.data?.links?.length && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="w-5 h-5" />
                  Magic Links Sent
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {magicLinkHistoryResponse.data.links.slice(0, 3).map((link, index) => (
                    <div key={index} className="flex justify-between items-center text-sm">
                      <div>
                        <div className="font-medium">{link.linkType}</div>
                        <div className="text-gray-500 text-xs">{new Date(link.sentAt).toLocaleDateString()}</div>
                      </div>
                      <Badge variant="outline" className="text-xs">
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

      {/* Call Outcome Modal */}
      <CallOutcomeModal
        isOpen={showOutcomeModal}
        onClose={() => setShowOutcomeModal(false)}
        onSubmit={handleOutcomeSubmit}
        callSessionId={callSessionId}
        userContext={userContext}
        callDuration={callDuration}
        isSubmitting={submittingOutcome}
      />
    </>
  );
} 
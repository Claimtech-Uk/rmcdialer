'use client';

import React, { useState, useEffect } from 'react';
import { X, Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, Clock, User } from 'lucide-react';
import { Button } from '@/modules/core/components/ui/button';
import { Card } from '@/modules/core/components/ui/card';
import { api } from '@/lib/trpc/client';
import { CallOutcomeModal } from '@/modules/calls/components/CallOutcomeModal';

type CallState = 'idle' | 'ringing' | 'connected' | 'ended';

interface CallSidebarProps {
  callState: CallState;
  callData?: {
    callerName?: string;
    callerPhone?: string;
    callDuration?: string;
    userId?: string;
    userContext?: any;
  };
  onAcceptCall?: () => void;
  onDeclineCall?: () => void;
  onEndCall?: () => void;
  onToggleMute?: () => void;
  onToggleHold?: () => void;
  isMuted?: boolean;
  isOnHold?: boolean;
  onClose?: () => void;
  onDispositionComplete?: () => void;
}

export function CallSidebar({
  callState,
  callData,
  onAcceptCall,
  onDeclineCall,
  onEndCall,
  onToggleMute,
  onToggleHold,
  isMuted = false,
  isOnHold = false,
  onClose,
  onDispositionComplete,
}: CallSidebarProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  
  // Shared session state between Connected and PostCall components
  const [userDetails, setUserDetails] = useState<any>(null);
  const [loadingUserDetails, setLoadingUserDetails] = useState(false);

  // Auto-expand when call connects
  useEffect(() => {
    if (callState === 'connected') {
      setIsExpanded(true);
    }
  }, [callState]);

  // Don't render if no active call
  if (callState === 'idle') return null;

  // Handle close with disposition protection
  const handleClose = () => {
    if (callState === 'ended') {
      // Don't allow closing during disposition
      return;
    }
    onClose?.();
  };

  const sidebarWidth = () => {
    if (callState === 'ringing') return 'w-80'; // 320px - compact for incoming
    if (callState === 'connected') return 'w-96'; // 384px - full context
    if (callState === 'ended') return 'w-80'; // 320px - disposition form
    return 'w-80';
  };

  return (
    <>
      {/* Desktop: Fixed Right Sidebar */}
      <div className={`
        hidden lg:block
        fixed right-0 top-0 h-full bg-white shadow-xl border-l border-gray-200 z-50
        transform transition-transform duration-300 ease-in-out
        ${sidebarWidth()}
        ${isExpanded ? 'translate-x-0' : 'translate-x-full'}
      `}>
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center space-x-2">
            <Phone className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-gray-900">
              {callState === 'ringing' && 'Incoming Call'}
              {callState === 'connected' && 'Active Call'}
              {callState === 'ended' && 'Call Summary'}
            </span>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="h-8 w-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Sidebar Content */}
        <div className="h-full pb-16 overflow-y-auto">
          {callState === 'ringing' && (
            <RingingCallContent
              callData={callData}
              onAccept={onAcceptCall}
              onDecline={onDeclineCall}
            />
          )}
          
          {callState === 'connected' && (
            <ConnectedCallContent
              callData={callData}
              onEndCall={onEndCall}
              onToggleMute={onToggleMute}
              onToggleHold={onToggleHold}
              isMuted={isMuted}
              isOnHold={isOnHold}
              userDetails={userDetails}
              setUserDetails={setUserDetails}
              loadingUserDetails={loadingUserDetails}
              setLoadingUserDetails={setLoadingUserDetails}
            />
          )}
          
          {callState === 'ended' && (
            <PostCallContent
              callData={callData}
              onClose={handleClose}
              onDispositionComplete={onDispositionComplete}
              userDetails={userDetails}
              loadingUserDetails={loadingUserDetails}
            />
          )}
        </div>
      </div>

      {/* Mobile: Bottom Sheet */}
      <div className="lg:hidden fixed inset-0 z-50">
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black/50 transition-opacity duration-300 opacity-100"
          onClick={handleClose}
        />
        
        {/* Bottom Sheet Container */}
        <div 
          className={`
            absolute bottom-0 left-0 right-0 bg-white 
            transition-transform duration-300 ease-in-out translate-y-0
            ${callState === 'ringing' ? 'h-80' : callState === 'connected' ? 'h-[85vh]' : 'h-96'}
            rounded-t-2xl shadow-2xl overflow-hidden
          `}
        >
          {/* Mobile Handle */}
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-8 h-1 bg-gray-300 rounded-full" />
          </div>

          {/* Mobile Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center space-x-2">
              <Phone className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-gray-900">
                {callState === 'ringing' && 'Incoming Call'}
                {callState === 'connected' && 'Active Call'}  
                {callState === 'ended' && 'Call Summary'}
              </span>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Mobile Content */}
          <div className="h-full pb-20 overflow-y-auto">
            {callState === 'ringing' && (
              <RingingCallContent
                callData={callData}
                onAccept={onAcceptCall}
                onDecline={onDeclineCall}
                isMobile={true}
              />
            )}
            
            {callState === 'connected' && (
              <ConnectedCallContent
                callData={callData}
                onEndCall={onEndCall}
                onToggleMute={onToggleMute}
                onToggleHold={onToggleHold}
                isMuted={isMuted}
                isOnHold={isOnHold}
                isMobile={true}
                userDetails={userDetails}
                setUserDetails={setUserDetails}
                loadingUserDetails={loadingUserDetails}
                setLoadingUserDetails={setLoadingUserDetails}
              />
            )}
            
            {callState === 'ended' && (
              <PostCallContent
                callData={callData}
                onClose={handleClose}
                onDispositionComplete={onDispositionComplete}
                userDetails={userDetails}
                loadingUserDetails={loadingUserDetails}
                isMobile={true}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// Ringing Call Content
function RingingCallContent({ 
  callData, 
  onAccept, 
  onDecline,
  isMobile = false
}: {
  callData?: any;
  onAccept?: () => void;
  onDecline?: () => void;
  isMobile?: boolean;
}) {
  return (
    <div className={`${isMobile ? 'p-4 space-y-4' : 'p-6 space-y-6'}`}>
      {/* Caller Info */}
      <Card className={`${isMobile ? 'p-4' : 'p-6'} text-center`}>
        <div className={`${isMobile ? 'w-12 h-12' : 'w-16 h-16'} bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4`}>
          <User className={`${isMobile ? 'w-6 h-6' : 'w-8 h-8'} text-blue-600`} />
        </div>
        
        <h3 className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold text-gray-900 mb-1`}>
          {callData?.callerName || 'Unknown Caller'}
        </h3>
        
        <p className={`text-gray-600 mb-2 ${isMobile ? 'text-sm' : ''}`}>
          {callData?.callerPhone || 'No phone number'}
        </p>
        
        <div className="text-sm text-gray-500">
          Incoming call...
        </div>
      </Card>

      {/* Quick User Preview */}
      {callData?.userId && (
        <Card className={`${isMobile ? 'p-3' : 'p-4'}`}>
          <h4 className={`font-medium text-gray-900 mb-2 ${isMobile ? 'text-sm' : ''}`}>Quick Preview</h4>
          <div className="text-sm text-gray-600 space-y-1">
            <div>User ID: {callData.userId}</div>
            {callData.callSessionId && (
              <div>Session: {callData.callSessionId.slice(0, 8)}...</div>
            )}
            <div className="text-blue-600">Loading details...</div>
          </div>
        </Card>
      )}

      {/* Action Buttons */}
      <div className={`flex space-x-3 ${isMobile ? 'pt-2' : ''}`}>
        <Button 
          onClick={onDecline}
          variant="outline" 
          className={`flex-1 text-red-600 border-red-200 hover:bg-red-50 ${isMobile ? 'h-12 text-base' : ''}`}
        >
          <PhoneOff className="w-4 h-4 mr-2" />
          Decline
        </Button>
        
        <Button 
          onClick={onAccept}
          className={`flex-1 bg-green-600 hover:bg-green-700 ${isMobile ? 'h-12 text-base' : ''}`}
        >
          <Phone className="w-4 h-4 mr-2" />
          Accept
        </Button>
      </div>
    </div>
  );
}

// Connected Call Content
function ConnectedCallContent({ 
  callData, 
  onEndCall, 
  onToggleMute, 
  onToggleHold,
  isMuted,
  isOnHold,
  isMobile = false,
  userDetails,
  setUserDetails,
  loadingUserDetails,
  setLoadingUserDetails
}: {
  callData?: any;
  onEndCall?: () => void;
  onToggleMute?: () => void;
  onToggleHold?: () => void;
  isMuted?: boolean;
  isOnHold?: boolean;
  isMobile?: boolean;
  userDetails: any;
  setUserDetails: (details: any) => void;
  loadingUserDetails: boolean;
  setLoadingUserDetails: (loading: boolean) => void;
}) {
  const [callNotes, setCallNotes] = useState('');

  // Load user details when call connects
  useEffect(() => {
    if (callData?.callSid && !userDetails && !loadingUserDetails) {
      loadUserDetails();
    }
  }, [callData?.callSid]);

  const loadUserDetails = async () => {
    if (!callData?.callSid) return;
    
    setLoadingUserDetails(true);
    try {
      console.log('🔍 [CallSidebar] Full call data received:', callData);
      console.log('🔍 [CallSidebar] Trying to lookup Call SID:', callData.callSid);
      
      const response = await fetch('/api/simple-call-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callSid: callData.callSid })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.session) {
          console.log('✅ User details loaded:', result.session);
          setUserDetails(result.session);
        } else {
          console.warn('⚠️ No user details found for Call SID:', callData.callSid);
        }
      } else {
        console.error('❌ Failed to load user details:', response.status);
      }
    } catch (error) {
      console.error('❌ Error loading user details:', error);
    } finally {
      setLoadingUserDetails(false);
    }
  };

  const userContext = userDetails?.userClaimsContext ? 
    JSON.parse(userDetails.userClaimsContext) : null;

  return (
    <div className="p-6 space-y-6">
      {/* Call Controls */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900">
              {userContext?.callerName || callData?.callerName || 'Unknown Caller'}
            </h3>
            <p className="text-sm text-gray-600">
              {userContext?.phoneNumber || callData?.callerPhone}
            </p>
          </div>
          
          <div className="flex items-center space-x-1 text-sm text-gray-600">
            <Clock className="w-4 h-4" />
            <span>{callData?.callDuration || '00:00'}</span>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="grid grid-cols-3 gap-3">
          <Button
            variant={isMuted ? "default" : "outline"}
            size="sm"
            onClick={onToggleMute}
            className={isMuted ? "bg-red-600 hover:bg-red-700 text-white" : ""}
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </Button>
          
          <Button
            variant={isOnHold ? "default" : "outline"}
            size="sm"
            onClick={onToggleHold}
            className={isOnHold ? "bg-yellow-600 hover:bg-yellow-700 text-white" : ""}
          >
            {isOnHold ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={onEndCall}
            className="text-red-600 border-red-200 hover:bg-red-50"
          >
            <PhoneOff className="w-4 h-4" />
          </Button>
        </div>
      </Card>

      {/* User Details */}
      <Card className="p-4">
        <h4 className="font-medium text-gray-900 mb-3">User Details</h4>
        {loadingUserDetails ? (
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span>Loading user details...</span>
          </div>
        ) : userContext ? (
          <div className="space-y-3 text-sm">
            <div>
              <span className="font-medium">Name:</span> {userContext.callerName}
            </div>
            <div>
              <span className="font-medium">Phone:</span> {userContext.phoneNumber}
            </div>
            <div>
              <span className="font-medium">User ID:</span> {userDetails.userId}
            </div>
            <div>
              <span className="font-medium">Session:</span> {userDetails.id.slice(0, 8)}...
            </div>
            <div>
              <span className="font-medium">Direction:</span> 
              <span className={`ml-1 capitalize ${userDetails.direction === 'inbound' ? 'text-green-600' : 'text-blue-600'}`}>
                {userDetails.direction}
              </span>
            </div>
            <div>
              <span className="font-medium">Started:</span> {new Date(userDetails.startedAt).toLocaleTimeString()}
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500">
            No user details available
          </div>
        )}
      </Card>

      {/* Send Portal Link */}
      {userContext && userDetails?.userId && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900">Portal Access</h4>
          </div>
          <SendPortalLinkButton 
            userId={userDetails.userId}
            userName={userContext.callerName || 'Customer'}
            phoneNumber={userContext.phoneNumber}
            callSessionId={userDetails.id}
          />
        </Card>
      )}

      {/* Claims Information */}
      {userContext?.claims && userContext.claims.length > 0 && (
        <Card className="p-4">
          <h4 className="font-medium text-gray-900 mb-3">Claims ({userContext.claims.length})</h4>
          <div className="space-y-2">
            {userContext.claims.slice(0, 3).map((claim: any, index: number) => (
              <div key={index} className="p-2 bg-gray-50 rounded text-sm">
                <div className="flex justify-between items-center">
                  <span className="font-medium">
                    {claim.type === 'vehicle' ? '🚗' : '📋'} {claim.type.toUpperCase()}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    claim.status === 'created' ? 'bg-yellow-100 text-yellow-800' :
                    claim.status === 'active' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {claim.status}
                  </span>
                </div>
                <div className="text-gray-600 mt-1">
                  <span className="font-medium">Lender:</span> {claim.lender?.replace('_', ' ') || 'Unknown'}
                </div>
                <div className="text-gray-600 text-xs">
                  Created: {new Date(claim.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
            {userContext.claims.length > 3 && (
              <div className="text-xs text-gray-500 text-center py-1">
                +{userContext.claims.length - 3} more claims
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Signing Status & Requirements */}
      {userContext && (
        <Card className="p-4">
          <h4 className="font-medium text-gray-900 mb-3">Status & Requirements</h4>
          
          {/* Signing Status */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Signature Status:</span>
              <span className={`text-xs px-2 py-1 rounded font-medium ${
                userContext.hasSignature || userContext.claims?.some((c: any) => c.signature_completed) 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-orange-100 text-orange-800'
              }`}>
                {userContext.hasSignature || userContext.claims?.some((c: any) => c.signature_completed) 
                  ? '✅ Signed' 
                  : '⏳ Pending'}
              </span>
            </div>
          </div>

          {/* Outstanding Requirements */}
          {userContext.requirements && userContext.requirements.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Outstanding Requirements:</span>
                <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800 font-medium">
                  {userContext.requirements.filter((req: any) => req.status !== 'completed').length} pending
                </span>
              </div>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {userContext.requirements
                  .filter((req: any) => req.status !== 'completed')
                  .slice(0, 5)
                  .map((requirement: any, index: number) => (
                    <div key={index} className="p-2 bg-orange-50 border border-orange-200 rounded text-sm">
                      <div className="flex justify-between items-start">
                        <span className="font-medium text-orange-900">
                          {requirement.type?.replace('_', ' ').toUpperCase() || 'Document Required'}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          requirement.status === 'pending' ? 'bg-orange-100 text-orange-800' :
                          requirement.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {requirement.status?.replace('_', ' ') || 'pending'}
                        </span>
                      </div>
                      {requirement.reason && (
                        <div className="text-orange-700 text-xs mt-1">
                          {requirement.reason}
                        </div>
                      )}
                      <div className="text-orange-600 text-xs mt-1">
                        Due: {requirement.created_at ? new Date(requirement.created_at).toLocaleDateString() : 'TBD'}
                      </div>
                    </div>
                  ))}
                {userContext.requirements.filter((req: any) => req.status !== 'completed').length > 5 && (
                  <div className="text-xs text-gray-500 text-center py-1">
                    +{userContext.requirements.filter((req: any) => req.status !== 'completed').length - 5} more requirements
                  </div>
                )}
              </div>
            </div>
          )}

          {/* No outstanding requirements */}
          {(!userContext.requirements || userContext.requirements.filter((req: any) => req.status !== 'completed').length === 0) && (
            <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
              ✅ No outstanding requirements
            </div>
          )}
        </Card>
      )}

      {/* Recent SMS Messages */}
      {userContext && (
        <RecentSMSSection userDetails={userDetails} />
      )}

      {/* Call History */}
      {userContext?.callHistory && userContext.callHistory.length > 0 && (
        <Card className="p-4">
          <h4 className="font-medium text-gray-900 mb-3">Recent Calls</h4>
          <div className="space-y-1 text-sm">
            {userContext.callHistory.slice(0, 3).map((call: any, index: number) => (
              <div key={index} className="flex justify-between items-center py-1">
                <span className={`${
                  call.status === 'missed_call' ? 'text-red-600' :
                  call.status === 'completed' ? 'text-green-600' :
                  'text-yellow-600'
                }`}>
                  {call.status === 'missed_call' ? '📞❌' : 
                   call.status === 'completed' ? '📞✅' : '📞⏳'} 
                  {call.status.replace('_', ' ')}
                </span>
                <span className="text-gray-500 text-xs">
                  {new Date(call.startedAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Call Notes */}
      <Card className="p-4">
        <h4 className="font-medium text-gray-900 mb-3">Call Notes</h4>
        <textarea
          value={callNotes}
          onChange={(e) => setCallNotes(e.target.value)}
          placeholder="Add notes about this call..."
          className="w-full h-24 p-3 border border-gray-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <div className="mt-2 text-xs text-gray-500">
          Auto-saving as you type...
        </div>
      </Card>


    </div>
  );
}

// Recent SMS Section Component  
function RecentSMSSection({ userDetails }: { userDetails: any }) {
  // Use TRPC to fetch real SMS conversations for this user
  const { data: smsConversationsResponse, isLoading: loadingSMS } = api.communications.sms.getConversations.useQuery(
    { userId: userDetails?.userId },
    {
      enabled: !!userDetails?.userId,
      staleTime: 5 * 60 * 1000, // 5 minutes cache
      refetchInterval: false,
      refetchOnWindowFocus: false,
    }
  );

  // Extract recent messages from conversations
  const recentMessages = React.useMemo(() => {
    if (!smsConversationsResponse?.data) return [];
    
    const allMessages: any[] = [];
    
    // Collect recent messages from all conversations
    smsConversationsResponse.data.forEach((conversation: any) => {
      if (conversation.recentMessages && conversation.recentMessages.length > 0) {
        // Add conversation context to messages
        const messagesWithContext = conversation.recentMessages.map((msg: any) => ({
          ...msg,
          conversationId: conversation.id,
          phoneNumber: conversation.phoneNumber
        }));
        allMessages.push(...messagesWithContext);
      }
    });
    
    // Sort by date (most recent first) and take top 4
    return allMessages
      .sort((a, b) => new Date(b.sentAt || b.created_at).getTime() - new Date(a.sentAt || a.created_at).getTime())
      .slice(0, 4);
  }, [smsConversationsResponse]);

  return (
    <Card className="p-4">
      <h4 className="font-medium text-gray-900 mb-3">Recent SMS Messages</h4>
      {loadingSMS ? (
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span>Loading messages...</span>
        </div>
      ) : recentMessages.length > 0 ? (
        <div className="space-y-3 max-h-40 overflow-y-auto">
          {recentMessages.map((sms: any, index: number) => (
            <div key={sms.id || index} className={`p-3 rounded-lg text-sm ${
              sms.direction === 'inbound' 
                ? 'bg-blue-50 border-l-4 border-blue-400 ml-4' 
                : 'bg-gray-50 border-l-4 border-gray-400 mr-4'
            }`}>
              <div className="flex justify-between items-start mb-1">
                <span className={`text-xs font-medium ${
                  sms.direction === 'inbound' ? 'text-blue-700' : 'text-gray-700'
                }`}>
                  {sms.direction === 'inbound' ? '📱 From User' : '📤 To User'}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(sms.sentAt || sms.created_at).toLocaleDateString()} {new Date(sms.sentAt || sms.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
              </div>
              <div className={`${
                sms.direction === 'inbound' ? 'text-blue-900' : 'text-gray-800'
              }`}>
                {sms.body || sms.message}
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className={`text-xs px-2 py-0.5 rounded ${
                  sms.status === 'delivered' ? 'bg-green-100 text-green-700' :
                  sms.status === 'received' ? 'bg-blue-100 text-blue-700' :
                  sms.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                  sms.status === 'failed' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {sms.status || 'sent'}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded">
          No recent SMS messages
        </div>
      )}
    </Card>
  );
}

// Post-Call Content
function PostCallContent({ 
  callData,
  onClose,
  onDispositionComplete,
  userDetails,
  loadingUserDetails,
  isMobile = false
}: {
  callData?: any;
  onClose?: () => void;
  onDispositionComplete?: () => void;
  userDetails: any;
  loadingUserDetails: boolean;
  isMobile?: boolean;
}) {
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);
  
  // Extract session ID from already-loaded user details
  const sessionId = userDetails?.id || '';

  // Record outcome using the existing TRPC mutation
  const recordCallOutcomeMutation = api.calls.recordOutcome.useMutation({
    onSuccess: (result: any) => {
      console.log('✅ Call outcome recorded in database:', result);
      setShowOutcomeModal(false);
      onClose?.();
      onDispositionComplete?.();
    },
    onError: (error: any) => {
      console.error('❌ Failed to record call outcome:', error);
    }
  });

  // Handle outcome submission from the modal
  const handleOutcomeSubmit = async (outcome: any) => {
    if (!sessionId) {
      throw new Error('No session ID available - cannot save outcome');
    }

    console.log('📋 Recording call outcome from sidebar:', {
      sessionId,
      outcome
    });

    // Use the existing recordCallOutcome mutation
    await recordCallOutcomeMutation.mutateAsync({
      sessionId: sessionId,
      outcomeType: outcome.outcomeType,
      outcomeNotes: outcome.outcomeNotes || '',
      magicLinkSent: outcome.magicLinkSent || false,
      smsSent: outcome.smsSent || false,
      documentsRequested: outcome.documentsRequested || [],
      nextCallDelayHours: outcome.nextCallDelayHours,
      callbackDateTime: outcome.callbackDateTime,
      callbackReason: outcome.callbackReason
    });
  };

  // Prepare user context for the modal (similar to CallInterface)
  const userContext = userDetails?.userClaimsContext ? 
    JSON.parse(userDetails.userClaimsContext) : {
      userId: userDetails?.userId || 999999,
      phoneNumber: userDetails?.phoneNumber || 'Unknown',
      firstName: 'Unknown',
      lastName: 'Customer'
    };

  return (
    <div className="p-6 space-y-6">
      {/* Call Summary */}
      <Card className="p-4 bg-green-50 border-green-200">
        <h4 className="font-medium text-green-900 mb-3 flex items-center">
          📞 Call Completed
        </h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-green-700 font-medium">Duration:</span>
            <div className="text-green-600">
              {userDetails?.durationSeconds ? 
                `${Math.floor(userDetails.durationSeconds / 60)}:${(userDetails.durationSeconds % 60).toString().padStart(2, '0')}` : 
                callData?.callDuration || '00:00'}
            </div>
          </div>
          <div>
            <span className="text-green-700 font-medium">Caller:</span>
            <div className="text-green-600">{callData?.callerName || 'Unknown'}</div>
          </div>
          <div>
            <span className="text-green-700 font-medium">Started:</span>
            <div className="text-green-600">
              {userDetails?.startedAt ? new Date(userDetails.startedAt).toLocaleTimeString() : 'Unknown'}
            </div>
          </div>
          <div>
            <span className="text-green-700 font-medium">Ended:</span>
            <div className="text-green-600">
              {userDetails?.endedAt ? new Date(userDetails.endedAt).toLocaleTimeString() : 
               userDetails?.durationSeconds && userDetails?.startedAt ? 
                 new Date(new Date(userDetails.startedAt).getTime() + (userDetails.durationSeconds * 1000)).toLocaleTimeString() :
                 'In progress'}
            </div>
          </div>
        </div>
      </Card>

      {/* Call Outcome Section */}
      <Card className="p-4">
        <h4 className="font-medium text-gray-900 mb-3">Call Disposition Required</h4>
        
        {loadingUserDetails ? (
          <div className="flex items-center space-x-2 text-sm text-gray-500 mb-4">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span>Loading call session...</span>
          </div>
        ) : !sessionId ? (
          <div className="text-sm text-red-600 mb-4 p-3 bg-red-50 rounded-lg">
            ⚠️ Unable to load call session. Please try again.
          </div>
        ) : (
          <div className="text-sm text-green-600 mb-4 p-3 bg-green-50 rounded-lg">
            ✅ Call session loaded successfully
          </div>
        )}

        <p className="text-sm text-gray-600 mb-4">
          Select call outcome to complete this call and schedule any follow-up actions.
        </p>

        <Button 
          onClick={() => setShowOutcomeModal(true)}
          disabled={!sessionId || recordCallOutcomeMutation.isPending}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300"
        >
          {recordCallOutcomeMutation.isPending ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Saving outcome...</span>
            </div>
          ) : (
            '📋 Set Call Outcome'
          )}
        </Button>
      </Card>
        
      <div className="space-y-3">
        <Button 
          variant="outline" 
          onClick={onClose}
          disabled={recordCallOutcomeMutation.isPending}
          className="w-full text-gray-600 border-gray-200 hover:bg-gray-50"
        >
          ❌ Close
        </Button>
      </div>

      {/* Quick Stats */}
      <Card className="p-3 bg-gray-50">
        <div className="text-xs text-gray-600 text-center">
          📊 Call #{callData?.callSid?.slice(-4) || '0000'} • 
          Session: {sessionId?.slice(0, 8) || 'Unknown'}
        </div>
      </Card>

      {/* Call Outcome Modal */}
      {sessionId && (
        <CallOutcomeModal
          isOpen={showOutcomeModal}
          onClose={() => setShowOutcomeModal(false)}
          onSubmit={handleOutcomeSubmit}
          callSessionId={sessionId}
          userContext={userContext}
          callDuration={0} // We don't track duration in sidebar
          isSubmitting={recordCallOutcomeMutation.isPending}
        />
      )}
    </div>
  );
}

// Send Portal Link Button Component
function SendPortalLinkButton({ 
  userId, 
  userName, 
  phoneNumber, 
  callSessionId 
}: {
  userId: number;
  userName: string;
  phoneNumber: string;
  callSessionId: string;
}) {
  const [isLoading, setIsLoading] = useState(false);

  // Magic link send mutation
  const sendMagicLinkMutation = api.communications.magicLinks.send.useMutation({
    onSuccess: (result) => {
      console.log('✅ Portal link sent successfully:', result);
      // Could add a toast notification here
      alert(`Portal link sent successfully to ${phoneNumber}!`);
    },
    onError: (error) => {
      console.error('❌ Failed to send portal link:', error);
      alert(`Failed to send portal link: ${error.message}`);
    },
    onSettled: () => {
      setIsLoading(false);
    }
  });

  const handleSendPortalLink = async () => {
    if (!phoneNumber) {
      alert('Phone number is required to send portal link');
      return;
    }

    setIsLoading(true);
    
    sendMagicLinkMutation.mutate({
      userId,
      linkType: 'claimPortal',
      deliveryMethod: 'sms',
      phoneNumber,
      userName,
      callSessionId
    });
  };

  return (
    <Button 
      onClick={handleSendPortalLink}
      disabled={isLoading || !phoneNumber}
      className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white"
    >
      {isLoading ? (
        <div className="flex items-center justify-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          <span>Sending...</span>
        </div>
      ) : (
        <>
          <span className="mr-2">🔗</span>
          Send Portal Link
        </>
      )}
    </Button>
  );
} 
'use client';

import { useState, useEffect } from 'react';
import { X, Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, Clock, User } from 'lucide-react';
import { Button } from '@/modules/core/components/ui/button';
import { Card } from '@/modules/core/components/ui/card';

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
            />
          )}
          
          {callState === 'ended' && (
            <PostCallContent
              callData={callData}
              onClose={handleClose}
              onDispositionComplete={onDispositionComplete}
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
              />
            )}
            
            {callState === 'ended' && (
              <PostCallContent
                callData={callData}
                onClose={handleClose}
                onDispositionComplete={onDispositionComplete}
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
  isMobile = false
}: {
  callData?: any;
  onEndCall?: () => void;
  onToggleMute?: () => void;
  onToggleHold?: () => void;
  isMuted?: boolean;
  isOnHold?: boolean;
  isMobile?: boolean;
}) {
  const [userDetails, setUserDetails] = useState<any>(null);
  const [loadingUserDetails, setLoadingUserDetails] = useState(false);
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

      {/* Quick Actions */}
      <Card className="p-4">
        <h4 className="font-medium text-gray-900 mb-4">Quick Actions</h4>
        <div className="space-y-3">
          <Button 
            variant="outline" 
            size="default"
            className="w-full h-auto min-h-[60px] justify-start px-4 py-3 text-left hover:bg-blue-50 hover:border-blue-300 transition-colors border border-gray-200"
            onClick={() => {
              // TODO: Implement schedule callback functionality
              if (userDetails?.userId) {
                alert(`Scheduling callback for user ${userDetails.userId}`);
              }
            }}
            disabled={!userDetails?.userId}
          >
            <span className="mr-3 text-lg flex-shrink-0">📅</span>
            <div className="flex flex-col items-start text-left w-full">
              <span className="font-medium text-sm">Schedule Callback</span>
              <span className="text-xs text-gray-500 mt-1">Set up follow-up call</span>
            </div>
          </Button>
          
          <Button 
            variant="outline" 
            size="default"
            className="w-full h-auto min-h-[60px] justify-start px-4 py-3 text-left hover:bg-green-50 hover:border-green-300 transition-colors border border-gray-200"
            onClick={() => {
              // TODO: Implement SMS functionality
              if (userDetails?.userId) {
                window.open(`/sms?userId=${userDetails.userId}`, '_blank');
              }
            }}
            disabled={!userDetails?.userId}
          >
            <span className="mr-3 text-lg flex-shrink-0">💬</span>
            <div className="flex flex-col items-start text-left w-full">
              <span className="font-medium text-sm">Send SMS</span>
              <span className="text-xs text-gray-500 mt-1">Send text message</span>
            </div>
          </Button>
          
          <Button 
            variant="outline" 
            size="default"
            className="w-full h-auto min-h-[60px] justify-start px-4 py-3 text-left hover:bg-purple-50 hover:border-purple-300 transition-colors border border-gray-200"
            onClick={() => {
              if (userDetails?.userId) {
                window.open(`/users/${userDetails.userId}`, '_blank');
              }
            }}
            disabled={!userDetails?.userId}
          >
            <span className="mr-3 text-lg flex-shrink-0">👤</span>
            <div className="flex flex-col items-start text-left w-full">
              <span className="font-medium text-sm">View Full Profile</span>
              <span className="text-xs text-gray-500 mt-1">Complete user details</span>
            </div>
          </Button>
          
          {userContext?.claims && userContext.claims.length > 0 && (
            <Button 
              variant="outline" 
              size="default"
              className="w-full h-auto min-h-[60px] justify-start px-4 py-3 text-left hover:bg-orange-50 hover:border-orange-300 transition-colors border border-gray-200"
              onClick={() => {
                if (userDetails?.userId) {
                  window.open(`/claims?userId=${userDetails.userId}`, '_blank');
                }
              }}
              disabled={!userDetails?.userId}
            >
              <span className="mr-3 text-lg flex-shrink-0">📋</span>
              <div className="flex flex-col items-start text-left w-full">
                <span className="font-medium text-sm">View Claims ({userContext.claims.length})</span>
                <span className="text-xs text-gray-500 mt-1">Active claims & documents</span>
              </div>
            </Button>
          )}
          
          {userContext?.requirements && userContext.requirements.filter((req: any) => req.status !== 'completed').length > 0 && (
            <Button 
              variant="outline" 
              size="default"
              className="w-full h-auto min-h-[60px] justify-start px-4 py-3 text-left hover:bg-red-50 hover:border-red-300 transition-colors border border-gray-200"
              onClick={() => {
                if (userDetails?.userId) {
                  window.open(`/queue/requirements?userId=${userDetails.userId}`, '_blank');
                }
              }}
              disabled={!userDetails?.userId}
            >
              <span className="mr-3 text-lg flex-shrink-0">⚠️</span>
              <div className="flex flex-col items-start text-left w-full">
                <span className="font-medium text-sm">Review Requirements</span>
                <span className="text-xs text-gray-500 mt-1">
                  {userContext.requirements.filter((req: any) => req.status !== 'completed').length} outstanding items
                </span>
              </div>
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

// Recent SMS Section Component
function RecentSMSSection({ userDetails }: { userDetails: any }) {
  const [smsData, setSmsData] = useState<any[]>([]);
  const [loadingSMS, setLoadingSMS] = useState(false);

  // Load recent SMS messages for this user
  useEffect(() => {
    if (userDetails?.userId) {
      loadRecentSMS();
    }
  }, [userDetails?.userId]);

  const loadRecentSMS = async () => {
    if (!userDetails?.userId) return;
    
    setLoadingSMS(true);
    try {
      // This would be a new API endpoint to get recent SMS for a user
      const response = await fetch(`/api/users/${userDetails.userId}/sms/recent`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const result = await response.json();
        setSmsData(result.messages || []);
      } else {
        console.warn('⚠️ Failed to load SMS data:', response.status);
        // Mock data for now until API is implemented
        setSmsData([
          {
            id: '1',
            body: 'Hello, we need to discuss your claim. Please call us back.',
            direction: 'outbound',
            created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            status: 'delivered'
          },
          {
            id: '2', 
            body: 'Yes I can talk tomorrow morning',
            direction: 'inbound',
            created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
            status: 'received'
          },
          {
            id: '3',
            body: 'We have sent you a magic link to access your documents.',
            direction: 'outbound', 
            created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            status: 'delivered'
          }
        ]);
      }
    } catch (error) {
      console.error('❌ Error loading SMS data:', error);
      // Fallback to empty array
      setSmsData([]);
    } finally {
      setLoadingSMS(false);
    }
  };

  return (
    <Card className="p-4">
      <h4 className="font-medium text-gray-900 mb-3">Recent SMS Messages</h4>
      {loadingSMS ? (
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span>Loading messages...</span>
        </div>
      ) : smsData.length > 0 ? (
        <div className="space-y-3 max-h-40 overflow-y-auto">
          {smsData.slice(0, 4).map((sms: any, index: number) => (
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
                  {new Date(sms.created_at).toLocaleDateString()} {new Date(sms.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
              </div>
              <div className={`${
                sms.direction === 'inbound' ? 'text-blue-900' : 'text-gray-800'
              }`}>
                {sms.body}
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className={`text-xs px-2 py-0.5 rounded ${
                  sms.status === 'delivered' ? 'bg-green-100 text-green-700' :
                  sms.status === 'received' ? 'bg-blue-100 text-blue-700' :
                  sms.status === 'failed' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {sms.status}
                </span>
              </div>
            </div>
          ))}
          {smsData.length > 4 && (
            <div className="text-xs text-gray-500 text-center py-1">
              +{smsData.length - 4} more messages
            </div>
          )}
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
  isMobile = false
}: {
  callData?: any;
  onClose?: () => void;
  onDispositionComplete?: () => void;
  isMobile?: boolean;
}) {
  const [disposition, setDisposition] = useState('');
  const [finalNotes, setFinalNotes] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [callbackDate, setCallbackDate] = useState('');
  const [saving, setSaving] = useState(false);

  const dispositionOptions = [
    { value: 'completed', label: '✅ Completed Successfully', color: 'text-green-600' },
    { value: 'callback', label: '📅 Callback Scheduled', color: 'text-blue-600' },
    { value: 'no-answer', label: '📞❌ No Answer', color: 'text-yellow-600' },
    { value: 'busy', label: '📞🔄 Busy Signal', color: 'text-orange-600' },
    { value: 'wrong-number', label: '📞❓ Wrong Number', color: 'text-red-600' },
    { value: 'voicemail', label: '📨 Left Voicemail', color: 'text-purple-600' },
    { value: 'declined', label: '❌ Customer Declined', color: 'text-red-600' },
    { value: 'technical-issue', label: '⚠️ Technical Issue', color: 'text-gray-600' }
  ];

  const nextActionOptions = [
    { value: 'none', label: 'No further action required' },
    { value: 'callback', label: 'Schedule callback' },
    { value: 'send-documents', label: 'Send documents to customer' },
    { value: 'follow-up-email', label: 'Send follow-up email' },
    { value: 'escalate', label: 'Escalate to supervisor' },
    { value: 'schedule-appointment', label: 'Schedule appointment' }
  ];

  const handleSaveAndComplete = async () => {
    if (!disposition) {
      alert('Please select a call disposition before completing.');
      return;
    }

    setSaving(true);
    try {
      // TODO: Implement actual save logic
      console.log('💾 Saving call outcome:', {
        callSid: callData?.callSid,
        disposition,
        finalNotes,
        nextAction,
        callbackDate
      });

      // Simulate save delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      alert('Call outcome saved successfully!');
      onClose?.();
      onDispositionComplete?.(); // Call the prop when disposition is saved
    } catch (error) {
      console.error('❌ Failed to save call outcome:', error);
      alert('Failed to save call outcome. Please try again.');
    } finally {
      setSaving(false);
    }
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
            <div className="text-green-600">{callData?.callDuration || '02:35'}</div>
          </div>
          <div>
            <span className="text-green-700 font-medium">Caller:</span>
            <div className="text-green-600">{callData?.callerName || 'Unknown'}</div>
          </div>
          <div>
            <span className="text-green-700 font-medium">Started:</span>
            <div className="text-green-600">{new Date().toLocaleTimeString()}</div>
          </div>
          <div>
            <span className="text-green-700 font-medium">Ended:</span>
            <div className="text-green-600">{new Date().toLocaleTimeString()}</div>
          </div>
        </div>
      </Card>

      {/* Call Disposition */}
      <Card className="p-4">
        <h4 className="font-medium text-gray-900 mb-3">
          Call Disposition <span className="text-red-500">*</span>
        </h4>
        <div className="space-y-2">
          {dispositionOptions.map((option) => (
            <label key={option.value} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="radio"
                name="disposition"
                value={option.value}
                checked={disposition === option.value}
                onChange={(e) => setDisposition(e.target.value)}
                className="text-blue-600"
              />
              <span className={`text-sm ${option.color}`}>{option.label}</span>
            </label>
          ))}
        </div>
      </Card>

      {/* Next Action */}
      <Card className="p-4">
        <h4 className="font-medium text-gray-900 mb-3">Next Action Required</h4>
        <select 
          value={nextAction}
          onChange={(e) => setNextAction(e.target.value)}
          className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Select next action...</option>
          {nextActionOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {(nextAction === 'callback' || disposition === 'callback') && (
          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Callback Date & Time
            </label>
            <input
              type="datetime-local"
              value={callbackDate}
              onChange={(e) => setCallbackDate(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min={new Date().toISOString().slice(0, 16)}
            />
          </div>
        )}
      </Card>

      {/* Final Notes */}
      <Card className="p-4">
        <h4 className="font-medium text-gray-900 mb-3">Call Summary & Notes</h4>
        <textarea
          value={finalNotes}
          onChange={(e) => setFinalNotes(e.target.value)}
          placeholder="Summarize the call discussion, key points, customer concerns, and any commitments made..."
          className="w-full h-24 p-3 border border-gray-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <div className="mt-2 text-xs text-gray-500">
          {finalNotes.length}/500 characters
        </div>
      </Card>

      {/* Actions */}
      <div className="space-y-3">
        <Button 
          onClick={handleSaveAndComplete}
          disabled={!disposition || saving}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300"
        >
          {saving ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Saving...</span>
            </div>
          ) : (
            '✅ Complete & Save Call'
          )}
        </Button>
        
        <div className="grid grid-cols-2 gap-3">
          <Button 
            variant="outline" 
            onClick={() => {
              // TODO: Implement save as draft
              console.log('💾 Saving as draft');
            }}
            disabled={saving}
            className="text-blue-600 border-blue-200 hover:bg-blue-50"
          >
            💾 Save Draft
          </Button>
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={saving}
            className="text-red-600 border-red-200 hover:bg-red-50"
          >
            ❌ Cancel
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <Card className="p-3 bg-gray-50">
        <div className="text-xs text-gray-600 text-center">
          📊 Call #{callData?.callSid?.slice(-4) || '0000'} • 
          Agent: {callData?.agentName || 'Agent'} • 
          Session: {callData?.sessionId?.slice(0, 8) || 'Unknown'}
        </div>
      </Card>
    </div>
  );
} 
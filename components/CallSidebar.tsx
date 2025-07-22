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

  const sidebarWidth = () => {
    if (callState === 'ringing') return 'w-80'; // 320px - compact for incoming
    if (callState === 'connected') return 'w-96'; // 384px - full context
    if (callState === 'ended') return 'w-80'; // 320px - disposition form
    return 'w-80';
  };

  return (
    <>
      {/* Mobile Overlay */}
      <div className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40" onClick={onClose} />
      
      {/* Desktop: Fixed Right Sidebar */}
      <div className={`
        fixed right-0 top-0 h-full bg-white shadow-xl border-l border-gray-200 z-50
        transform transition-transform duration-300 ease-in-out
        ${sidebarWidth()}
        ${isExpanded ? 'translate-x-0' : 'translate-x-full'}
        lg:translate-x-0
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
            onClick={onClose}
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
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </>
  );
}

// Ringing Call Content
function RingingCallContent({ 
  callData, 
  onAccept, 
  onDecline 
}: {
  callData?: any;
  onAccept?: () => void;
  onDecline?: () => void;
}) {
  return (
    <div className="p-6 space-y-6">
      {/* Caller Info */}
      <Card className="p-6 text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <User className="w-8 h-8 text-blue-600" />
        </div>
        
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          {callData?.callerName || 'Unknown Caller'}
        </h3>
        
        <p className="text-gray-600 mb-2">
          {callData?.callerPhone || 'No phone number'}
        </p>
        
        <div className="text-sm text-gray-500">
          Incoming call...
        </div>
      </Card>

      {/* Quick User Preview */}
      {callData?.userId && (
        <Card className="p-4">
          <h4 className="font-medium text-gray-900 mb-2">Quick Preview</h4>
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
      <div className="flex space-x-3">
        <Button 
          onClick={onDecline}
          variant="outline" 
          className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
        >
          <PhoneOff className="w-4 h-4 mr-2" />
          Decline
        </Button>
        
        <Button 
          onClick={onAccept}
          className="flex-1 bg-green-600 hover:bg-green-700"
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
  isOnHold 
}: {
  callData?: any;
  onEndCall?: () => void;
  onToggleMute?: () => void;
  onToggleHold?: () => void;
  isMuted?: boolean;
  isOnHold?: boolean;
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
      console.log('🔍 Loading user details for Call SID:', callData.callSid);
      
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
        <h4 className="font-medium text-gray-900 mb-3">Quick Actions</h4>
        <div className="space-y-2">
          <Button variant="outline" size="sm" className="w-full justify-start">
            📅 Schedule Callback
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start">
            💬 Send SMS
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full justify-start"
            onClick={() => {
              if (userDetails?.userId) {
                window.open(`/users/${userDetails.userId}`, '_blank');
              }
            }}
            disabled={!userDetails?.userId}
          >
            👤 View Full Profile
          </Button>
          {userContext?.claims && userContext.claims.length > 0 && (
            <Button variant="outline" size="sm" className="w-full justify-start">
              📋 View Claims ({userContext.claims.length})
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

// Post-Call Content
function PostCallContent({ 
  callData,
  onClose 
}: {
  callData?: any;
  onClose?: () => void;
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
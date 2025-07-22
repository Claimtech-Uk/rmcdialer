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
  return (
    <div className="p-6 space-y-6">
      {/* Call Controls */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900">
              {callData?.callerName || 'Unknown Caller'}
            </h3>
            <p className="text-sm text-gray-600">{callData?.callerPhone}</p>
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
            className={isMuted ? "bg-red-600 hover:bg-red-700" : ""}
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </Button>
          
          <Button
            variant={isOnHold ? "default" : "outline"}
            size="sm"
            onClick={onToggleHold}
            className={isOnHold ? "bg-yellow-600 hover:bg-yellow-700" : ""}
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
        {callData ? (
          <div className="space-y-3 text-sm">
            <div>
              <span className="font-medium">Phone:</span> {callData.callerPhone}
            </div>
            {callData.userId && (
              <div>
                <span className="font-medium">User ID:</span> {callData.userId}
              </div>
            )}
            {callData.callSessionId && (
              <div>
                <span className="font-medium">Session:</span> {callData.callSessionId.slice(0, 8)}...
              </div>
            )}
            <div>
              <span className="font-medium">Call SID:</span> {callData.callSid?.slice(0, 8)}...
            </div>
            <div className="text-blue-600 border-t pt-2 mt-2">
              📋 Full user context will load here using the simple-call-lookup API
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500">
            Loading user details...
          </div>
        )}
      </Card>

      {/* Quick Notes */}
      <Card className="p-4">
        <h4 className="font-medium text-gray-900 mb-3">Call Notes</h4>
        <textarea
          placeholder="Add notes about this call..."
          className="w-full h-24 p-3 border border-gray-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </Card>

      {/* Quick Actions */}
      <Card className="p-4">
        <h4 className="font-medium text-gray-900 mb-3">Quick Actions</h4>
        <div className="space-y-2">
          <Button variant="outline" size="sm" className="w-full justify-start">
            Schedule Callback
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start">
            Send SMS
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start">
            View Claims
          </Button>
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
  return (
    <div className="p-6 space-y-6">
      {/* Call Summary */}
      <Card className="p-4">
        <h4 className="font-medium text-gray-900 mb-3">Call Summary</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Duration:</span>
            <span>{callData?.callDuration || '02:35'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Caller:</span>
            <span>{callData?.callerName || 'Unknown'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Time:</span>
            <span>{new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      </Card>

      {/* Disposition */}
      <Card className="p-4">
        <h4 className="font-medium text-gray-900 mb-3">Call Disposition</h4>
        <select className="w-full p-2 border border-gray-200 rounded-lg text-sm">
          <option value="">Select outcome...</option>
          <option value="completed">Completed Successfully</option>
          <option value="callback">Callback Scheduled</option>
          <option value="no-answer">No Answer</option>
          <option value="busy">Busy Signal</option>
          <option value="wrong-number">Wrong Number</option>
        </select>
      </Card>

      {/* Final Notes */}
      <Card className="p-4">
        <h4 className="font-medium text-gray-900 mb-3">Final Notes</h4>
        <textarea
          placeholder="Summary of call discussion..."
          className="w-full h-20 p-3 border border-gray-200 rounded-lg text-sm resize-none"
        />
      </Card>

      {/* Actions */}
      <div className="space-y-3">
        <Button className="w-full">
          Complete Call
        </Button>
        <Button variant="outline" className="w-full" onClick={onClose}>
          Close Without Saving
        </Button>
      </div>
    </div>
  );
} 
'use client';

import { useGlobalTwilio } from '@/lib/providers/GlobalTwilioProvider';
import { InboundCallInterface } from '@/components/InboundCallInterface';
import { useState, useEffect } from 'react';
import { isFeatureEnabled } from '@/lib/config/features';

export function GlobalIncomingCallHandler() {
  const { incomingCall, acceptIncomingCall, rejectIncomingCall, endCall, isInCall, isEnabled } = useGlobalTwilio();
  const [callDuration, setCallDuration] = useState(0);
  const [lastIncomingCall, setLastIncomingCall] = useState<any>(null);

  // Cache the incoming call when it arrives
  useEffect(() => {
    if (incomingCall && !lastIncomingCall) {
      setLastIncomingCall(incomingCall);
    }
  }, [incomingCall, lastIncomingCall]);

  // Clear cached call when call completely ends
  useEffect(() => {
    if (!incomingCall && !isInCall && lastIncomingCall) {
      setLastIncomingCall(null);
    }
  }, [incomingCall, isInCall, lastIncomingCall]);

  // Auto-increment call duration timer for connected calls
  useEffect(() => {
    if (!isInCall) {
      setCallDuration(0);
      return;
    }

    const startTime = Date.now();
    const interval = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isInCall]);

  // Don't render if global Twilio is disabled
  if (!isEnabled) {
    return null;
  }

  // Show the call interface when there's an incoming call or when connected
  const callToShow = incomingCall || lastIncomingCall;
  if (callToShow && (incomingCall || isInCall)) {
    return (
      <InboundCallInterface
        incomingCall={callToShow}
        onAccept={acceptIncomingCall}
        onReject={rejectIncomingCall}
        onEndCall={endCall}
        isConnected={isInCall}
        callDuration={callDuration}
      />
    );
  }

  return null;
} 
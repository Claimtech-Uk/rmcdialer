'use client';

import { useContext, useEffect, useState } from 'react';
import { CallSidebar } from './CallSidebar';
import { GlobalTwilioContext } from '@/lib/providers/GlobalTwilioProvider';

interface LayoutManagerProps {
  children: React.ReactNode;
}

export function LayoutManager({ children }: LayoutManagerProps) {
  const [callState, setCallState] = useState<'idle' | 'ringing' | 'connected' | 'ended'>('idle');
  const [callData, setCallData] = useState<any>(null);
  const [callDuration, setCallDuration] = useState<string>('00:00');

  // Get Twilio context
  const twilioContext = useContext(GlobalTwilioContext);

  // Derive call state from GlobalTwilioProvider
  useEffect(() => {
    if (!twilioContext) return;

    // Determine call state based on Twilio context
    if (twilioContext.incomingCall) {
      setCallState('ringing');
      setCallData({
        callerName: twilioContext.incomingCall.callerName || 'Unknown Caller',
        callerPhone: twilioContext.incomingCall.from,
        userId: twilioContext.incomingCall.userId,
        callSessionId: twilioContext.incomingCall.callSessionId,
        callSid: twilioContext.incomingCall.callSid
      });
    } else if (twilioContext.isInCall && twilioContext.currentCallSid) {
      setCallState('connected');
      // Keep existing callData but add current call info
      setCallData((prev: any) => ({
        ...prev,
        callSid: twilioContext.currentCallSid,
        callDuration: callDuration
      }));
    } else {
      // Only set to idle if we're not in post-call mode
      if (callState !== 'ended') {
        setCallState('idle');
        setCallData(null);
      }
    }
  }, [twilioContext?.incomingCall, twilioContext?.isInCall, twilioContext?.currentCallSid, callDuration]);

  // Call duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (callState === 'connected') {
      const startTime = Date.now();
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        setCallDuration(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }, 1000);
    } else {
      setCallDuration('00:00');
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callState]);

  // Adjust main content padding when call sidebar is active
  useEffect(() => {
    const mainContainer = document.getElementById('main-content-container');
    if (!mainContainer) return;

    if (callState !== 'idle') {
      // Add right padding to account for call sidebar
      const sidebarWidth = callState === 'connected' ? '24rem' : '20rem'; // 384px or 320px
      mainContainer.style.paddingRight = sidebarWidth;
      mainContainer.style.transition = 'padding-right 300ms ease-in-out';
    } else {
      // Remove right padding when no call
      mainContainer.style.paddingRight = '0';
    }

    // Cleanup
    return () => {
      if (mainContainer) {
        mainContainer.style.paddingRight = '0';
      }
    };
  }, [callState]);

  const handleAcceptCall = () => {
    if (twilioContext?.acceptIncomingCall) {
      console.log('✅ Accepting call via GlobalTwilioProvider');
      twilioContext.acceptIncomingCall();
    }
  };

  const handleDeclineCall = () => {
    if (twilioContext?.rejectIncomingCall) {
      console.log('❌ Declining call via GlobalTwilioProvider');
      twilioContext.rejectIncomingCall();
    }
  };

  const handleEndCall = () => {
    if (twilioContext?.endCall) {
      console.log('📞 Ending call via GlobalTwilioProvider');
      twilioContext.endCall();
      // Set to post-call state
      setCallState('ended');
    }
  };

  const handleToggleMute = () => {
    // TODO: Implement mute/unmute via TwilioVoiceService
    console.log('🔇 Toggle mute (to be implemented)');
  };

  const handleToggleHold = () => {
    // TODO: Implement hold/unhold via TwilioVoiceService  
    console.log('⏸️ Toggle hold (to be implemented)');
  };

  const handleCloseCallSidebar = () => {
    setCallState('idle');
    setCallData(null);
  };

  return (
    <>
      {children}
      
      {/* Call Sidebar - overlays everything */}
      <CallSidebar
        callState={callState}
        callData={callData}
        onAcceptCall={handleAcceptCall}
        onDeclineCall={handleDeclineCall}
        onEndCall={handleEndCall}
        onClose={handleCloseCallSidebar}
        onToggleMute={handleToggleMute}
        onToggleHold={handleToggleHold}
        isMuted={false}
        isOnHold={false}
      />
    </>
  );
} 
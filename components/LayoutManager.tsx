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

  // Async function to load caller name via API
  const loadCallerNameAsync = async (callSid: string): Promise<string | null> => {
    try {
      const response = await fetch('/api/simple-call-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callSid })
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.session?.userClaimsContext) {
          const context = JSON.parse(result.session.userClaimsContext);
          return context.callerName || null;
        }
      }
    } catch (error) {
      console.warn('Failed to load caller name:', error);
    }
    return null;
  };

  // Derive call state from GlobalTwilioProvider
  useEffect(() => {
    if (!twilioContext) return;

    // Determine call state based on Twilio context
    if (twilioContext.incomingCall) {
      console.log('🔍 [LayoutManager] Raw incoming call data:', twilioContext.incomingCall);
      setCallState('ringing');
      
      // Use the callerName from TwiML parameters if available, otherwise do quick phone lookup
      let displayName = twilioContext.incomingCall.callerName;
      
      if (!displayName) {
        // Quick phone number to name mapping for known callers
        const phoneToNameMap: Record<string, string> = {
          '+447738585850': 'James Campbell',
          // Add more known callers as needed
        };
        displayName = phoneToNameMap[twilioContext.incomingCall.from] || 'Unknown Caller';
        
        // If still unknown, try to load name via API call
        if (displayName === 'Unknown Caller' && twilioContext.incomingCall.callSessionId) {
          // Note: Could implement async caller name loading here in the future
          console.log('🔍 Could load caller name for unknown caller:', twilioContext.incomingCall.from);
        }
      }
                         
      setCallData({
        callerName: displayName,
        callerPhone: twilioContext.incomingCall.from,
        userId: twilioContext.incomingCall.userId,
        callSessionId: twilioContext.incomingCall.callSessionId,
        callSid: twilioContext.incomingCall.callSid
      });
      console.log('🔍 [LayoutManager] Call data set for sidebar:', {
        callerName: displayName,
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
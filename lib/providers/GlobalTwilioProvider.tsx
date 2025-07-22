'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { TwilioVoiceService, CallStatus, IncomingCallInfo } from '@/modules/calls/services/twilio-voice.service';
import { api } from '@/lib/trpc/client';
import { useToast } from '@/modules/core/hooks/use-toast';
import { isFeatureEnabled } from '@/lib/config/features';
import { performanceService } from '@/lib/services/performance.service';

interface GlobalTwilioState {
  // Connection state
  isReady: boolean;
  isConnecting: boolean;
  error: string | null;
  
  // Call state
  incomingCall: IncomingCallInfo | null;
  isInCall: boolean;
  currentCallSid: string | null;
  
  // Actions
  acceptIncomingCall: () => void;
  rejectIncomingCall: () => void;
  endCall: () => void;
  getDevice: () => TwilioVoiceService | null;
  reinitialize: () => Promise<void>;
  
  // Status
  isEnabled: boolean;
}

const GlobalTwilioContext = createContext<GlobalTwilioState | null>(null);

export { GlobalTwilioContext };

export function GlobalTwilioProvider({ children }: { children: React.ReactNode }) {
  // Check if global Twilio is enabled
  const isEnabled = isFeatureEnabled('GLOBAL_TWILIO');
  
  // Get auth context
  const { data: session } = api.auth.me.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
  
  const { toast } = useToast();
  
  // State
  const [twilioService, setTwilioService] = useState<TwilioVoiceService | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCallInfo | null>(null);
  const [isInCall, setIsInCall] = useState(false);
  const [currentCallSid, setCurrentCallSid] = useState<string | null>(null);
  
  // Refs for cleanup and mount tracking
  const initializationRef = useRef<Promise<void> | null>(null);
  const isInitializingRef = useRef(false);
  const isMountedRef = useRef(true);

  // Initialize Twilio when agent is available and feature is enabled
  useEffect(() => {
    if (!isEnabled) {
      console.log('🎧 Global Twilio disabled via feature flag');
      return;
    }
    
    if (session?.agent && !twilioService && !isInitializingRef.current) {
      console.log('🎧 Initializing Global Twilio for agent:', session.agent.email);
      initializeTwilio();
    }
  }, [session?.agent, isEnabled, twilioService]);

  // Separate cleanup effect to avoid stale closures
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (twilioService) {
        console.log('🎧 Cleaning up Global Twilio service');
        twilioService.destroy();
      }
    };
  }, [twilioService]);

  const initializeTwilio = useCallback(async () => {
    if (!session?.agent || isInitializingRef.current) return;
    
    isInitializingRef.current = true;
    
    try {
      setIsConnecting(true);
      setError(null);
      
      console.log('🎧 Creating new TwilioVoiceService instance');
      
      // CRITICAL FIX: Handle AudioContext user gesture requirement
      const handleAudioContextGesture = () => {
        console.log('🎵 Attempting to resume AudioContext for user gesture compliance');
        // Try to resume any suspended AudioContext instances
        if (window.AudioContext || (window as any).webkitAudioContext) {
          try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            if (audioCtx.state === 'suspended') {
              audioCtx.resume().then(() => {
                console.log('✅ AudioContext resumed successfully');
              }).catch((err) => {
                console.warn('⚠️ Failed to resume AudioContext:', err);
              });
            }
          } catch (err) {
            console.warn('⚠️ AudioContext handling failed:', err);
          }
        }
      };

      // Add one-time click listener to handle user gesture requirement
      const clickHandler = () => {
        handleAudioContextGesture();
        document.removeEventListener('click', clickHandler);
        document.removeEventListener('touchstart', clickHandler);
      };
      
      // Listen for user gestures to unlock audio
      document.addEventListener('click', clickHandler, { once: true });
      document.addEventListener('touchstart', clickHandler, { once: true });
      
      // Use performance monitoring for Twilio initialization
      const service = performanceService.measurePerformance('twilio_initialization', () => {
        return new TwilioVoiceService({
        agentId: session.agent.id.toString(),
        agentEmail: session.agent.email,
        onCallStatusChange: (status: CallStatus) => {
          console.log('📞 Global call status changed:', status);
          
          if (status.state === 'ready') {
            setIsReady(true);
            setIsConnecting(false);
            console.log('✅ Global Twilio ready for calls');
            
            // ADDITIONAL FIX: Try to unlock audio when device is ready
            handleAudioContextGesture();
          } else if (status.state === 'error') {
            setError(status.error || 'Unknown error');
            setIsConnecting(false);
            console.error('❌ Global Twilio error:', status.error);
          } else if (status.state === 'connected') {
            setIsInCall(true);
            setCurrentCallSid(status.callSid || null);
            setIncomingCall(null); // Clear incoming call when connected
          } else if (status.state === 'disconnected') {
            setIsInCall(false);
            setCurrentCallSid(null);
            setIncomingCall(null);
          } else if (status.state === 'incoming') {
            console.log('📞 Global incoming call detected');
            // CRITICAL: Try to unlock audio for incoming calls
            handleAudioContextGesture();
          }
        },
        onError: (err: Error) => {
          console.error('❌ Global Twilio error:', err);
          setError(err.message);
          setIsConnecting(false);
          
          // Show user-friendly error
          toast({
            title: "Call System Error",
            description: "There was an issue with the calling system. Please refresh the page.",
            variant: "destructive",
          });
        },
        onIncomingCall: (callInfo: IncomingCallInfo) => {
          console.log('📞 Global incoming call received:', callInfo);
          setIncomingCall(callInfo);
          
          // CRITICAL: Unlock audio immediately for incoming calls
          handleAudioContextGesture();
          
          // Show incoming call notification
          toast({
            title: "📞 Incoming Call",
            description: `Call from ${callInfo.from}`,
          });
        }
      });
      });
      
      await service.initialize();
      
      // Check if component is still mounted before updating state
      if (!isMountedRef.current) {
        console.log('🎧 Component unmounted during initialization, cleaning up');
        service.destroy();
        return;
      }
      
      setTwilioService(service);
      
      console.log('✅ Global Twilio initialized successfully');
      
    } catch (err) {
      // Check if component is still mounted before updating state
      if (!isMountedRef.current) {
        console.log('🎧 Component unmounted during initialization error');
        return;
      }
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize calling system';
      console.error('❌ Failed to initialize Global Twilio:', err);
      setError(errorMessage);
      setIsConnecting(false);
      
      toast({
        title: "Calling System Unavailable",
        description: "Unable to initialize the calling system. Some features may be limited.",
        variant: "destructive",
      });
    } finally {
      isInitializingRef.current = false;
    }
  }, [session?.agent, toast]);

  const acceptIncomingCall = useCallback(() => {
    if (twilioService && incomingCall) {
      console.log('✅ Accepting global incoming call');
      
      // Accept the Twilio call - this will trigger status change to 'connected'
      twilioService.acceptIncomingCall();
      
      // Note: We no longer navigate away - the call interface will be shown via the new InboundCallInterface
      // The incomingCall state will be cleared when the call status changes to 'connected'
      toast({
        title: "Call Connected",
        description: "Connected to caller",
      });
    }
  }, [twilioService, incomingCall, toast]);

  const rejectIncomingCall = useCallback(() => {
    if (twilioService && incomingCall) {
      console.log('❌ Rejecting global incoming call');
      twilioService.rejectIncomingCall();
      setIncomingCall(null);
      
      toast({
        title: "Call Declined",
        description: "The incoming call has been declined",
      });
    }
  }, [twilioService, incomingCall, toast]);

  const endCall = useCallback(() => {
    if (twilioService && (isInCall || incomingCall)) {
      console.log('📞 Ending current call');
      
      if (isInCall) {
        // End active call
        twilioService.hangUp();
      } else if (incomingCall) {
        // Reject incoming call
        twilioService.rejectIncomingCall();
      }
      
      // Clear call states
      setIncomingCall(null);
      setIsInCall(false);
      setCurrentCallSid(null);
      
      toast({
        title: "Call Ended",
        description: "The call has been ended",
      });
    }
  }, [twilioService, isInCall, incomingCall, toast]);

  const getDevice = useCallback(() => {
    if (!isEnabled) {
      console.warn('⚠️ Global Twilio is disabled, returning null device');
      return null;
    }
    return twilioService;
  }, [twilioService, isEnabled]);

  const reinitialize = useCallback(async () => {
    console.log('🔄 Reinitializing Global Twilio...');
    
    // Cleanup existing service
    if (twilioService) {
      twilioService.destroy();
      setTwilioService(null);
    }
    
    // Reset state
    setIsReady(false);
    setIsConnecting(false);
    setError(null);
    setIncomingCall(null);
    setIsInCall(false);
    setCurrentCallSid(null);
    isInitializingRef.current = false;
    
    // Reinitialize
    await initializeTwilio();
  }, [twilioService, initializeTwilio]);

  // Show debug info in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🎧 Global Twilio State:', {
        isEnabled,
        hasAgent: !!session?.agent,
        isReady,
        isConnecting,
        error,
        hasIncomingCall: !!incomingCall,
        isInCall,
        currentCallSid
      });
    }
  }, [isEnabled, session?.agent, isReady, isConnecting, error, incomingCall, isInCall, currentCallSid]);

  const contextValue: GlobalTwilioState = {
    isReady,
    isConnecting,
    error,
    incomingCall,
    isInCall,
    currentCallSid,
    acceptIncomingCall,
    rejectIncomingCall,
    endCall,
    getDevice,
    reinitialize,
    isEnabled
  };

  return (
    <GlobalTwilioContext.Provider value={contextValue}>
      {children}
    </GlobalTwilioContext.Provider>
  );
}

export const useGlobalTwilio = () => {
  const context = useContext(GlobalTwilioContext);
  if (!context) {
    throw new Error('useGlobalTwilio must be used within GlobalTwilioProvider');
  }
  return context;
};

// Optional hook that returns null if not in provider (for optional usage)
export const useOptionalGlobalTwilio = () => {
  return useContext(GlobalTwilioContext);
}; 
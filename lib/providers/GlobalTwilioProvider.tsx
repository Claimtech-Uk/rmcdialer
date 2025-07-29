'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { TwilioVoiceService, CallStatus, IncomingCallInfo } from '@/modules/calls/services/twilio-voice.service';
import { api } from '@/lib/trpc/client';
import { useToast } from '@/modules/core/hooks/use-toast';
import { isFeatureEnabled } from '@/lib/config/features';
import { performanceService } from '@/lib/services/performance.service';
import { AudioPermissionModal, AudioPermissionStatus } from '@/components/AudioPermissionModal';

interface GlobalTwilioState {
  // Connection state
  isReady: boolean;
  isConnecting: boolean;
  error: string | null;
  
  // Audio permission state
  audioPermissionStatus: AudioPermissionStatus;
  showAudioPermissionModal: boolean;
  
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
  requestAudioPermission: () => void;
  
  // Debug/Testing
  simulateIncomingCall: (mockCallData?: Partial<IncomingCallInfo>) => void;
  
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
  
  // Audio permission state
  const [audioPermissionStatus, setAudioPermissionStatus] = useState<AudioPermissionStatus>({
    status: 'unknown',
    hasAudio: false,
  });
  const [showAudioPermissionModal, setShowAudioPermissionModal] = useState(false);
  
  // Debug logging for modal state changes
  useEffect(() => {
    console.log('🎤 showAudioPermissionModal changed to:', showAudioPermissionModal);
  }, [showAudioPermissionModal]);
  const [needsPermissionCheck, setNeedsPermissionCheck] = useState(true);
  
  // Refs for cleanup and mount tracking
  const initializationRef = useRef<Promise<void> | null>(null);
  const isInitializingRef = useRef(false);
  const isMountedRef = useRef(true);

  // Check audio permissions on mount
  useEffect(() => {
    if (isEnabled && needsPermissionCheck) {
      checkAudioPermissions();
      setNeedsPermissionCheck(false);
    }
  }, [isEnabled, needsPermissionCheck]);

  // Initialize Twilio when agent is available, feature is enabled, and audio is granted
  useEffect(() => {
    if (!isEnabled) {
      console.log('🎧 Global Twilio disabled via feature flag');
      return;
    }
    
    if (session?.agent && !twilioService && !isInitializingRef.current && audioPermissionStatus.hasAudio) {
      console.log('🎧 Initializing Global Twilio for agent:', session.agent.email);
      initializeTwilio();
    } else if (session?.agent && !audioPermissionStatus.hasAudio && audioPermissionStatus.status !== 'unknown') {
      console.log('🎤 Audio permission required before Twilio initialization');
      console.log('🎤 Setting showAudioPermissionModal to true');
      setShowAudioPermissionModal(true);
    }
  }, [session?.agent, isEnabled, twilioService, audioPermissionStatus]);

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

  const checkAudioPermissions = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setAudioPermissionStatus({
          status: 'denied',
          hasAudio: false,
          error: 'Media devices not supported by this browser',
        });
        return;
      }

      // Try to check permission status via Permissions API (if available)
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          console.log('🎤 Initial microphone permission status:', permission.state);
          
          if (permission.state === 'granted') {
            // Verify we can actually access audio
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              stream.getTracks().forEach(track => track.stop());
              
              setAudioPermissionStatus({
                status: 'granted',
                hasAudio: true,
              });
              console.log('✅ Audio permission verified');
            } catch (err) {
              console.warn('⚠️ Permission granted but audio access failed:', err);
              setAudioPermissionStatus({
                status: 'denied',
                hasAudio: false,
                error: 'Audio access failed despite permission',
              });
            }
          } else {
            setAudioPermissionStatus({
              status: permission.state as any,
              hasAudio: false,
            });
          }
        } catch (err) {
          console.warn('⚠️ Permissions API not available, showing permission modal');
          setAudioPermissionStatus({
            status: 'prompt',
            hasAudio: false,
          });
          setShowAudioPermissionModal(true);
        }
      } else {
        // No Permissions API - show modal to request permission
        setAudioPermissionStatus({
          status: 'prompt',
          hasAudio: false,
        });
        setShowAudioPermissionModal(true);
      }
    } catch (error) {
      console.error('❌ Error checking audio permissions:', error);
      setAudioPermissionStatus({
        status: 'denied',
        hasAudio: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const requestAudioPermission = () => {
    console.log('🎤 Showing audio permission modal');
    setShowAudioPermissionModal(true);
  };

  const handleAudioPermissionGranted = () => {
    console.log('✅ Audio permission granted!');
    setAudioPermissionStatus({
      status: 'granted',
      hasAudio: true,
    });
    setShowAudioPermissionModal(false);
    
    // Initialize Twilio now that we have audio permission
    if (session?.agent && !twilioService && !isInitializingRef.current) {
      console.log('🎧 Audio granted - initializing Twilio');
      initializeTwilio();
    }
  };

  const handleAudioPermissionDenied = () => {
    console.warn('❌ Audio permission denied');
    setAudioPermissionStatus({
      status: 'denied',
      hasAudio: false,
      error: 'User denied microphone permission',
    });
    
    // Keep modal open with instructions
    // setShowAudioPermissionModal(false);
    
    toast({
      title: "Audio Permission Required",
      description: "Microphone access is required for call functionality. Please enable it in your browser settings.",
      variant: "destructive",
    });
  };

  const initializeTwilio = useCallback(async () => {
    if (!session?.agent || isInitializingRef.current || !audioPermissionStatus.hasAudio) {
      console.log('🎧 Skipping Twilio initialization - missing requirements:', {
        hasAgent: !!session?.agent,
        isInitializing: isInitializingRef.current,
        hasAudio: audioPermissionStatus.hasAudio,
      });
      return;
    }
    
    isInitializingRef.current = true;
    
    try {
      setIsConnecting(true);
      setError(null);
      
      console.log('🎧 Creating new TwilioVoiceService instance with audio permissions');
      
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
      
      console.log('✅ Global Twilio initialized successfully with audio permissions');
      
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
      
      // If error is audio-related, show permission modal again
      if (errorMessage.toLowerCase().includes('audio') || errorMessage.toLowerCase().includes('microphone')) {
        console.log('🎤 Audio-related error detected, requesting permission again');
        setShowAudioPermissionModal(true);
        setAudioPermissionStatus({
          status: 'denied',
          hasAudio: false,
          error: 'Audio setup failed during Twilio initialization',
        });
      }
      
      toast({
        title: "Calling System Unavailable",
        description: "Unable to initialize the calling system. Please check audio permissions.",
        variant: "destructive",
      });
    } finally {
      isInitializingRef.current = false;
    }
  }, [session?.agent, audioPermissionStatus.hasAudio, toast]);

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
    if (!audioPermissionStatus.hasAudio) {
      console.warn('⚠️ Audio permission not granted, returning null device');
      return null;
    }
    return twilioService;
  }, [twilioService, isEnabled, audioPermissionStatus.hasAudio]);

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
    
    // Check audio permissions again
    await checkAudioPermissions();
    
    // Reinitialize if we have permissions
    if (audioPermissionStatus.hasAudio) {
      await initializeTwilio();
    } else {
      setShowAudioPermissionModal(true);
    }
  }, [twilioService, initializeTwilio, audioPermissionStatus.hasAudio]);

  const simulateIncomingCall = useCallback((mockCallData?: Partial<IncomingCallInfo>) => {
    if (!isEnabled) {
      console.warn('⚠️ Cannot simulate call - Global Twilio is disabled');
      return;
    }
    
    if (!audioPermissionStatus.hasAudio) {
      console.warn('⚠️ Cannot simulate call - Audio permission not granted');
      setShowAudioPermissionModal(true);
      return;
    }

    console.log('🧪 Simulating incoming call for debug purposes');
    
    // Create mock incoming call with defaults
    const mockCall: IncomingCallInfo = {
      callSid: 'CA_mock_call_sid_12345',
      from: '+447738585850',
      to: '+447488879172',
      callerName: 'Test Caller',
      userId: '2064',
      callSessionId: 'aec62188-825d-4bc4-b1f8-99f8ebca97b4',
      accept: () => {
        console.log('🎭 Mock call accepted');
        setIncomingCall(null);
        setIsInCall(true);
        setCurrentCallSid('CA_mock_connected_12345');
      },
      reject: () => {
        console.log('🎭 Mock call rejected');
        setIncomingCall(null);
      },
      // Override with any provided mock data
      ...mockCallData
    };

    // Set the incoming call state
    setIncomingCall(mockCall);
    
    // Show notification like real incoming call
    toast({
      title: "📞 Simulated Incoming Call",
      description: `Test call from ${mockCall.callerName || mockCall.from}`,
    });
    
    console.log('✅ Mock incoming call set:', mockCall);
  }, [isEnabled, audioPermissionStatus.hasAudio, toast]);

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
        currentCallSid,
        audioPermissionStatus,
        showAudioPermissionModal,
      });
    }
  }, [isEnabled, session?.agent, isReady, isConnecting, error, incomingCall, isInCall, currentCallSid, audioPermissionStatus, showAudioPermissionModal]);

  const contextValue: GlobalTwilioState = {
    isReady,
    isConnecting,
    error,
    audioPermissionStatus,
    showAudioPermissionModal,
    incomingCall,
    isInCall,
    currentCallSid,
    acceptIncomingCall,
    rejectIncomingCall,
    endCall,
    getDevice,
    reinitialize,
    requestAudioPermission,
    simulateIncomingCall,
    isEnabled
  };

  return (
    <GlobalTwilioContext.Provider value={contextValue}>
      {children}
      
      {/* Audio Permission Modal */}
      <AudioPermissionModal
        isOpen={showAudioPermissionModal}
        onPermissionGranted={handleAudioPermissionGranted}
        onPermissionDenied={handleAudioPermissionDenied}
        onClose={() => setShowAudioPermissionModal(false)}
      />
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
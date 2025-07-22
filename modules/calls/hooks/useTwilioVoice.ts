'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { TwilioVoiceService, CallStatus, OutgoingCallParams, IncomingCallInfo } from '../services/twilio-voice.service';

export interface UseTwilioVoiceOptions {
  agentId: string | number;
  agentEmail: string;
  autoConnect?: boolean;
  onIncomingCall?: (callInfo: IncomingCallInfo) => void;
}

export interface UseTwilioVoiceReturn {
  // State
  isReady: boolean;
  isConnecting: boolean;
  isInCall: boolean;
  isIncomingCall: boolean;
  callStatus: CallStatus | null;
  error: string | null;
  
  // Actions
  initialize: () => Promise<void>;
  makeCall: (params: OutgoingCallParams) => Promise<void>;
  hangUp: () => void;
  toggleMute: () => void;
  sendDigits: (digits: string) => void;
  acceptIncomingCall: () => void;
  rejectIncomingCall: () => void;
  
  // Call info
  callDuration: number;
  isMuted: boolean;
  incomingCallInfo: IncomingCallInfo | null;
}

export function useTwilioVoice(options: UseTwilioVoiceOptions): UseTwilioVoiceReturn {
  const { agentId, agentEmail, autoConnect = true, onIncomingCall } = options;
  
  // State
  const [isReady, setIsReady] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [callStatus, setCallStatus] = useState<CallStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [incomingCallInfo, setIncomingCallInfo] = useState<IncomingCallInfo | null>(null);

  // Refs
  const twilioServiceRef = useRef<TwilioVoiceService | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Computed state
  const isInCall = callStatus?.state === 'connected';
  const isIncomingCall = callStatus?.state === 'incoming';

  // Initialize Twilio Voice SDK
  const initialize = useCallback(async () => {
    // PERFORMANCE: Prevent multiple simultaneous initialization attempts
    if (twilioServiceRef.current?.isReady()) {
      console.log('🎧 Twilio Voice already initialized');
      return;
    }
    
    // PERFORMANCE: Prevent re-initialization if already connecting
    if (isConnecting) {
      console.log('🎧 Twilio Voice already connecting, skipping...');
      return;
    }
    
    try {
      setIsConnecting(true);
      setError(null);
      
      // Create new service instance
      const service = new TwilioVoiceService({
        agentId,
        agentEmail,
        onCallStatusChange: (status) => {
          console.log('📞 Call status changed:', status);
          setCallStatus(status);
          
          if (status.state === 'ready') {
            setIsReady(true);
            setIsConnecting(false);
          } else if (status.state === 'error') {
            setError(status.error || 'Unknown error');
            setIsConnecting(false);
            
            // PERFORMANCE: Don't retry if credentials are missing
            if (status.error?.includes('Development Mode') || status.error?.includes('credentials')) {
              console.log('🔧 Twilio credentials missing - stopping auto-retry to prevent audio file spam');
              return;
            }
          } else if (status.state === 'connected') {
            // Start duration timer
            startDurationTimer();
          } else if (status.state === 'disconnected') {
            // Stop duration timer and reset states
            stopDurationTimer();
            setCallDuration(0);
            setIsMuted(false);
            setIncomingCallInfo(null);
          } else if (status.state === 'incoming') {
            // Don't start timer for incoming calls until accepted
            console.log('📞 Incoming call detected');
          }
        },
        onError: (err) => {
          console.error('❌ Twilio Voice error:', err);
          setError(err.message);
          setIsConnecting(false);
        },
        onIncomingCall: (callInfo) => {
          console.log('📞 Incoming call info received:', callInfo);
          setIncomingCallInfo(callInfo);
          onIncomingCall?.(callInfo);
        }
      });
      
      await service.initialize();
      twilioServiceRef.current = service;
      
    } catch (err) {
      console.error('❌ Failed to initialize Twilio Voice:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize';
      setError(errorMessage);
      setIsConnecting(false);
      
      // PERFORMANCE: Don't retry if it's a credential issue
      if (errorMessage.includes('access token') || errorMessage.includes('credentials') || errorMessage.includes('401')) {
        console.log('🔧 Stopping Twilio initialization due to credential issues - prevents audio file spam');
      }
    }
  }, [agentId, agentEmail, onIncomingCall, isConnecting]);
  
  // Make a call
  const makeCall = useCallback(async (params: OutgoingCallParams) => {
    if (!twilioServiceRef.current?.isReady()) {
      throw new Error('Twilio Voice not initialized');
    }
    
    try {
      setError(null);
      await twilioServiceRef.current.makeCall(params);
    } catch (err) {
      console.error('❌ Failed to make call:', err);
      setError(err instanceof Error ? err.message : 'Failed to make call');
      throw err;
    }
  }, []);
  
  // Hang up the call
  const hangUp = useCallback(() => {
    if (!twilioServiceRef.current) {
      console.warn('No Twilio Voice service to hang up');
      return;
    }
    
    twilioServiceRef.current.hangUp();
  }, []);
  
  // Accept incoming call
  const acceptIncomingCall = useCallback(() => {
    if (!twilioServiceRef.current) {
      console.warn('No Twilio Voice service to accept call');
      return;
    }
    
    console.log('✅ Accepting incoming call via hook');
    twilioServiceRef.current.acceptIncomingCall();
  }, []);
  
  // Reject incoming call
  const rejectIncomingCall = useCallback(() => {
    if (!twilioServiceRef.current) {
      console.warn('No Twilio Voice service to reject call');
      return;
    }
    
    console.log('❌ Rejecting incoming call via hook');
    twilioServiceRef.current.rejectIncomingCall();
    setIncomingCallInfo(null);
  }, []);
  
  // Toggle mute
  const toggleMute = useCallback(() => {
    if (!twilioServiceRef.current) {
      console.warn('No Twilio Voice service to toggle mute');
      return;
    }
    
    const newMuteState = !isMuted;
    twilioServiceRef.current.mute(newMuteState);
    setIsMuted(newMuteState);
  }, [isMuted]);
  
  // Send DTMF digits
  const sendDigits = useCallback((digits: string) => {
    if (!twilioServiceRef.current) {
      console.warn('No Twilio Voice service to send digits');
      return;
    }
    
    twilioServiceRef.current.sendDigits(digits);
  }, []);
  
  // Duration timer management
  const callStartTimeRef = useRef<number | null>(null);
  
  const startDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) return;
    
    callStartTimeRef.current = Date.now();
    durationIntervalRef.current = setInterval(() => {
      if (callStartTimeRef.current) {
        const duration = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
        setCallDuration(duration);
      }
    }, 1000);
  }, []);
  
  const stopDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    callStartTimeRef.current = null;
  }, []);
  
  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      initialize();
    }
    
    // Cleanup on unmount
    return () => {
      stopDurationTimer();
      if (twilioServiceRef.current) {
        twilioServiceRef.current.destroy();
        twilioServiceRef.current = null;
      }
    };
  }, [autoConnect]); // FIXED: Removed unstable dependencies to prevent re-initialization loops

  return {
    // State
    isReady,
    isConnecting,
    isInCall,
    isIncomingCall,
    callStatus,
    error,
    
    // Actions
    initialize,
    makeCall,
    hangUp,
    toggleMute,
    sendDigits,
    acceptIncomingCall,
    rejectIncomingCall,
    
    // Call info
    callDuration,
    isMuted,
    incomingCallInfo
  };
} 
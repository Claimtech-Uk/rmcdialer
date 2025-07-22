'use client';

import { useCallback, useState } from 'react';
import { useGlobalTwilio } from '@/lib/providers/GlobalTwilioProvider';
import { api } from '@/lib/trpc/client';
import { useToast } from '@/modules/core/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { isFeatureEnabled } from '@/lib/config/features';
import type { UserCallContext, CallOutcomeOptions } from '@/modules/calls/types/call.types';

interface GlobalCallOptions {
  userContext: UserCallContext;
  queueInfo?: {
    queueType: string;
    position: number;
    totalInQueue: number;
  };
  onCallComplete?: (outcome: CallOutcomeOptions) => void;
  source: 'queue' | 'manual' | 'inbound';
  mode?: 'popup' | 'page';
}

interface GlobalCallState {
  // Current call information
  currentCall: GlobalCallOptions | null;
  isCallActive: boolean;
  callMode: 'popup' | 'page' | null;
  
  // Actions
  initiateCall: (options: GlobalCallOptions) => Promise<void>;
  endCall: () => Promise<void>;
  switchToPage: () => void;
  switchToPopup: () => void;
  
  // Status
  isEnabled: boolean;
  isReady: boolean;
}

export function useGlobalCall(): GlobalCallState {
  const isEnabled = isFeatureEnabled('GLOBAL_TWILIO');
  const { getDevice, isReady, isInCall, currentCallSid } = useGlobalTwilio();
  const { toast } = useToast();
  const router = useRouter();
  
  // Local state for current call
  const [currentCall, setCurrentCall] = useState<GlobalCallOptions | null>(null);
  const [callMode, setCallMode] = useState<'popup' | 'page' | null>(null);
  
  // API mutations
  const initiateCallMutation = api.calls.initiateCall.useMutation();
  const updateCallStatusMutation = api.calls.updateCallStatus.useMutation();

  const initiateCall = useCallback(async (options: GlobalCallOptions) => {
    if (!isEnabled) {
      console.warn('⚠️ Global calling is disabled');
      return;
    }

    const device = getDevice();
    if (!device) {
      toast({
        title: "Calling System Not Ready",
        description: "Please wait for the calling system to initialize",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('🚀 Initiating global call:', options);
      
      // Store call state
      setCurrentCall(options);
      setCallMode(options.mode || 'page');
      
      // Create call session in database
      const callSessionResult = await initiateCallMutation.mutateAsync({
        userId: options.userContext.userId,
        phoneNumber: options.userContext.phoneNumber,
        direction: 'outbound',
        queueId: options.queueInfo ? undefined : undefined // TODO: Implement queue ID mapping
      });
      
      console.log('✅ Call session created:', callSessionResult.callSession.id);
      
      if (options.mode === 'popup') {
        // For popup mode, start call directly
        await device.makeCall({
          phoneNumber: options.userContext.phoneNumber,
          userContext: {
            userId: options.userContext.userId,
            firstName: options.userContext.firstName,
            lastName: options.userContext.lastName,
            claimId: options.userContext.claims[0]?.id
          }
        });
        
        toast({
          title: "Call Started",
          description: `Connected to ${options.userContext.firstName} ${options.userContext.lastName}`,
        });
      } else {
        // For page mode, navigate to call session page
        const urlParams = new URLSearchParams({
          userId: options.userContext.userId.toString(),
          phone: encodeURIComponent(options.userContext.phoneNumber),
          name: encodeURIComponent(`${options.userContext.firstName} ${options.userContext.lastName}`),
          preloaded: 'true'
        });
        
        router.push(`/calls/${callSessionResult.callSession.id}?${urlParams.toString()}`);
      }
      
    } catch (error: any) {
      console.error('❌ Failed to initiate global call:', error);
      
      // Clear call state on error
      setCurrentCall(null);
      setCallMode(null);
      
      toast({
        title: "Call Failed",
        description: error.message || "Could not start call",
        variant: "destructive",
      });
    }
  }, [isEnabled, getDevice, toast, router, initiateCallMutation]);

  const endCall = useCallback(async () => {
    if (!currentCall) return;
    
    console.log('🔚 Ending global call');
    
    const device = getDevice();
    if (device) {
      device.hangUp();
    }
    
    // Clear call state
    setCurrentCall(null);
    setCallMode(null);
    
    // Update call session if we have one
    if (currentCallSid) {
      try {
        await updateCallStatusMutation.mutateAsync({
          sessionId: currentCallSid,
          status: 'completed',
          endedAt: new Date()
        });
      } catch (error) {
        console.error('❌ Failed to update call status:', error);
      }
    }
    
    toast({
      title: "Call Ended",
      description: "The call has been disconnected",
    });
    
    // Call completion callback if provided
    if (currentCall.onCallComplete) {
      // For now, call with a basic outcome - in a full implementation,
      // this would show the outcome modal
      currentCall.onCallComplete({
        outcomeType: 'contacted',
        outcomeNotes: 'Call ended via global call system',
        magicLinkSent: false,
        smsSent: false,
        documentsRequested: [],
        nextCallDelayHours: 24
      });
    }
  }, [currentCall, currentCallSid, getDevice, updateCallStatusMutation, toast]);

  const switchToPage = useCallback(() => {
    if (!currentCall || !currentCallSid) return;
    
    console.log('📄 Switching call to page mode');
    
    // Navigate to call session page
    const urlParams = new URLSearchParams({
      userId: currentCall.userContext.userId.toString(),
      phone: encodeURIComponent(currentCall.userContext.phoneNumber),
      name: encodeURIComponent(`${currentCall.userContext.firstName} ${currentCall.userContext.lastName}`)
    });
    
    router.push(`/calls/${currentCallSid}?${urlParams.toString()}`);
    setCallMode('page');
  }, [currentCall, currentCallSid, router]);

  const switchToPopup = useCallback(() => {
    if (!currentCall) return;
    
    console.log('🎭 Switching call to popup mode');
    setCallMode('popup');
    
    // TODO: In a full implementation, this would move the call interface
    // from the page to a popup overlay
    toast({
      title: "Popup Mode",
      description: "Call interface moved to popup",
    });
  }, [currentCall, toast]);

  return {
    currentCall,
    isCallActive: isInCall || !!currentCall,
    callMode,
    initiateCall,
    endCall,
    switchToPage,
    switchToPopup,
    isEnabled,
    isReady
  };
} 
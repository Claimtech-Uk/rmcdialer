import { Device, Call } from '@twilio/voice-sdk';

// PERFORMANCE: Global singleton to prevent multiple Device instances
let globalTwilioDevice: Device | null = null;
let globalDeviceAgent: string | null = null;

export interface TwilioVoiceConfig {
  agentId: string | number;
  agentEmail: string;
  onCallStatusChange?: (status: CallStatus) => void;
  onError?: (error: Error) => void;
  onIncomingCall?: (call: IncomingCallInfo) => void;
}

export interface CallStatus {
  state: 'connecting' | 'ready' | 'offline' | 'busy' | 'error' | 'connected' | 'disconnected' | 'ringing' | 'incoming';
  error?: string;
  callSid?: string;
}

export interface IncomingCallInfo {
  callSid: string;
  from: string;
  to: string;
  accept: () => void;
  reject: () => void;
}

export interface OutgoingCallParams {
  phoneNumber: string;
  userContext?: {
    userId: number;
    firstName: string;
    lastName: string;
    claimId?: number;
  };
}

export class TwilioVoiceService {
  private device: Device | null = null;
  private currentCall: Call | null = null;
  private currentIncomingCall: Call | null = null;
  private config: TwilioVoiceConfig;
  private isInitialized = false;
  private accessToken: string | null = null;

  constructor(config: TwilioVoiceConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      console.log('🔧 Initializing Twilio Device...');

      // Request microphone permissions first
      await this.requestMicrophonePermission();
      
      // CRITICAL FIX: Handle AudioContext user gesture requirement for Chrome autoplay policy
      this.handleAudioContextGesture();

      // Get access token from our API
      const tokenResponse = await fetch('/api/twilio/access-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentId: this.config.agentId,
          agentEmail: this.config.agentEmail,
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.text();
        throw new Error(`Failed to get access token: ${tokenResponse.status} ${errorData}`);
      }

      const { accessToken, development } = await tokenResponse.json();
      this.accessToken = accessToken;
      console.log(`🔑 Access token received (${development ? 'development' : 'production'} mode)`);

      // PERFORMANCE: Don't create Device if we're in development mode with missing credentials
      if (development) {
        console.log('🔧 Development mode detected - Twilio Device creation skipped to prevent audio file spam');
        this.config.onCallStatusChange?.({
          state: 'error',
          error: 'Development Mode: Missing Twilio credentials. Please configure TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET, and TWILIO_TWIML_APP_SID'
        });
        return;
      }

      // PERFORMANCE: Use global singleton to prevent multiple Device instances and audio file spam
      const currentAgentKey = `${this.config.agentId}_${this.config.agentEmail}`;
      
      if (globalTwilioDevice && globalDeviceAgent === currentAgentKey) {
        console.log('🔄 Reusing existing global Twilio Device for same agent');
        this.device = globalTwilioDevice;
        // Set up event handlers for this service instance
        this.setupDeviceEventHandlers();
        // Check if already registered
        if (this.device.state === 'registered') {
          this.isInitialized = true;
          this.config.onCallStatusChange?.({ state: 'ready' });
        }
        return;
      }

      // Destroy any existing global device for different agent
      if (globalTwilioDevice && globalDeviceAgent !== currentAgentKey) {
        console.log('🧹 Destroying existing global Twilio Device for different agent');
        globalTwilioDevice.destroy();
        globalTwilioDevice = null;
        globalDeviceAgent = null;
      }

      // Initialize Twilio Device using npm package with minimal configuration for performance
      this.device = new Device(accessToken, {
        // PERFORMANCE: Reduce debug logging in production to reduce network overhead
        logLevel: development ? 'debug' : 'warn'
      });

      // Store as global singleton
      globalTwilioDevice = this.device;
      globalDeviceAgent = currentAgentKey;

      // Set up device event handlers
      this.setupDeviceEventHandlers();

      // Register device - this might trigger the AccessTokenInvalid error
      console.log('📱 Registering Twilio Device...');
      await this.device.register();
      this.isInitialized = true;
      console.log('✅ Twilio Device registered successfully');

    } catch (error) {
      console.error('❌ Failed to initialize Twilio Device:', error);
      this.config.onError?.(error as Error);
      this.config.onCallStatusChange?.({
        state: 'error',
        error: this.getErrorMessage(error)
      });
      throw error;
    }
  }

  private async requestMicrophonePermission(): Promise<void> {
    try {
      console.log('🎤 Requesting microphone permission...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the stream immediately after getting permission
      stream.getTracks().forEach(track => track.stop());
      console.log('✅ Microphone permission granted');
    } catch (error) {
      console.warn('⚠️ Microphone permission denied or unavailable:', error);
      // Don't throw here - let Twilio handle audio setup
    }
  }

  private setupDeviceEventHandlers(): void {
    if (!this.device) return;

    // Device ready event
    this.device.on('registered', () => {
      console.log('📱 Twilio Device is ready for calls');
      this.config.onCallStatusChange?.({ state: 'ready' });
    });

    // Device error event - improved error handling
    this.device.on('error', (error: any) => {
      console.error('📱 Twilio Device error:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        type: typeof error,
        description: error.description,
        explanation: error.explanation
      });
      
      this.config.onError?.(error);
      this.config.onCallStatusChange?.({
        state: 'error',
        error: this.getErrorMessage(error)
      });
    });

    // Incoming call event - UPDATED to accept calls with AudioContext handling
    this.device.on('incoming', (call: Call) => {
      console.log('📞 Incoming call received from:', call.parameters?.From || 'Unknown');
      console.log('📞 Raw Call object parameters:', call.parameters);
      console.log('📞 Call SID from parameters:', call.parameters?.CallSid);
      
      // CRITICAL DEBUGGING: Check for valid Twilio Call SID format
      const twilioCallSid = call.parameters?.CallSid || '';
      if (!twilioCallSid.startsWith('CA') || twilioCallSid.length !== 34) {
        console.error('🚨 INVALID TWILIO CALL SID FORMAT:', {
          receivedCallSid: twilioCallSid,
          expectedFormat: 'CA + 32 characters',
          actualLength: twilioCallSid.length,
          startsWithCA: twilioCallSid.startsWith('CA'),
          allParameters: call.parameters
        });
        
        // Still proceed but with a warning
        console.warn('⚠️ Proceeding with invalid Call SID - this may cause database lookup failures');
      }
      
      // CRITICAL: Handle AudioContext for incoming calls
      this.handleAudioContextGesture();
      
      this.currentIncomingCall = call;
      
      // Set up incoming call event handlers
      this.setupIncomingCallEventHandlers(call);
      
      // Notify the UI about the incoming call
      const incomingCallInfo: IncomingCallInfo = {
        callSid: twilioCallSid,
        from: call.parameters?.From || 'Unknown',
        to: call.parameters?.To || '',
        accept: () => this.acceptIncomingCall(),
        reject: () => this.rejectIncomingCall()
      };
      
      this.config.onIncomingCall?.(incomingCallInfo);
      this.config.onCallStatusChange?.({ 
        state: 'incoming',
        callSid: twilioCallSid
      });
    });

    // Device offline event
    this.device.on('unregistered', () => {
      console.log('📱 Twilio Device is offline');
      this.config.onCallStatusChange?.({ state: 'offline' });
    });

    // Device destroyed event
    this.device.on('destroyed', () => {
      console.log('📱 Twilio Device destroyed');
      this.config.onCallStatusChange?.({ state: 'offline' });
    });
  }

  /**
   * Set up event handlers for incoming calls
   */
  private setupIncomingCallEventHandlers(call: Call): void {
    // Call connected
    call.on('accept', () => {
      console.log('✅ Incoming call accepted');
      this.currentCall = call;
      this.currentIncomingCall = null;
      this.config.onCallStatusChange?.({
        state: 'connected',
        callSid: call.parameters?.CallSid
      });
    });

    // Call disconnected
    call.on('disconnect', () => {
      console.log('📴 Incoming call disconnected');
      this.currentCall = null;
      this.currentIncomingCall = null;
      this.config.onCallStatusChange?.({ state: 'disconnected' });
    });

    // Call rejected
    call.on('reject', () => {
      console.log('❌ Incoming call rejected');
      this.currentCall = null;
      this.currentIncomingCall = null;
      this.config.onCallStatusChange?.({ state: 'disconnected' });
    });

    // Call error
    call.on('error', (error: any) => {
      console.error('❌ Incoming call error:', error);
      this.currentCall = null;
      this.currentIncomingCall = null;
      this.config.onError?.(error);
      this.config.onCallStatusChange?.({
        state: 'error',
        error: error.message || 'Incoming call error'
      });
    });
  }

  /**
   * Accept the current incoming call
   */
  acceptIncomingCall(): void {
    if (this.currentIncomingCall) {
      console.log('✅ Accepting incoming call');
      this.currentIncomingCall.accept();
    } else {
      console.warn('⚠️ No incoming call to accept');
    }
  }

  /**
   * Reject the current incoming call
   */
  rejectIncomingCall(): void {
    if (this.currentIncomingCall) {
      console.log('❌ Rejecting incoming call');
      this.currentIncomingCall.reject();
    } else {
      console.warn('⚠️ No incoming call to reject');
    }
  }

  /**
   * Check if the device is ready to make calls
   */
  isReady(): boolean {
    return this.isInitialized && this.device !== null && this.device.state === 'registered';
  }

  /**
   * Make an outbound call
   */
  async makeCall(params: OutgoingCallParams): Promise<void> {
    if (!this.device || !this.isReady()) {
      throw new Error('Twilio Device is not ready. Please initialize first.');
    }

    try {
      console.log(`📞 Making call to ${params.phoneNumber}...`);

      // Prepare call parameters
      const callParams = {
        To: params.phoneNumber,
        // Add user context as call parameters
        ...(params.userContext && {
          userId: params.userContext.userId.toString(),
          userName: `${params.userContext.firstName} ${params.userContext.lastName}`,
          claimId: params.userContext.claimId?.toString() || ''
        })
      };

      // Make the call
      this.currentCall = await this.device.connect({ params: callParams });
      this.setupOutgoingCallEventHandlers(this.currentCall);

      this.config.onCallStatusChange?.({ state: 'connecting' });

    } catch (error) {
      console.error('❌ Failed to make call:', error);
      this.config.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Set up event handlers for outgoing calls
   */
  private setupOutgoingCallEventHandlers(call: Call): void {
    // Call connected
    call.on('accept', () => {
      console.log('✅ Outgoing call connected successfully');
      this.config.onCallStatusChange?.({
        state: 'connected',
        callSid: call.parameters?.CallSid
      });
    });

    // Call disconnected
    call.on('disconnect', () => {
      console.log('📴 Outgoing call disconnected');
      this.currentCall = null;
      this.config.onCallStatusChange?.({ state: 'disconnected' });
    });

    // Call rejected or failed
    call.on('reject', () => {
      console.log('❌ Outgoing call rejected');
      this.currentCall = null;
      this.config.onCallStatusChange?.({
        state: 'error',
        error: 'Call was rejected'
      });
    });

    // Call error
    call.on('error', (error: any) => {
      console.error('❌ Outgoing call error:', error);
      this.currentCall = null;
      this.config.onError?.(error);
      this.config.onCallStatusChange?.({
        state: 'error',
        error: error.message || 'Call error'
      });
    });
  }

  /**
   * Hang up the current call (outgoing or incoming)
   */
  hangUp(): void {
    if (this.currentCall) {
      console.log('📴 Hanging up current call...');
      this.currentCall.disconnect();
      this.currentCall = null;
    } else if (this.currentIncomingCall) {
      console.log('📴 Rejecting incoming call...');
      this.currentIncomingCall.reject();
      this.currentIncomingCall = null;
    } else {
      console.warn('⚠️ No active call to hang up');
    }
  }

  /**
   * Mute or unmute the current call
   */
  mute(shouldMute: boolean = true): void {
    const activeCall = this.currentCall || this.currentIncomingCall;
    if (activeCall) {
      activeCall.mute(shouldMute);
      console.log(`🔇 Call ${shouldMute ? 'muted' : 'unmuted'}`);
    }
  }

  /**
   * Send DTMF digits during a call
   */
  sendDigits(digits: string): void {
    const activeCall = this.currentCall || this.currentIncomingCall;
    if (activeCall) {
      activeCall.sendDigits(digits);
      console.log(`📞 Sent digits: ${digits}`);
    }
  }

  /**
   * Get current call status
   */
  getCurrentCallStatus(): { hasIncomingCall: boolean; hasActiveCall: boolean; callSid?: string } {
    return {
      hasIncomingCall: !!this.currentIncomingCall,
      hasActiveCall: !!this.currentCall,
      callSid: this.currentCall?.parameters?.CallSid || this.currentIncomingCall?.parameters?.CallSid
    };
  }

  /**
   * Cleanup and unregister the device
   */
  destroy(): void {
    if (this.currentCall) {
      this.currentCall.disconnect();
      this.currentCall = null;
    }
    
    if (this.currentIncomingCall) {
      this.currentIncomingCall.reject();
      this.currentIncomingCall = null;
    }

    // PERFORMANCE: Only destroy global device if this service owns it
    if (this.device && this.device === globalTwilioDevice) {
      console.log('🧹 Destroying global Twilio Device');
      this.device.destroy();
      globalTwilioDevice = null;
      globalDeviceAgent = null;
    }
    
    this.device = null;
    this.isInitialized = false;
    console.log('🧹 Twilio Voice Service destroyed');
  }

  /**
   * Get a human-readable error message
   */
  private getErrorMessage(error: any): string {
    if (typeof error === 'string') return error;
    if (error?.message) return error.message;
    if (error?.description) return error.description;
    return 'Unknown error occurred';
  }

  // CRITICAL FIX: Handle AudioContext user gesture requirement
  private handleAudioContextGesture(): void {
    try {
      console.log('🎵 Aggressively handling AudioContext user gesture compliance...');
      
      if (typeof window === 'undefined') return;
      
      // Patch AudioContext constructor to automatically resume when created
      const originalAudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!originalAudioContext) return;

      // Track if we've already patched
      if ((window as any).__twilioAudioContextPatched) {
        console.log('🎵 AudioContext already patched for auto-resume');
        return;
      }

      // Create a global gesture unlock function
      const unlockAudio = () => {
        console.log('🎵 Unlocking all AudioContext instances...');
        
        // Find and resume all existing AudioContext instances
        if ((window as any).__audioContextInstances) {
          (window as any).__audioContextInstances.forEach((ctx: AudioContext) => {
            if (ctx.state === 'suspended') {
              ctx.resume().then(() => {
                console.log('✅ Resumed suspended AudioContext');
              }).catch(console.warn);
            }
          });
        }
      };

      // Patch AudioContext constructor to track instances and auto-resume
      const PatchedAudioContext = class extends originalAudioContext {
        constructor(...args: any[]) {
          super(...args);
          
          // Track this instance
          if (!(window as any).__audioContextInstances) {
            (window as any).__audioContextInstances = [];
          }
          (window as any).__audioContextInstances.push(this);
          
          // Auto-resume if suspended
          if (this.state === 'suspended') {
            console.log('🎵 New AudioContext created in suspended state, setting up auto-resume...');
            
            // Try immediate resume (might work if user already interacted)
            this.resume().catch(() => {
              console.log('🎵 Immediate resume failed, waiting for user gesture...');
            });
            
            // Set up gesture listeners for this specific context
            const resumeThis = () => {
              if (this.state === 'suspended') {
                this.resume().then(() => {
                  console.log('✅ AudioContext resumed after user gesture');
                }).catch(console.warn);
              }
            };
            
            const gestureHandler = () => {
              resumeThis();
              unlockAudio(); // Also unlock any other instances
            };
            
            // Add multiple gesture listeners
            document.addEventListener('click', gestureHandler, { once: true });
            document.addEventListener('touchstart', gestureHandler, { once: true });
            document.addEventListener('keydown', gestureHandler, { once: true });
            document.addEventListener('pointerdown', gestureHandler, { once: true });
          }
        }
      };

      // Replace the global AudioContext
      window.AudioContext = PatchedAudioContext as any;
      if ((window as any).webkitAudioContext) {
        (window as any).webkitAudioContext = PatchedAudioContext;
      }
      
      (window as any).__twilioAudioContextPatched = true;
      console.log('✅ AudioContext patched for automatic user gesture handling');

      // Add immediate unlock attempt
      unlockAudio();
      
    } catch (error) {
      console.warn('⚠️ AudioContext gesture handling failed:', error);
    }
  }
} 
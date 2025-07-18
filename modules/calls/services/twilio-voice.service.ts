// Global Twilio SDK types (loaded via script tag)
declare global {
  interface Window {
    Twilio: {
      Device: new(accessToken: string, options?: any) => DeviceInstance;
    };
  }
}

interface DeviceInstance {
  register(): void;
  unregister(): void;
  connect(options?: any): CallInstance;
  on(event: string, handler: Function): void;
  state: string;
  isBusy: boolean;
}

interface CallInstance {
  disconnect(): void;
  mute(shouldMute?: boolean): void;
  sendDigits(digits: string): void;
  on(event: string, handler: Function): void;
  status(): string;
  parameters: any;
}

export interface TwilioVoiceConfig {
  agentId: string | number;
  agentEmail: string;
  onCallStatusChange?: (status: CallStatus) => void;
  onError?: (error: Error) => void;
}

export interface CallStatus {
  state: 'connecting' | 'ready' | 'offline' | 'busy' | 'error' | 'connected' | 'disconnected';
  error?: string;
  callSid?: string;
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
  private device: DeviceInstance | null = null;
  private currentCall: CallInstance | null = null;
  private config: TwilioVoiceConfig;
  private isInitialized = false;

  constructor(config: TwilioVoiceConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      console.log('🔧 Initializing Twilio Device...');

      // Check if Twilio SDK is loaded
      if (typeof window === 'undefined' || !window.Twilio) {
        throw new Error('Twilio Voice SDK not loaded. Make sure the script tag is included.');
      }

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
        throw new Error('Failed to get access token');
      }

      const { accessToken, development } = await tokenResponse.json();
      console.log(`🔑 Access token received (${development ? 'development' : 'production'} mode)`);

      // Initialize Twilio Device using global SDK
      this.device = new window.Twilio.Device(accessToken, {
        // Edge locations for better connectivity  
        edge: ['dublin', 'london']
      });

      // Set up device event handlers
      this.setupDeviceEventHandlers();

      // Register device
      this.device.register();
      this.isInitialized = true;
      console.log('✅ Twilio Device registered successfully');

    } catch (error) {
      console.error('❌ Failed to initialize Twilio Device:', error);
      this.config.onError?.(error as Error);
      this.config.onCallStatusChange?.({
        state: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  private setupDeviceEventHandlers(): void {
    if (!this.device) return;

    // Device ready event
    this.device.on('ready', () => {
      console.log('📱 Twilio Device is ready for calls');
      this.config.onCallStatusChange?.({ state: 'ready' });
    });

    // Device error event
    this.device.on('error', (error: any) => {
      console.error('📱 Twilio Device error:', error);
      this.config.onError?.(error);
      this.config.onCallStatusChange?.({
        state: 'error',
        error: error.message || 'Device error'
      });
    });

    // Incoming call event (for future use)
    this.device.on('incoming', (call: CallInstance) => {
      console.log('📞 Incoming call received');
      // Handle incoming calls if needed
    });

    // Device offline event
    this.device.on('offline', () => {
      console.log('📱 Twilio Device is offline');
      this.config.onCallStatusChange?.({ state: 'offline' });
    });
  }

  /**
   * Check if the device is ready to make calls
   */
  isReady(): boolean {
    return this.isInitialized && this.device !== null && this.device.state === 'ready';
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
      this.currentCall = this.device.connect(callParams);
      this.setupCallEventHandlers(this.currentCall);

      this.config.onCallStatusChange?.({ state: 'connecting' });

    } catch (error) {
      console.error('❌ Failed to make call:', error);
      this.config.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Set up event handlers for the current call
   */
  private setupCallEventHandlers(call: CallInstance): void {
    // Call connected
    call.on('accept', () => {
      console.log('✅ Call connected successfully');
      this.config.onCallStatusChange?.({
        state: 'connected',
        callSid: call.parameters?.CallSid
      });
    });

    // Call disconnected
    call.on('disconnect', () => {
      console.log('📴 Call disconnected');
      this.currentCall = null;
      this.config.onCallStatusChange?.({ state: 'disconnected' });
    });

    // Call rejected or failed
    call.on('reject', () => {
      console.log('❌ Call rejected');
      this.currentCall = null;
      this.config.onCallStatusChange?.({
        state: 'error',
        error: 'Call was rejected'
      });
    });

    // Call error
    call.on('error', (error: any) => {
      console.error('❌ Call error:', error);
      this.currentCall = null;
      this.config.onError?.(error);
      this.config.onCallStatusChange?.({
        state: 'error',
        error: error.message || 'Call error'
      });
    });
  }

  /**
   * Hang up the current call
   */
  hangUp(): void {
    if (this.currentCall) {
      console.log('📴 Hanging up call...');
      this.currentCall.disconnect();
      this.currentCall = null;
    }
  }

  /**
   * Mute or unmute the current call
   */
  mute(shouldMute: boolean = true): void {
    if (this.currentCall) {
      this.currentCall.mute(shouldMute);
      console.log(`🔇 Call ${shouldMute ? 'muted' : 'unmuted'}`);
    }
  }

  /**
   * Send DTMF digits during a call
   */
  sendDigits(digits: string): void {
    if (this.currentCall) {
      this.currentCall.sendDigits(digits);
      console.log(`📞 Sent digits: ${digits}`);
    }
  }

  /**
   * Cleanup and unregister the device
   */
  destroy(): void {
    if (this.currentCall) {
      this.hangUp();
    }

    if (this.device) {
      this.device.unregister();
      this.device = null;
    }

    this.isInitialized = false;
    console.log('🧹 Twilio Voice Service destroyed');
  }
} 
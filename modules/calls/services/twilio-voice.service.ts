import { Device, Call } from '@twilio/voice-sdk';

export interface TwilioVoiceConfig {
  agentId: string | number;
  agentEmail: string;
  onCallStatusChange?: (status: CallStatus) => void;
  onError?: (error: Error) => void;
}

export interface CallStatus {
  state: 'ready' | 'connecting' | 'connected' | 'disconnecting' | 'disconnected' | 'error';
  callSid?: string;
  duration?: number;
  error?: string;
}

export interface OutgoingCallParams {
  to: string;
  userId: number;
  userName: string;
  claimId?: number;
  callReason?: string;
}

export class TwilioVoiceService {
  private device: Device | null = null;
  private currentCall: Call | null = null;
  private config: TwilioVoiceConfig;
  private isInitialized = false;
  private callStartTime: number | null = null;

  constructor(config: TwilioVoiceConfig) {
    this.config = config;
    console.log('🎧 TwilioVoiceService initialized for agent:', config.agentId);
  }

  /**
   * Initialize Twilio Device with access token
   */
  async initialize(): Promise<void> {
    try {
      console.log('🔧 Initializing Twilio Device...');

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

      // Initialize Twilio Device
      this.device = new Device(accessToken, {
        // Edge locations for better connectivity  
        edge: ['dublin', 'london']
      });

      // Set up device event handlers
      this.setupDeviceEventHandlers();

      // Register the device
      await this.device.register();
      
      this.isInitialized = true;
      console.log('✅ Twilio Device initialized and registered');
      
      this.updateCallStatus({ state: 'ready' });

    } catch (error) {
      console.error('❌ Failed to initialize Twilio Device:', error);
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Make an outgoing call
   */
  async makeCall(params: OutgoingCallParams): Promise<void> {
    if (!this.device || !this.isInitialized) {
      throw new Error('Twilio Device not initialized');
    }

    if (this.currentCall) {
      throw new Error('Call already in progress');
    }

    try {
      console.log(`📞 Making call to ${params.to} for user ${params.userName} (ID: ${params.userId})`);

      // Custom parameters to pass to our webhook
      const callParams = {
        To: params.to,
        userId: params.userId.toString(),
        userName: params.userName,
        claimId: params.claimId?.toString() || '',
        callReason: params.callReason || 'General follow-up',
        agentId: this.config.agentId.toString(),
        agentEmail: this.config.agentEmail,
      };

      // Make the call
      this.currentCall = await this.device.connect({ params: callParams });
      
      // Set up call event handlers
      this.setupCallEventHandlers(this.currentCall);
      
      this.updateCallStatus({ state: 'connecting' });

    } catch (error) {
      console.error('❌ Failed to make call:', error);
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Hang up the current call
   */
  hangUp(): void {
    if (!this.currentCall) {
      console.warn('No active call to hang up');
      return;
    }

    try {
      console.log('📞 Hanging up call...');
      this.currentCall.disconnect();
    } catch (error) {
      console.error('❌ Failed to hang up:', error);
      this.handleError(error as Error);
    }
  }

  /**
   * Mute/unmute the microphone
   */
  toggleMute(): boolean {
    if (!this.currentCall) {
      console.warn('No active call to mute/unmute');
      return false;
    }

    try {
      const isMuted = this.currentCall.isMuted();
      this.currentCall.mute(!isMuted);
      console.log(`🎤 Microphone ${!isMuted ? 'muted' : 'unmuted'}`);
      return !isMuted;
    } catch (error) {
      console.error('❌ Failed to toggle mute:', error);
      this.handleError(error as Error);
      return false;
    }
  }

  /**
   * Get current call duration in seconds
   */
  getCallDuration(): number {
    if (!this.callStartTime) return 0;
    return Math.floor((Date.now() - this.callStartTime) / 1000);
  }

  /**
   * Send DTMF tones (for phone menus)
   */
  sendDigits(digits: string): void {
    if (!this.currentCall) {
      console.warn('No active call to send digits');
      return;
    }

    try {
      this.currentCall.sendDigits(digits);
      console.log(`🔢 Sent digits: ${digits}`);
    } catch (error) {
      console.error('❌ Failed to send digits:', error);
      this.handleError(error as Error);
    }
  }

  /**
   * Clean up and destroy the device
   */
  destroy(): void {
    try {
      if (this.currentCall) {
        this.currentCall.disconnect();
      }

      if (this.device) {
        this.device.destroy();
        this.device = null;
      }

      this.isInitialized = false;
      console.log('🧹 Twilio Device destroyed');
    } catch (error) {
      console.error('❌ Error destroying Twilio Device:', error);
    }
  }

  /**
   * Get current device state
   */
  getDeviceState(): string {
    if (!this.device) return 'uninitialized';
    return this.device.state;
  }

  /**
   * Check if device is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.device?.state === 'registered';
  }

  // Private helper methods

  private setupDeviceEventHandlers(): void {
    if (!this.device) return;

    this.device.on('registered', () => {
      console.log('✅ Device registered and ready');
      this.updateCallStatus({ state: 'ready' });
    });

    this.device.on('unregistered', () => {
      console.log('❌ Device unregistered');
      this.updateCallStatus({ state: 'disconnected' });
    });

    this.device.on('error', (error) => {
      console.error('❌ Device error:', error);
      this.handleError(error);
    });

    this.device.on('incoming', (call) => {
      console.log('📞 Incoming call - rejecting (agents only make outbound calls)');
      call.reject();
    });

    this.device.on('tokenWillExpire', async () => {
      console.log('🔑 Access token will expire soon, refreshing...');
      await this.refreshAccessToken();
    });
  }

  private setupCallEventHandlers(call: Call): void {
    call.on('accept', () => {
      console.log('✅ Call accepted');
      this.callStartTime = Date.now();
      this.updateCallStatus({ 
        state: 'connected',
        callSid: call.parameters.CallSid
      });
    });

    call.on('disconnect', () => {
      console.log('📞 Call disconnected');
      const duration = this.getCallDuration();
      this.updateCallStatus({ 
        state: 'disconnected',
        duration
      });
      this.currentCall = null;
      this.callStartTime = null;
    });

    call.on('cancel', () => {
      console.log('❌ Call cancelled');
      this.updateCallStatus({ state: 'disconnected' });
      this.currentCall = null;
    });

    call.on('reject', () => {
      console.log('❌ Call rejected');
      this.updateCallStatus({ state: 'disconnected' });
      this.currentCall = null;
    });

    call.on('error', (error) => {
      console.error('❌ Call error:', error);
      this.handleError(error);
      this.currentCall = null;
    });

    call.on('mute', (isMuted) => {
      console.log(`🎤 Call ${isMuted ? 'muted' : 'unmuted'}`);
    });
  }

  private async refreshAccessToken(): Promise<void> {
    try {
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
        throw new Error('Failed to refresh access token');
      }

      const { accessToken } = await tokenResponse.json();
      
      if (this.device) {
        this.device.updateToken(accessToken);
        console.log('✅ Access token refreshed');
      }
    } catch (error) {
      console.error('❌ Failed to refresh access token:', error);
      this.handleError(error as Error);
    }
  }

  private updateCallStatus(status: CallStatus): void {
    if (this.config.onCallStatusChange) {
      this.config.onCallStatusChange(status);
    }
  }

  private handleError(error: Error): void {
    this.updateCallStatus({ 
      state: 'error',
      error: error.message 
    });

    if (this.config.onError) {
      this.config.onError(error);
    }
  }
} 
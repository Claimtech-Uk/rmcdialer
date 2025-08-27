import twilio, { Twilio } from 'twilio';

/**
 * Centralized Twilio client service
 * Provides REST API access for calls, SMS, and other Twilio services
 */
export class TwilioClientService {
  private static instance: TwilioClientService;
  private client: Twilio;

  private constructor() {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      throw new Error('Twilio credentials not configured');
    }

    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }

  /**
   * Get singleton instance of Twilio client
   */
  public static getInstance(): TwilioClientService {
    if (!TwilioClientService.instance) {
      TwilioClientService.instance = new TwilioClientService();
    }
    return TwilioClientService.instance;
  }

  /**
   * Get the raw Twilio client for advanced operations
   */
  public getClient(): Twilio {
    return this.client;
  }

  /**
   * Create a direct outbound call using Twilio REST API
   * This eliminates the dual-call issue by creating only ONE call
   */
  public async createCall(params: {
    to: string;
    from: string;
    url: string;
    statusCallback?: string;
    statusCallbackEvent?: string[];
    statusCallbackMethod?: string;
    record?: boolean;
    recordingStatusCallback?: string;
    timeout?: number;
  }) {
    console.log('📞 Creating direct call via Twilio REST API:', {
      to: params.to,
      from: params.from,
      url: params.url,
      record: params.record
    });

    const callOptions: any = {
      to: params.to,
      from: params.from,
      url: params.url,
      method: 'POST'
    };

    // Add status callback if provided
    if (params.statusCallback) {
      callOptions.statusCallback = params.statusCallback;
      callOptions.statusCallbackEvent = params.statusCallbackEvent || ['initiated', 'ringing', 'answered', 'completed'];
      callOptions.statusCallbackMethod = params.statusCallbackMethod || 'POST';
    }

    // Add recording if requested
    if (params.record) {
      callOptions.record = 'true';
    }

    // Add recording callback if provided
    if (params.recordingStatusCallback) {
      callOptions.recordingStatusCallback = params.recordingStatusCallback;
      callOptions.recordingStatusCallbackMethod = 'POST';
    }

    // Set timeout
    if (params.timeout) {
      callOptions.timeout = params.timeout;
    }

    try {
      const call = await this.client.calls.create(callOptions);
      console.log('✅ Call created successfully:', call.sid);
      return call;
    } catch (error) {
      console.error('❌ Failed to create call:', error);
      throw error;
    }
  }

  /**
   * Get call details
   */
  public async getCall(callSid: string) {
    return await this.client.calls(callSid).fetch();
  }

  /**
   * Get recording details
   */
  public async getRecording(recordingSid: string) {
    return await this.client.recordings(recordingSid).fetch();
  }
}

/**
 * Export convenience function for getting Twilio client
 */
export const getTwilioClient = (): TwilioClientService => {
  return TwilioClientService.getInstance();
};

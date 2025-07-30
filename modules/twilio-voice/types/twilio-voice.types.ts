import { z } from 'zod';

// Twilio Voice Webhook Schema
export const TwilioVoiceWebhookSchema = z.object({
  CallSid: z.string(),
  AccountSid: z.string(),
  From: z.string(),
  To: z.string(),
  CallStatus: z.enum(['ringing', 'in-progress', 'completed', 'busy', 'failed', 'no-answer', 'canceled']),
  ApiVersion: z.string().optional(),
  Direction: z.enum(['inbound', 'outbound']).optional(),
  CallerName: z.string().optional(),
  Duration: z.string().optional(),
  RecordingUrl: z.string().optional(),
});

export type TwilioVoiceWebhookData = z.infer<typeof TwilioVoiceWebhookSchema>;

export interface CallerInfo {
  user: {
    id: number;
    first_name: string | null;
    last_name: string | null;
    phone_number: string | null;
    email_address: string | null;
    status: string | null;
    created_at: Date | null;
    last_login: Date | null;
  } | null;
  claims: any[];
  requirements: any[];
  callHistory: any[];
  priorityScore: number;
  lookupSuccess: boolean;
}

export interface NameInfo {
  firstName?: string;
  lastName?: string;
  userId?: number;
}

export interface CallEvent {
  callSid: string;
  from: string;
  to: string;
  status: string;
  duration: string;
} 
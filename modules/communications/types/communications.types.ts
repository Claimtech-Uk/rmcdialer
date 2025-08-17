// =============================================================================
// Communications Module Types
// =============================================================================
// Types for SMS conversations, Magic Links, and messaging functionality

// -----------------------------------------------------------------------------
// Base Communication Types
// -----------------------------------------------------------------------------

export type DeliveryMethod = 'sms' | 'whatsapp' | 'email';
export type MessageDirection = 'inbound' | 'outbound';
export type MessageStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'undelivered';
export type ConversationStatus = 'active' | 'closed';

// -----------------------------------------------------------------------------
// SMS Types
// -----------------------------------------------------------------------------

export interface SendSMSOptions {
  phoneNumber: string;
  message: string;
  agentId?: number;
  userId?: number;
  callSessionId?: string;
  /** 
   * Message type determines sender number routing:
   * - 'manual': Human agent actions → main production number
   * - 'auto_response': AI responses → test number  
   * - 'magic_link': AI-triggered links → test number
   * - 'callback_confirmation': Callback confirmations → main number
   * - 'review_request': Review requests → main number
   */
  messageType?: 'manual' | 'auto_response' | 'magic_link' | 'callback_confirmation' | 'review_request';
  templateId?: string;
  /** Optional: override the Twilio sender number for this send (E.164) */
  fromNumberOverride?: string;
}

export interface IncomingSMSData {
  from: string;
  to: string;
  body: string;
  messageSid: string;
  accountSid: string;
  timestamp: Date;
}

export interface SMSConversationOptions {
  phoneNumber?: string;
  userId?: number;
  agentId?: number;
  status?: ConversationStatus;
  page?: number;
  limit?: number;
}

export interface AutoResponseRule {
  keywords: string[];
  response: string;
  priority: number;
  requiresAgent?: boolean;
}

export interface SMSMessage {
  id: string;
  conversationId: string;
  direction: MessageDirection;
  body: string;
  twilioMessageSid?: string;
  status?: MessageStatus;
  isAutoResponse: boolean;
  messageType?: 'manual' | 'auto_response' | 'magic_link' | 'callback_confirmation';
  sentAt?: Date;
  receivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  failureReason?: string;
}

export interface SMSConversation {
  id: string;
  phoneNumber: string;
  userId?: number;
  assignedAgentId?: number;
  status: ConversationStatus;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
  assignedAgent?: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  };
  user?: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
  };
  messages?: SMSMessage[];
  messageCount?: number;
  latestMessage?: {
    body: string;
    direction: MessageDirection;
    createdAt: Date;
    isAutoResponse: boolean;
  };
}

export interface SMSSendResult {
  messageId: string;
  twilioSid: string;
  conversation: SMSConversation;
  status: 'sent' | 'failed';
}

export interface SMSProcessResult {
  message: SMSMessage;
  conversation: SMSConversation;
  autoResponse?: SMSSendResult;
}

export interface SMSStats {
  messages: {
    total: number;
    sent: number;
    received: number;
    failed: number;
    autoResponses: number;
    magicLinks: number;
  };
  conversations: {
    total: number;
    active: number;
    closed: number;
  };
}

// -----------------------------------------------------------------------------
// Magic Link Types
// -----------------------------------------------------------------------------

export type MagicLinkType = 
  | 'firstLogin' 
  | 'claimPortal' 
  | 'documentUpload' 
  | 'claimCompletion'
  | 'requirementReview'
  | 'statusUpdate'
  | 'profileUpdate';

export interface MagicLinkOptions {
  userId: number;
  linkType: MagicLinkType;
  deliveryMethod: DeliveryMethod;
  agentId?: number;
  callSessionId?: string;
  claimId?: number;
  expiresInHours?: number;
  customParams?: Record<string, string>;
  requirementTypes?: string[];
}

export interface MagicLinkResult {
  id: string;
  url: string;
  shortUrl?: string;
  token: string;
  expiresAt: Date;
  trackingId: string;
}

export interface SendMagicLinkOptions extends MagicLinkOptions {
  phoneNumber?: string;
  email?: string;
  firstName?: string;
  customMessage?: string;
  /** Optional: override the Twilio sender number for SMS delivery (E.164) */
  fromNumberOverride?: string;
}

export interface MagicLinkActivity {
  id: string;
  userId: number;
  linkType: MagicLinkType;
  linkToken: string;
  sentVia: DeliveryMethod;
  sentByAgentId: number;
  sentAt: Date;
  expiresAt: Date;
  accessedAt?: Date;
  accessCount?: number;
  isActive: boolean;
  userAgent?: string;
  ipAddress?: string;
  callSessionId?: string;
  expiredReason?: string;
  sentByAgent?: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface MagicLinkAnalytics {
  totalSent: number;
  totalAccessed: number;
  accessRate: number;
  byType: Record<MagicLinkType, { sent: number; accessed: number; rate: number }>;
  byDeliveryMethod: Record<DeliveryMethod, { sent: number; accessed: number; rate: number }>;
  byAgent: Array<{ 
    agentId: number; 
    agentName: string; 
    sent: number; 
    accessed: number; 
    rate: number;
  }>;
  recentActivity: Array<{
    id: string;
    userId: number;
    userName: string;
    linkType: MagicLinkType;
    sentAt: Date;
    accessedAt: Date | null;
    agentName: string;
  }>;
}

export interface MagicLinkSendResult {
  magicLink: MagicLinkResult;
  deliveryResult: {
    messageId?: string;
    twilioSid?: string;
    emailId?: string;
    status: 'sent' | 'failed';
    error?: string;
  };
}

// -----------------------------------------------------------------------------
// Twilio Integration Types
// -----------------------------------------------------------------------------

export interface TwilioClient {
  messages: {
    create: (options: {
      body: string;
      from: string;
      to: string;
      statusCallback?: string;
    }) => Promise<{ sid: string; status: string; }>;
  };
}

export interface TwilioWebhookData {
  MessageSid: string;
  MessageStatus: string;
  ErrorCode?: string;
  ErrorMessage?: string;
  From: string;
  To: string;
  Body: string;
  AccountSid: string;
  NumMedia?: string;
}

// -----------------------------------------------------------------------------
// Pagination Types
// -----------------------------------------------------------------------------

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export type PaginatedSMSConversations = PaginatedResult<SMSConversation>;
export type PaginatedSMSMessages = PaginatedResult<SMSMessage>;
export type PaginatedMagicLinkActivities = PaginatedResult<MagicLinkActivity>;

// -----------------------------------------------------------------------------
// Service Interface Types
// -----------------------------------------------------------------------------

export interface CommunicationsServiceDependencies {
  authService: {
    getCurrentAgent(): Promise<{ id: number; role: string; }>;
  };
  userService?: {
    getUserData(userId: number): Promise<{
      id: number;
      firstName: string;
      lastName: string;
      email: string;
      phoneNumber: string;
    }>;
  };
} 
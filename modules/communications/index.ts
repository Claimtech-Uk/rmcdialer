// Communications Module - SMS, Magic Links & Notifications
// This module handles all external communications including SMS, WhatsApp, email, and magic links

// Services (main business logic)
export { SMSService } from './services/sms.service'
export { MagicLinkService } from './services/magic-link.service'

// Components (UI components)
export { MagicLinkPanel } from './components/MagicLinkPanel'

// Types (for other modules and tRPC)
export type {
  // SMS Types
  SMSMessage,
  SMSConversation,
  SendSMSOptions,
  MessageStatus,
  ConversationStatus,
  SMSStats,
  
  // Magic Link Types
  MagicLinkType,
  DeliveryMethod,
  MagicLinkActivity,
  SendMagicLinkOptions,
  MagicLinkResult,
  MagicLinkAnalytics,
  
  // General Communication Types
  MessageDirection,
  IncomingSMSData,
  SMSConversationOptions,
  PaginatedResult,
  PaginatedSMSConversations,
  PaginatedSMSMessages,
  PaginatedMagicLinkActivities
} from './types/communications.types'

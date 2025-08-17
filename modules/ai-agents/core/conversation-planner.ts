// DEPRECATED: Multi-turn conversation planning with follow-up scheduling
// This service was removed as part of the immediate response system upgrade
// All messages now send immediately without follow-up delays

console.warn('AI SMS | ⚠️ Conversation planner is deprecated - using immediate response system')

export type ConversationGoal = 
  | 'signature'           // Get user to sign up
  | 'document_upload'     // Get user to upload documents  
  | 'retention'           // Keep engaged user interested
  | 'objection_handling'  // Address concerns and hesitations
  | 'status_update'       // Provide information and maintain relationship

export type MessagePlan = {
  id: string
  text: string
  delaySec: number
  conditions?: string[]  // Conditions that must be met to send (e.g., "no_reply_received")
  metadata: {
    purpose: string
    conversationGoal: ConversationGoal
    sequenceIndex: number    // 1, 2, 3 in the sequence
    planId: string          // Links messages in same plan
    strategy: string        // Strategy description
  }
}

export type ConversationPlan = {
  planId: string
  goal: ConversationGoal
  strategy: string
  messages: MessagePlan[]
  createdAt: number
  context: {
    userSentiment: string
    recentTopics: string[]
    objectionsSeen: string[]
  }
}

export type PlanningContext = {
  userMessage: string
  currentResponse: string
  conversationInsights?: any
  userFound: boolean
  userName?: string
  queueType?: string | null
  recentMessages?: Array<{direction: 'inbound' | 'outbound', body: string}>
}

export class ConversationPlanner {
  
  /**
   * DEPRECATED: Returns null - conversation planning disabled
   */
  async planConversation(
    phoneNumber: string,
    context: PlanningContext
  ): Promise<ConversationPlan | null> {
    console.log('AI SMS | ℹ️ Conversation planning disabled - using immediate response system')
    return null
  }
  
  /**
   * DEPRECATED: No-op - plan execution disabled
   */
  async executePlan(
    phoneNumber: string, 
    plan: ConversationPlan,
    userName?: string,
    userFound: boolean = false
  ): Promise<void> {
    console.log('AI SMS | ℹ️ Plan execution disabled - all messages send immediately')
    // No-op - immediate response system handles all messaging
  }
}

// Singleton instance (maintained for backward compatibility)
export const conversationPlanner = new ConversationPlanner()
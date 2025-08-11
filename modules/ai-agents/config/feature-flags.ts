/**
 * Feature flags for AI SMS Agent
 * Allows gradual rollout of new features without breaking existing functionality
 */

export const FEATURE_FLAGS = {
  // Modern tool calling vs legacy JSON response
  TOOL_CALLING_ENABLED: process.env.AI_SMS_ENABLE_TOOL_CALLING === 'true',
  
  // Enhanced response generation
  RESPONSE_ENHANCEMENT_ENABLED: process.env.AI_SMS_ENHANCE_RESPONSES !== 'false', // default true
  
  // Smart personalization features
  SMART_PERSONALIZATION_ENABLED: process.env.AI_SMS_SMART_PERSONALIZATION !== 'false', // default true
  
  // Intelligent knowledge selection
  AI_KNOWLEDGE_SELECTION_ENABLED: process.env.AI_SMS_AI_KNOWLEDGE_SELECTION !== 'false', // default true
  
  // Conversation insights tracking
  CONVERSATION_INSIGHTS_ENABLED: process.env.AI_SMS_CONVERSATION_INSIGHTS !== 'false', // default true
  
  // Multi-turn conversation planning
  CONVERSATION_PLANNING_ENABLED: process.env.AI_SMS_CONVERSATION_PLANNING !== 'false', // default true
  
  // New conversational response system
  CONVERSATIONAL_MODE_ENABLED: process.env.AI_SMS_CONVERSATIONAL_MODE === 'true', // default false (opt-in)
  
  // Development/debugging features
  VERBOSE_LOGGING: process.env.AI_SMS_VERBOSE_LOGGING === 'true',
  DEBUG_MODE: process.env.NODE_ENV === 'development' || process.env.AI_SMS_DEBUG === 'true'
} as const

export type FeatureFlag = keyof typeof FEATURE_FLAGS

/**
 * Check if a feature flag is enabled
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag]
}

/**
 * Log feature flag status for debugging
 */
export function logFeatureFlags(): void {
  if (FEATURE_FLAGS.VERBOSE_LOGGING || FEATURE_FLAGS.DEBUG_MODE) {
    console.log('AI SMS | 🏁 Feature flags status:', {
      toolCalling: FEATURE_FLAGS.TOOL_CALLING_ENABLED,
      responseEnhancement: FEATURE_FLAGS.RESPONSE_ENHANCEMENT_ENABLED,
      smartPersonalization: FEATURE_FLAGS.SMART_PERSONALIZATION_ENABLED,
      aiKnowledgeSelection: FEATURE_FLAGS.AI_KNOWLEDGE_SELECTION_ENABLED,
      conversationInsights: FEATURE_FLAGS.CONVERSATION_INSIGHTS_ENABLED,
      conversationPlanning: FEATURE_FLAGS.CONVERSATION_PLANNING_ENABLED,
      conversationalMode: FEATURE_FLAGS.CONVERSATIONAL_MODE_ENABLED,
      verboseLogging: FEATURE_FLAGS.VERBOSE_LOGGING,
      debugMode: FEATURE_FLAGS.DEBUG_MODE
    })
  }
}

/**
 * Environment variable documentation for deployment
 */
export const ENV_VARS_DOCUMENTATION = {
  AI_SMS_ENABLE_TOOL_CALLING: {
    description: 'Enable modern OpenAI tool calling (vs legacy JSON response)',
    type: 'boolean',
    default: 'false',
    values: ['true', 'false'],
    example: 'AI_SMS_ENABLE_TOOL_CALLING=true'
  },
  AI_SMS_ENHANCE_RESPONSES: {
    description: 'Enable intelligent response enhancement with value-added content',
    type: 'boolean', 
    default: 'true',
    values: ['true', 'false'],
    example: 'AI_SMS_ENHANCE_RESPONSES=true'
  },
  AI_SMS_SMART_PERSONALIZATION: {
    description: 'Enable smart name usage and link referencing based on conversation context',
    type: 'boolean',
    default: 'true', 
    values: ['true', 'false'],
    example: 'AI_SMS_SMART_PERSONALIZATION=true'
  },
  AI_SMS_AI_KNOWLEDGE_SELECTION: {
    description: 'Enable AI-powered knowledge base selection (vs regex-based)',
    type: 'boolean',
    default: 'true',
    values: ['true', 'false'], 
    example: 'AI_SMS_AI_KNOWLEDGE_SELECTION=true'
  },
  AI_SMS_CONVERSATION_INSIGHTS: {
    description: 'Enable conversation insights tracking and analysis',
    type: 'boolean',
    default: 'true',
    values: ['true', 'false'],
    example: 'AI_SMS_CONVERSATION_INSIGHTS=true'
  },
  AI_SMS_CONVERSATION_PLANNING: {
    description: 'Enable AI-powered multi-turn conversation planning and strategic follow-up sequences',
    type: 'boolean',
    default: 'true',
    values: ['true', 'false'],
    example: 'AI_SMS_CONVERSATION_PLANNING=true'
  },
  AI_SMS_CONVERSATIONAL_MODE: {
    description: 'Enable new conversational response system with consent-first links, weighted context, smart name usage, and follow-up questions',
    type: 'boolean',
    default: 'false',
    values: ['true', 'false'],
    example: 'AI_SMS_CONVERSATIONAL_MODE=true'
  },
  AI_SMS_VERBOSE_LOGGING: {
    description: 'Enable verbose logging for debugging and monitoring',
    type: 'boolean',
    default: 'false',
    values: ['true', 'false'],
    example: 'AI_SMS_VERBOSE_LOGGING=true'
  },
  AI_SMS_DEBUG: {
    description: 'Enable debug mode with additional logging and safety checks',
    type: 'boolean',
    default: 'false',
    values: ['true', 'false'],
    example: 'AI_SMS_DEBUG=true'
  }
} as const

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
  CONVERSATIONAL_MODE_ENABLED: process.env.AI_SMS_CONVERSATIONAL_MODE !== 'false', // default true (opt-out)
  
  // Development/debugging features
  VERBOSE_LOGGING: process.env.AI_SMS_VERBOSE_LOGGING === 'true',
  DEBUG_MODE: process.env.NODE_ENV === 'development' || process.env.AI_SMS_DEBUG === 'true',
  
  // Business hours bypass for testing
  IGNORE_BUSINESS_HOURS: process.env.AI_SMS_IGNORE_BUSINESS_HOURS === 'true',
  
  // Send multi-message responses immediately (for testing)
  IMMEDIATE_MULTIMSGS: process.env.AI_SMS_IMMEDIATE_MULTIMSGS === 'true',
  SIMPLIFIED_AI_MODE_ENABLED: process.env.AI_SMS_SIMPLIFIED_MODE === 'true',
  
  // PHASE 1 ENHANCEMENTS: Full Knowledge Base & Structured Prompting
  
  // Full knowledge base mode (vs filtered KB selection)
  FULL_KNOWLEDGE_BASE_ENABLED: process.env.AI_SMS_FULL_KB_MODE === 'true',
  
  // Structured checklist prompting approach
  STRUCTURED_PROMPT_ENABLED: process.env.AI_SMS_STRUCTURED_PROMPT === 'true',
  
  // GPT-4o-mini optimized configurations
  GPT4_MINI_OPTIMIZATIONS: process.env.AI_SMS_GPT4_MINI_OPTIMIZED === 'true',
  
  // Enhanced token usage tracking and optimization
  ENHANCED_TOKEN_TRACKING: process.env.AI_SMS_ENHANCED_TOKEN_TRACKING === 'true',
  
  // Knowledge base validation and quality checks
  KB_VALIDATION_ENABLED: process.env.AI_SMS_KB_VALIDATION === 'true'
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
      debugMode: FEATURE_FLAGS.DEBUG_MODE,
      ignoreBusinessHours: FEATURE_FLAGS.IGNORE_BUSINESS_HOURS,
      immediateMultimsgs: FEATURE_FLAGS.IMMEDIATE_MULTIMSGS,
      simplifiedMode: FEATURE_FLAGS.SIMPLIFIED_AI_MODE_ENABLED,
      
      // Phase 1 Enhancements
      fullKnowledgeBase: FEATURE_FLAGS.FULL_KNOWLEDGE_BASE_ENABLED,
      structuredPrompt: FEATURE_FLAGS.STRUCTURED_PROMPT_ENABLED,
      gpt4MiniOptimizations: FEATURE_FLAGS.GPT4_MINI_OPTIMIZATIONS,
      enhancedTokenTracking: FEATURE_FLAGS.ENHANCED_TOKEN_TRACKING,
      kbValidation: FEATURE_FLAGS.KB_VALIDATION_ENABLED
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
  },
  AI_SMS_IGNORE_BUSINESS_HOURS: {
    description: 'Bypass business hours restrictions for testing - sends messages immediately regardless of UK time',
    type: 'boolean',
    default: 'false',
    values: ['true', 'false'],
    example: 'AI_SMS_IGNORE_BUSINESS_HOURS=true'
  },
  AI_SMS_IMMEDIATE_MULTIMSGS: {
    description: 'Send multi-message AI responses immediately as one combined message for testing (bypasses follow-up delays)',
    type: 'boolean',
    default: 'false',
    values: ['true', 'false'],
    example: 'AI_SMS_IMMEDIATE_MULTIMSGS=true'
  },
  
  AI_SMS_SIMPLIFIED_MODE: {
    description: 'Enable simplified AI-controlled mode where AI decides both messages and actions naturally (gives AI full autonomy)',
    type: 'boolean',
    default: 'false',
    values: ['true', 'false'],
    example: 'AI_SMS_SIMPLIFIED_MODE=true'
  },
  
  // PHASE 1 ENHANCEMENT VARIABLES
  
  AI_SMS_FULL_KB_MODE: {
    description: 'Enable full knowledge base access (vs app-filtered KB selection) - gives AI complete domain knowledge for autonomous decision making',
    type: 'boolean',
    default: 'false',
    values: ['true', 'false'],
    example: 'AI_SMS_FULL_KB_MODE=true',
    impact: 'Higher token usage (~15k additional tokens) but significantly improved response quality and comprehensiveness'
  },
  
  AI_SMS_STRUCTURED_PROMPT: {
    description: 'Enable structured checklist-based prompting for improved AI instruction following and consistency',
    type: 'boolean',
    default: 'false', 
    values: ['true', 'false'],
    example: 'AI_SMS_STRUCTURED_PROMPT=true',
    impact: 'Better compliance with requirements, clearer decision-making process, easier debugging'
  },
  
  AI_SMS_GPT4_MINI_OPTIMIZED: {
    description: 'Enable GPT-4o-mini specific optimizations (prompt formatting, token management, response validation)',
    type: 'boolean',
    default: 'true',
    values: ['true', 'false'],
    example: 'AI_SMS_GPT4_MINI_OPTIMIZED=true',
    impact: 'Optimized for cost/performance balance with GPT-4o-mini model capabilities'
  },
  
  AI_SMS_ENHANCED_TOKEN_TRACKING: {
    description: 'Enable detailed token usage tracking, prompt optimization suggestions, and cost monitoring',
    type: 'boolean',
    default: 'false',
    values: ['true', 'false'], 
    example: 'AI_SMS_ENHANCED_TOKEN_TRACKING=true',
    impact: 'Additional logging overhead but valuable insights for optimization'
  },
  
  AI_SMS_KB_VALIDATION: {
    description: 'Enable knowledge base content validation and quality scoring for AI responses',
    type: 'boolean',
    default: 'false',
    values: ['true', 'false'],
    example: 'AI_SMS_KB_VALIDATION=true',
    impact: 'Ensures AI utilizes knowledge base effectively and identifies knowledge gaps'
  }
} as const

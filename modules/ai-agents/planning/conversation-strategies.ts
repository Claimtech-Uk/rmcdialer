// Predefined conversation strategies for multi-turn planning
// These serve as examples and templates for the AI planner

export const CONVERSATION_STRATEGIES = {
  // For users who haven't signed up yet
  SIGNATURE_NURTURE: {
    name: 'Signature Nurture Sequence',
    goal: 'signature',
    description: 'Gentle, value-focused sequence to guide hesitant users to sign up',
    examples: [
      {
        scenario: 'User asked about fees but seems hesitant',
        sequence: [
          {
            delayHours: 3,
            text: 'Quick follow-up - many clients appreciate that our sliding scale means the more we recover, the lower percentage we charge. It keeps our interests aligned.',
            purpose: 'Address fee concerns with value proposition'
          },
          {
            delayHours: 24,
            text: 'Worth mentioning - we investigate 3 different types of claims to maximise your compensation. Most firms only look at one. Any questions before we get started?',
            purpose: 'Differentiate and offer portal link'
          }
        ]
      },
      {
        scenario: 'User asked about timeline',
        sequence: [
          {
            delayHours: 4,
            text: 'One more thing on timing - while most cases resolve in Q1 2026, we often see early settlements when lenders want to avoid court. The sooner we start, the better.',
            purpose: 'Address timing objection with urgency'
          },
          {
            delayHours: 48,
            text: 'Ready to get your claim started? The initial check only takes 2 minutes and shows if you have a strong case.',
            purpose: 'Low-friction call to action'
          }
        ]
      }
    ]
  },

  // For users with objections or concerns
  OBJECTION_RESOLUTION: {
    name: 'Objection Resolution Sequence',
    goal: 'objection_handling',
    description: 'Address specific concerns and build trust through social proof',
    examples: [
      {
        scenario: 'User concerned about legitimacy',
        sequence: [
          {
            delayHours: 2,
            text: 'I understand being cautious about claims companies. We\'re FCA authorised and have helped thousands recover over £50M. Happy to share more details if helpful.',
            purpose: 'Provide credibility and social proof'
          },
          {
            delayHours: 24,
            text: 'Would a quick call with one of our specialists help address any concerns? Or would you prefer to see some client testimonials first?',
            purpose: 'Offer choice and human connection'
          }
        ]
      }
    ]
  },

  // For signed users who need to upload documents
  DOCUMENT_COMPLETION: {
    name: 'Document Upload Sequence',
    goal: 'document_upload',
    description: 'Guide users to complete document uploads with helpful tips',
    examples: [
      {
        scenario: 'User signed but hasn\'t uploaded documents yet',
        sequence: [
          {
            delayHours: 6,
            text: 'Great that you\'re signed up! Next step is uploading your ID and bank statements. The clearer the photos, the faster we can process your claim.',
            purpose: 'Helpful guidance and urgency'
          },
          {
            delayHours: 48,
            text: 'Quick reminder - we need your documents to start the lender search. Most clients find it takes under 5 minutes to upload. Need any help?',
            purpose: 'Remove friction and offer support'
          }
        ]
      }
    ]
  },

  // For keeping engaged users interested
  ENGAGEMENT_MAINTENANCE: {
    name: 'Engagement Maintenance',
    goal: 'retention',
    description: 'Keep interested users engaged with valuable information',
    examples: [
      {
        scenario: 'User asked multiple questions and seems very interested',
        sequence: [
          {
            delayHours: 8,
            text: 'Since you\'re researching thoroughly, you might find it interesting that we also check for irresponsible lending practices - many clients don\'t realise this adds significantly to their compensation.',
            purpose: 'Provide additional value and education'
          },
          {
            delayHours: 72,
            text: 'Anything else you\'d like to know about the process? I\'m here to help ensure you have all the information you need.',
            purpose: 'Maintain engagement and invite questions'
          }
        ]
      }
    ]
  }
} as const

export type StrategyType = keyof typeof CONVERSATION_STRATEGIES

/**
 * Get strategy examples for AI reference
 */
export function getStrategyExamples(strategyType: StrategyType): string {
  const strategy = CONVERSATION_STRATEGIES[strategyType]
  return `Strategy: ${strategy.name}
Description: ${strategy.description}

Examples:
${strategy.examples.map(ex => 
  `Scenario: ${ex.scenario}
${ex.sequence.map((msg, i) => 
  `  Message ${i+1} (${msg.delayHours}h): "${msg.text}" (${msg.purpose})`
).join('\n')}`
).join('\n\n')}`
}

/**
 * Get all strategies as context for AI planning
 */
export function getAllStrategiesContext(): string {
  return Object.keys(CONVERSATION_STRATEGIES)
    .map(key => getStrategyExamples(key as StrategyType))
    .join('\n\n---\n\n')
}

export const ASSISTANT_TURN_JSON_SCHEMA_NAME = 'assistant_turn'

export const ASSISTANT_TURN_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'actions'],
  properties: {
    // Optional plan metadata to move toward ResponsePlan
    plan_version: { type: 'string', nullable: true },
    // Optional idempotency key for action plan
    idempotency_key: { type: 'string', nullable: true },
    reply: { type: 'string', maxLength: 320 },
    // Optional multi-message plan (MVP). First message corresponds to reply; others are follow-ups.
    messages: {
      type: 'array',
      nullable: true,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text'],
        properties: {
          id: { type: 'string', nullable: true },
          text: { type: 'string', maxLength: 320 },
          send_after_seconds: { type: 'number', nullable: true }
        }
      }
    },
    actions: {
      type: 'array',
      items: {
        oneOf: [
          {
            type: 'object',
            additionalProperties: false,
            required: ['type'],
            properties: {
              type: { const: 'none' }
            }
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'phoneNumber', 'text'],
            properties: {
              type: { const: 'send_sms' },
              phoneNumber: { type: 'string' },
              text: { type: 'string', maxLength: 320 }
            }
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'userId', 'phoneNumber', 'linkType'],
            properties: {
              type: { const: 'send_magic_link' },
              userId: { type: 'number' },
              phoneNumber: { type: 'string' },
              linkType: { enum: ['claimPortal', 'documentUpload'] }
            }
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'phoneNumber'],
            properties: {
              type: { const: 'send_review_link' },
              phoneNumber: { type: 'string' }
            }
          }
        ]
      }
    }
  }
} as const

export type AssistantTurn = {
  reply: string
  plan_version?: string | null
  idempotency_key?: string | null
  messages?: Array<{ id?: string | null; text: string; send_after_seconds?: number | null }>
  actions: Array<
    | { type: 'none' }
    | { type: 'send_sms'; phoneNumber: string; text: string }
    | { type: 'send_magic_link'; userId: number; phoneNumber: string; linkType: 'claimPortal' | 'documentUpload' }
    | { type: 'send_review_link'; phoneNumber: string }
  >
}



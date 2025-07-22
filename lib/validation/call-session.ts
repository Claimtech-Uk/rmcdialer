import { z } from 'zod';

// UUID validation schema
export const UUIDSchema = z.string().uuid('Invalid UUID format. Call session IDs must be valid UUIDs.');

// Call session ID validation
export const CallSessionIdSchema = UUIDSchema.describe('Call session ID must be a valid UUID format');

// Enhanced call session validation
export const CallSessionValidationSchema = z.object({
  id: CallSessionIdSchema,
  userId: z.number().int().positive('User ID must be a positive integer'),
  agentId: z.number().int().positive('Agent ID must be a positive integer'),
  status: z.enum(['initiated', 'connecting', 'ringing', 'connected', 'completed', 'failed', 'no_answer']),
  direction: z.enum(['outbound', 'inbound']),
  twilioCallSid: z.string().optional(),
});

/**
 * Validates that a call session ID is a proper UUID
 * Throws an error if invalid
 */
export function validateCallSessionId(sessionId: string): string {
  const result = CallSessionIdSchema.safeParse(sessionId);
  
  if (!result.success) {
    const errors = result.error.errors.map(e => e.message).join(', ');
    throw new Error(`Invalid call session ID: ${errors}. Received: "${sessionId}"`);
  }
  
  return result.data;
}

/**
 * Checks if a string looks like our old invalid format
 * Used to detect and prevent legacy format usage
 */
export function detectLegacySessionIdFormat(sessionId: string): boolean {
  // Detect the old format: call_${timestamp}_${userId}
  const legacyPattern = /^call_\d{13}_\d+$/;
  return legacyPattern.test(sessionId);
}

/**
 * Enhanced validation with helpful error messages
 */
export function validateCallSessionIdWithContext(sessionId: string, context?: string): string {
  // First check for legacy format
  if (detectLegacySessionIdFormat(sessionId)) {
    const errorMsg = `Legacy call session ID format detected: "${sessionId}". ` +
      `This format is no longer supported. Use proper UUID format instead. ` +
      `${context ? `Context: ${context}` : ''}`;
    
    console.error('🚨 [VALIDATION ERROR]', errorMsg);
    throw new Error(errorMsg);
  }
  
  // Validate as UUID
  return validateCallSessionId(sessionId);
}

/**
 * Middleware-friendly validation function
 */
export function createCallSessionIdValidator(context: string) {
  return (sessionId: string) => validateCallSessionIdWithContext(sessionId, context);
}

// Export validation utilities
export const callSessionValidation = {
  validateId: validateCallSessionId,
  validateWithContext: validateCallSessionIdWithContext,
  detectLegacyFormat: detectLegacySessionIdFormat,
  createValidator: createCallSessionIdValidator,
  schema: CallSessionValidationSchema
} as const; 
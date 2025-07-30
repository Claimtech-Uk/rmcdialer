import { CallEvent } from '../types/twilio-voice.types';

/**
 * Helper function to determine if we should use AI voice agent
 * Currently disabled - will re-enable once Azure infrastructure with WebSocket support is ready
 */
export function shouldUseAIAgent(callerInfo: any, from: string, to: string): boolean {
  // AI voice agents are currently disabled - routing all calls to human agents
  // Will re-enable once Azure infrastructure with WebSocket support is ready
  // 
  // Future logic to consider when re-enabling:
  // - Caller history
  // - Time of day
  // - Agent availability
  // - Specific phone numbers
  return false;
}

/**
 * Log call events for debugging
 */
export function logCallEvent(event: string, data: any) {
  console.log(`📊 Call Event: ${event}`, {
    callSid: data.CallSid,
    from: data.From,
    to: data.To,
    status: data.CallStatus,
    duration: data.Duration
  });
} 
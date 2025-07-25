// Example: Integrating AI Voice Agent with Existing Voice Webhook
// This shows how to modify app/api/webhooks/twilio/voice/route.ts

import { AIVoiceService, TwilioAIAssistantConfig } from '../index';
import { prisma } from '@/lib/db';

// These would be imported from existing voice webhook handler
declare function performEnhancedCallerLookup(from: string): Promise<any>;

// Example AI agent configuration
const defaultAIAgentConfig: TwilioAIAssistantConfig = {
  id: 'rmc-main-agent',
  name: 'RMC Assistant',
  provider: 'twilio-ai-assistants',
  assistantSid: process.env.TWILIO_AI_ASSISTANT_SID || '',
  personality: {
    name: 'Sarah',
    voice: 'alice',
    tone: 'professional',
    language: 'en-US'
  },
  capabilities: {
    canTransferToHuman: true,
    canAccessCustomerData: true,
    canScheduleAppointments: false,
    canProcessPayments: false
  },
  fallbackBehavior: 'transfer'
};

// Example: Modified handleInboundCall function
export async function handleInboundCallWithAI(
  callSid: string, 
  from: string, 
  to: string, 
  webhookData: any
) {
  try {
    console.log(`🤖 Processing inbound call with AI agent: ${from} → ${to}`);
    
    // 1. Enhanced caller lookup (existing logic)
    const callerInfo = await performEnhancedCallerLookup(from);
    const userId = callerInfo?.user?.id ? Number(callerInfo.user.id) : undefined;
    
    // 2. Check if AI agent should handle this call
    const shouldUseAI = await shouldUseAIAgent(callerInfo, from, to);
    
    if (shouldUseAI) {
      // 3. Initialize AI voice service
      const aiService = new AIVoiceService(defaultAIAgentConfig);
      
      // 4. Start AI conversation
      const conversation = await aiService.startConversation({
        callSid,
        fromNumber: from,
        toNumber: to,
        userId
      });
      
      // 5. Generate TwiML for AI assistant
      const callerName = callerInfo?.user 
        ? `${callerInfo.user.first_name} ${callerInfo.user.last_name}`
        : undefined;
        
      const twimlResponse = aiService.generateTwiML(conversation, callerName);
      
      console.log(`✅ Routing call ${callSid} to AI agent: ${conversation.id}`);
      return new Response(twimlResponse, {
        headers: { 'Content-Type': 'application/xml' }
      });
    } else {
      // 6. Fall back to human agent routing (existing logic)
      return handleInboundCallWithHuman(callSid, from, to, webhookData);
    }
    
  } catch (error) {
    console.error('❌ AI agent handling failed:', error);
    // Always fall back to human agents on error
    return handleInboundCallWithHuman(callSid, from, to, webhookData);
  }
}

// Example: Logic to determine if AI should handle the call
async function shouldUseAIAgent(callerInfo: any, from: string, to: string): Promise<boolean> {
  // Example conditions for using AI:
  
  // 1. Business hours check
  const isBusinessHours = isWithinBusinessHours();
  if (!isBusinessHours) {
    console.log('🕐 Outside business hours - using AI agent');
    return true;
  }
  
  // 2. Agent availability check
  const availableAgents = await getAvailableAgentCount();
  if (availableAgents === 0) {
    console.log('👥 No agents available - using AI agent');
    return true;
  }
  
  // 3. Known customer with simple queries
  if (callerInfo?.user && hasSimpleQueryHistory(callerInfo.user)) {
    console.log('📞 Known customer with simple queries - using AI agent');
    return true;
  }
  
  // 4. High call volume
  const recentCallVolume = await getRecentCallVolume();
  if (recentCallVolume > 10) { // Threshold
    console.log('📈 High call volume - using AI agent for triage');
    return true;
  }
  
  // Default to human agents for complex cases
  return false;
}

// Example: Business hours check
function isWithinBusinessHours(): boolean {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0 = Sunday, 6 = Saturday
  
  // Monday-Friday, 9 AM - 6 PM
  return day >= 1 && day <= 5 && hour >= 9 && hour < 18;
}

// Example: Get available agent count
async function getAvailableAgentCount(): Promise<number> {
  const availableAgents = await prisma.agentSession.count({
    where: {
      status: 'available',
      logoutAt: null,
      agent: {
        isActive: true
      }
    }
  });
  
  return availableAgents;
}

// Example: Check if user typically has simple queries
function hasSimpleQueryHistory(user: any): boolean {
  // This could check call history, previous outcomes, etc.
  // For now, simple heuristic
  return user.total_calls > 3 && user.avg_call_duration < 300; // < 5 minutes
}

// Example: Get recent call volume
async function getRecentCallVolume(): Promise<number> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  const recentCalls = await prisma.callSession.count({
    where: {
      createdAt: {
        gte: oneHourAgo
      }
    }
  });
  
  return recentCalls;
}

// Fallback to existing human agent logic
async function handleInboundCallWithHuman(
  callSid: string, 
  from: string, 
  to: string, 
  webhookData: any
) {
  // This would be the existing handleInboundCall logic
  console.log('👤 Routing to human agent (existing logic)');
  // ... existing implementation
} 
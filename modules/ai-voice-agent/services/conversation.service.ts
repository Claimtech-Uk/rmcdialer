// Conversation Service
// Manages conversation flow, context persistence, and analytics

import { prisma } from '@/lib/db';
import { 
  VoiceConversation, 
  ConversationTurn, 
  ConversationOutcome,
  VoiceAgentAnalytics 
} from '../types/ai-voice.types';

export class ConversationService {
  
  /**
   * Save conversation turn to database
   */
  async saveTurn(conversationId: string, turn: ConversationTurn): Promise<void> {
    await prisma.conversationTurn.create({
      data: {
        conversationId,
        timestamp: turn.timestamp,
        speaker: turn.speaker,
        content: turn.content,
        intent: turn.intent,
        confidence: turn.confidence,
        metadata: turn.metadata || {}
      }
    });
  }

  /**
   * Get conversation history with turns
   */
  async getConversationHistory(conversationId: string): Promise<{
    conversation: VoiceConversation;
    turns: ConversationTurn[];
  } | null> {
    const conversation = await prisma.voiceConversation.findUnique({
      where: { id: conversationId },
      include: {
        turns: {
          orderBy: { timestamp: 'asc' }
        }
      }
    });

    if (!conversation) return null;

    return {
      conversation: conversation as VoiceConversation,
      turns: conversation.turns as ConversationTurn[]
    };
  }

  /**
   * Update conversation with outcome
   */
  async completeConversation(
    conversationId: string, 
    outcome: ConversationOutcome
  ): Promise<void> {
    await prisma.voiceConversation.update({
      where: { id: conversationId },
      data: {
        endedAt: new Date(),
        status: 'completed',
        outcome: outcome.type,
        transferredToHuman: outcome.transferredToHuman,
        customerSatisfaction: outcome.customerSatisfaction,
        goalAchieved: outcome.goalAchieved,
        summary: outcome.summary
      }
    });
  }

  /**
   * Get conversation analytics
   */
  async getAnalytics(
    timeframe: 'day' | 'week' | 'month' = 'week'
  ): Promise<VoiceAgentAnalytics> {
    const since = new Date();
    switch (timeframe) {
      case 'day':
        since.setDate(since.getDate() - 1);
        break;
      case 'week':
        since.setDate(since.getDate() - 7);
        break;
      case 'month':
        since.setMonth(since.getMonth() - 1);
        break;
    }

    const [
      totalConversations,
      completedConversations,
      transferredConversations,
      averageDuration,
      satisfactionRatings
    ] = await Promise.all([
      prisma.voiceConversation.count({
        where: { startedAt: { gte: since } }
      }),
      prisma.voiceConversation.count({
        where: { 
          startedAt: { gte: since },
          status: 'completed'
        }
      }),
      prisma.voiceConversation.count({
        where: { 
          startedAt: { gte: since },
          transferredToHuman: true
        }
      }),
      prisma.voiceConversation.aggregate({
        where: { 
          startedAt: { gte: since },
          endedAt: { not: null }
        },
        _avg: {
          duration: true
        }
      }),
      prisma.voiceConversation.groupBy({
        by: ['customerSatisfaction'],
        where: { 
          startedAt: { gte: since },
          customerSatisfaction: { not: null }
        },
        _count: true
      })
    ]);

    const completionRate = totalConversations > 0 
      ? (completedConversations / totalConversations) * 100 
      : 0;
    
    const transferRate = totalConversations > 0 
      ? (transferredConversations / totalConversations) * 100 
      : 0;

    const avgSatisfaction = satisfactionRatings.length > 0
      ? satisfactionRatings.reduce((sum, rating) => 
          sum + (rating.customerSatisfaction || 0) * rating._count, 0
        ) / satisfactionRatings.reduce((sum, rating) => sum + rating._count, 0)
      : 0;

    return {
      totalConversations,
      completionRate,
      transferRate,
      averageDuration: averageDuration._avg.duration || 0,
      customerSatisfaction: avgSatisfaction,
      topIntents: [], // TODO: Calculate from conversation turns
      timeframe
    };
  }

  /**
   * Build conversation context for AI
   */
  buildConversationContext(
    turns: ConversationTurn[], 
    customerData?: any
  ): string {
    let context = '';
    
    // Add customer context if available
    if (customerData) {
      context += `Customer Information:
- Name: ${customerData.name || 'Unknown'}
- Phone: ${customerData.phone || 'Unknown'}
- Previous calls: ${customerData.previousCalls || 0}
- Last contact: ${customerData.lastContact || 'Never'}

`;
    }

    // Add conversation history
    if (turns.length > 0) {
      context += `Conversation History:
`;
      turns.forEach((turn, index) => {
        context += `${turn.speaker}: ${turn.content}
`;
      });
    }

    return context;
  }

  /**
   * Extract intent and entities from conversation turn
   */
  async extractIntent(content: string): Promise<{
    intent: string;
    confidence: number;
    entities: Record<string, any>;
  }> {
    // Simple intent detection - in production, you'd use NLP service
    const intentPatterns = {
      'appointment': /\b(appointment|schedule|booking|book)\b/i,
      'billing': /\b(bill|payment|charge|invoice)\b/i,
      'support': /\b(help|problem|issue|broken)\b/i,
      'information': /\b(hours|location|address|phone)\b/i,
      'transfer': /\b(speak|talk|human|agent|person)\b/i,
      'goodbye': /\b(bye|goodbye|thank you|thanks)\b/i
    };

    for (const [intent, pattern] of Object.entries(intentPatterns)) {
      if (pattern.test(content)) {
        return {
          intent,
          confidence: 0.8, // Mock confidence
          entities: {} // TODO: Extract actual entities
        };
      }
    }

    return {
      intent: 'unknown',
      confidence: 0.1,
      entities: {}
    };
  }
} 
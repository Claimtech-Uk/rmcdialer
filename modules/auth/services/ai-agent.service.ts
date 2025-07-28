import { PrismaClient } from '@prisma/client';

export class AiAgentService {
  private static instance: AiAgentService;
  private aiAgentCache: { id: number; email: string } | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(private prisma: PrismaClient) {}

  static getInstance(prisma: PrismaClient): AiAgentService {
    if (!AiAgentService.instance) {
      AiAgentService.instance = new AiAgentService(prisma);
    }
    return AiAgentService.instance;
  }

  /**
   * Get the AI agent ID for Hume voice calls
   * Uses caching to avoid repeated database queries
   */
  async getAiAgentId(): Promise<number | null> {
    const now = Date.now();
    
    // Return cached result if still valid
    if (this.aiAgentCache && now < this.cacheExpiry) {
      return this.aiAgentCache.id;
    }

    try {
      // First try to get AI agent with ID 999 (our designated AI agent ID)
      const aiAgent = await this.prisma.agent.findUnique({
        where: {
          id: 999
        },
        select: {
          id: true,
          email: true,
          isAiAgent: true,
          isActive: true
        }
      });

      if (aiAgent && aiAgent.isAiAgent && aiAgent.isActive) {
        this.aiAgentCache = { id: aiAgent.id, email: aiAgent.email };
        this.cacheExpiry = now + this.CACHE_TTL;
        return aiAgent.id;
      }

      // Fallback: find any AI agent
      const fallbackAiAgent = await this.prisma.agent.findFirst({
        where: {
          isAiAgent: true,
          isActive: true
        },
        select: {
          id: true,
          email: true
        }
      });

      if (fallbackAiAgent) {
        this.aiAgentCache = fallbackAiAgent;
        this.cacheExpiry = now + this.CACHE_TTL;
        return fallbackAiAgent.id;
      }

      console.warn('⚠️ No active AI agent found in database');
      return null;
    } catch (error) {
      console.error('❌ Failed to get AI agent ID:', error);
      return null;
    }
  }

  /**
   * Get complete AI agent details
   */
  async getAiAgent(): Promise<any | null> {
    try {
      const aiAgent = await this.prisma.agent.findFirst({
        where: {
          isAiAgent: true,
          isActive: true
        }
      });

      return aiAgent;
    } catch (error) {
      console.error('❌ Failed to get AI agent details:', error);
      return null;
    }
  }

  /**
   * Check if an agent ID belongs to the AI agent
   */
  async isAiAgent(agentId: number): Promise<boolean> {
    const aiAgentId = await this.getAiAgentId();
    return aiAgentId === agentId;
  }

  /**
   * Clear the cache (useful for testing or when AI agent is updated)
   */
  clearCache(): void {
    this.aiAgentCache = null;
    this.cacheExpiry = 0;
  }
}

// Export a singleton instance creator
export const createAiAgentService = (prisma: PrismaClient) => 
  AiAgentService.getInstance(prisma);

// Export constants for easy reference
export const AI_AGENT_EMAIL = 'ai-agent@rmc-dialler.system';
export const AI_AGENT_TEAM = 'ai'; 
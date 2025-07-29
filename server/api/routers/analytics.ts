import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '@/lib/trpc/server';
import { TRPCError } from '@trpc/server';
import { AgentPerformanceAnalyticsService } from '@/modules/analytics';
import { prisma } from '@/lib/db';

// Create logger instance
const logger = {
  info: (message: string, meta?: any) => console.log(`[Analytics] ${message}`, meta),
  error: (message: string, error?: any) => console.error(`[Analytics ERROR] ${message}`, error),
  warn: (message: string, meta?: any) => console.warn(`[Analytics WARN] ${message}`, meta)
};

// Initialize analytics service
const analyticsService = new AgentPerformanceAnalyticsService({ prisma, logger });

// Input validation schemas
const DateRangeSchema = z.object({
  startDate: z.date(),
  endDate: z.date()
});

const AgentAnalyticsFiltersSchema = z.object({
  startDate: z.date(),
  endDate: z.date(),
  agentIds: z.array(z.number()).optional(),
  teamFilter: z.string().optional(),
  includeBreaks: z.boolean().default(false),
  minCallsThreshold: z.number().min(0).default(1)
});

const AgentMetricsQuerySchema = z.object({
  agentId: z.number(),
  date: z.date()
});

export const analyticsRouter = createTRPCRouter({
  // Get comprehensive efficiency metrics for a specific agent and date
  getAgentEfficiencyMetrics: protectedProcedure
    .input(AgentMetricsQuerySchema)
    .query(async ({ input, ctx }) => {
      try {
        // Check permissions - agents can only see their own data, supervisors can see all
        if (ctx.agent.role === 'agent' && ctx.agent.id !== input.agentId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Agents can only view their own metrics'
          });
        }

        const metrics = await analyticsService.getAgentEfficiencyMetrics(
          input.agentId, 
          input.date
        );

        return metrics;
      } catch (error) {
        logger.error('Failed to get agent efficiency metrics', { input, error });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve efficiency metrics'
        });
      }
    }),

  // Get productivity comparison between multiple agents
  getAgentProductivityComparison: protectedProcedure
    .input(AgentAnalyticsFiltersSchema)
    .query(async ({ input, ctx }) => {
      try {
        // Check permissions - only supervisors and admins can compare agents
        if (ctx.agent.role === 'agent') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Insufficient permissions to compare agents'
          });
        }

        const comparison = await analyticsService.getAgentProductivityComparison(input);
        return comparison;
      } catch (error) {
        logger.error('Failed to get agent productivity comparison', { input, error });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve productivity comparison'
        });
      }
    }),

  // Get live metrics for currently active agents
  getLiveAgentMetrics: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        // Check permissions - only supervisors and admins can see live metrics
        if (ctx.agent.role === 'agent') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Insufficient permissions to view live metrics'
          });
        }

        const liveMetrics = await analyticsService.getLiveAgentMetrics();
        return liveMetrics;
      } catch (error) {
        logger.error('Failed to get live agent metrics', { error });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve live metrics'
        });
      }
    }),

  // Get agent's daily summary (for agent profile/dashboard)
  getMyDailyMetrics: protectedProcedure
    .input(z.object({
      date: z.date().optional().default(() => new Date())
    }))
    .query(async ({ input, ctx }) => {
      try {
        const metrics = await analyticsService.getAgentEfficiencyMetrics(
          ctx.agent.id,
          input.date
        );

        if (!metrics) {
          return {
            hasData: false,
            message: 'No activity recorded for this date'
          };
        }

        return {
          hasData: true,
          summary: {
            callsToday: metrics.callMetrics.totalCalls,
            talkTimeToday: Math.round(metrics.callMetrics.totalTalkTime / 60), // minutes
            avgGapTime: Math.round(metrics.gapMetrics.avgGapTime / 60), // minutes
            productivityScore: metrics.efficiency.productivityScore,
            efficiency: {
              callsPerHour: Math.round(metrics.efficiency.callsPerHour * 10) / 10,
              utilizationRate: Math.round(metrics.timeDistribution.utilization)
            }
          },
          timeBreakdown: {
            loginTime: metrics.timeDistribution.loginTime,
            logoutTime: metrics.timeDistribution.logoutTime,
            totalLoggedTime: Math.round(metrics.timeDistribution.totalLoggedTime / 60), // minutes
            talkTime: Math.round(metrics.callMetrics.totalTalkTime / 60), // minutes
            gapTime: Math.round(metrics.gapMetrics.totalGapTime / 60) // minutes
          },
          gapAnalysis: {
            avgGapTime: Math.round(metrics.gapMetrics.avgGapTime),
            minGapTime: metrics.gapMetrics.minGapTime,
            maxGapTime: metrics.gapMetrics.maxGapTime,
            totalGaps: metrics.gapMetrics.gapCount
          }
        };
      } catch (error) {
        logger.error('Failed to get daily metrics', { agentId: ctx.agent.id, date: input.date, error });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve daily metrics'
        });
      }
    }),

  // Get weekly summary for agent
  getMyWeeklyMetrics: protectedProcedure
    .input(z.object({
      startDate: z.date().optional().default(() => {
        const date = new Date();
        date.setDate(date.getDate() - 7);
        return date;
      }),
      endDate: z.date().optional().default(() => new Date())
    }))
    .query(async ({ input, ctx }) => {
      try {
        const filters = {
          startDate: input.startDate,
          endDate: input.endDate,
          agentIds: [ctx.agent.id],
          minCallsThreshold: 0
        };

        const comparison = await analyticsService.getAgentProductivityComparison(filters);
        const agentMetrics = comparison.find(c => c.agentId === ctx.agent.id);

        if (!agentMetrics) {
          return {
            hasData: false,
            message: 'No activity recorded for this period'
          };
        }

        return {
          hasData: true,
          weeklyStats: {
            totalCalls: agentMetrics.metrics.productivityScore, // Temporary - need to add total calls to comparison
            avgGapTime: Math.round(agentMetrics.metrics.avgGapTime / 60), // minutes
            callsPerHour: Math.round(agentMetrics.metrics.callsPerHour * 10) / 10,
            productivityScore: agentMetrics.metrics.productivityScore,
            rank: agentMetrics.rank,
            percentiles: {
              efficiency: Math.round(agentMetrics.percentileRanks.efficiency),
              volume: Math.round(agentMetrics.percentileRanks.callVolume),
              gapTime: Math.round(agentMetrics.percentileRanks.gapTime)
            }
          }
        };
      } catch (error) {
        logger.error('Failed to get weekly metrics', { agentId: ctx.agent.id, input, error });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve weekly metrics'
        });
      }
    }),

  // Get team efficiency report (supervisor/admin only)
  getTeamEfficiencyReport: protectedProcedure
    .input(AgentAnalyticsFiltersSchema)
    .query(async ({ input, ctx }) => {
      try {
        // Check permissions
        if (ctx.agent.role === 'agent') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Insufficient permissions to view team reports'
          });
        }

        const agentComparisons = await analyticsService.getAgentProductivityComparison(input);
        
        // Calculate team aggregates
        const teamMetrics = {
          totalAgents: agentComparisons.length,
          activeAgents: agentComparisons.length,
          totalCalls: agentComparisons.reduce((sum, agent) => sum + (agent.metrics.callsPerHour * 8), 0), // Estimate
          totalTalkTime: 0, // Would need to implement
          avgGapTime: agentComparisons.reduce((sum, agent) => sum + agent.metrics.avgGapTime, 0) / agentComparisons.length,
          teamProductivityScore: agentComparisons.reduce((sum, agent) => sum + agent.metrics.productivityScore, 0) / agentComparisons.length
        };

        return {
          date: input.startDate,
          teamMetrics,
          agentRankings: agentComparisons.slice(0, 10), // Top 10
          trends: {
            gapTimeChange: 0, // Would need historical data
            productivityChange: 0,
            volumeChange: 0
          },
          insights: [
            `Top performer: ${agentComparisons[0]?.agentName || 'N/A'}`,
            `Team average gap time: ${Math.round(teamMetrics.avgGapTime / 60)} minutes`,
            `Team productivity score: ${Math.round(teamMetrics.teamProductivityScore)}/100`
          ]
        };
      } catch (error) {
        logger.error('Failed to get team efficiency report', { input, error });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve team efficiency report'
        });
      }
    })
}); 
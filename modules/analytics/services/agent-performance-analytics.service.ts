import { PrismaClient } from '@prisma/client';
import type { 
  AgentEfficiencyMetrics, 
  CallGapAnalysis, 
  AgentProductivityComparison,
  TeamEfficiencyReport,
  AgentAnalyticsFilters,
  EfficiencyBenchmarks,
  LiveAgentMetrics
} from '../types/analytics.types';

interface AgentPerformanceAnalyticsServiceDependencies {
  prisma: PrismaClient;
  logger: {
    info: (message: string, meta?: any) => void;
    error: (message: string, error?: any) => void;
    warn: (message: string, meta?: any) => void;
  };
}

export class AgentPerformanceAnalyticsService {
  constructor(private deps: AgentPerformanceAnalyticsServiceDependencies) {}

  /**
   * Calculate comprehensive efficiency metrics for an agent on a specific date
   */
  async getAgentEfficiencyMetrics(
    agentId: number, 
    date: Date
  ): Promise<AgentEfficiencyMetrics | null> {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // Get agent session for the day
      const agentSession = await this.deps.prisma.agentSession.findFirst({
        where: {
          agentId,
          loginAt: {
            gte: startOfDay,
            lte: endOfDay
          }
        }
      });

      if (!agentSession) {
        return null; // Agent didn't work this day
      }

      // Get all completed calls for the agent on this date
      const calls = await this.deps.prisma.callSession.findMany({
        where: {
          agentId,
          startedAt: {
            gte: startOfDay,
            lte: endOfDay
          },
          endedAt: {
            not: null
          }
        },
        orderBy: {
          startedAt: 'asc'
        },
        select: {
          id: true,
          startedAt: true,
          endedAt: true,
          durationSeconds: true,
          talkTimeSeconds: true
        }
      });

      if (calls.length === 0) {
        return this.createEmptyMetrics(agentId, date, agentSession);
      }

      // Calculate call metrics
      const totalCalls = calls.length;
      const totalCallTime = calls.reduce((sum, call) => sum + (call.durationSeconds || 0), 0);
      const totalTalkTime = calls.reduce((sum, call) => sum + (call.talkTimeSeconds || 0), 0);

      // Calculate gap metrics
      const gaps = this.calculateCallGaps(calls);
      const gapMetrics = this.analyzeGaps(gaps);

      // Calculate time distribution
      const loginTime = agentSession.loginAt;
      const logoutTime = agentSession.logoutAt;
      const totalLoggedTime = logoutTime ? 
        Math.floor((logoutTime.getTime() - loginTime.getTime()) / 1000) : 
        Math.floor((endOfDay.getTime() - loginTime.getTime()) / 1000);

      const totalWorkTime = totalTalkTime + gapMetrics.totalGapTime;

      // Calculate efficiency metrics
      const callsPerHour = totalLoggedTime > 0 ? (totalCalls * 3600) / totalLoggedTime : 0;
      const talkTimePercentage = totalLoggedTime > 0 ? (totalTalkTime / totalLoggedTime) * 100 : 0;
      const gapTimePercentage = totalWorkTime > 0 ? (gapMetrics.totalGapTime / totalWorkTime) * 100 : 0;
      const utilization = totalLoggedTime > 0 ? (totalWorkTime / totalLoggedTime) * 100 : 0;

      // Calculate productivity score (0-100)
      const productivityScore = this.calculateProductivityScore({
        callsPerHour,
        avgGapTime: gapMetrics.avgGapTime,
        talkTimePercentage,
        utilization
      });

      return {
        agentId,
        date,
        callMetrics: {
          totalCalls,
          totalCallTime,
          totalTalkTime,
          avgCallDuration: totalCalls > 0 ? totalCallTime / totalCalls : 0,
          avgTalkTime: totalCalls > 0 ? totalTalkTime / totalCalls : 0
        },
        gapMetrics,
        efficiency: {
          callsPerHour,
          talkTimePercentage,
          productivityScore,
          gapTimePercentage
        },
        timeDistribution: {
          loginTime,
          logoutTime,
          totalLoggedTime,
          totalWorkTime,
          utilization
        }
      };

    } catch (error) {
      this.deps.logger.error('Failed to calculate agent efficiency metrics', { 
        agentId, 
        date, 
        error 
      });
      throw error;
    }
  }

  /**
   * Calculate call gaps for consecutive calls
   */
  private calculateCallGaps(calls: any[]): CallGapAnalysis[] {
    const gaps: CallGapAnalysis[] = [];
    
    for (let i = 0; i < calls.length - 1; i++) {
      const currentCall = calls[i];
      const nextCall = calls[i + 1];
      
      if (currentCall.endedAt && nextCall.startedAt) {
        const gapDuration = Math.floor(
          (nextCall.startedAt.getTime() - currentCall.endedAt.getTime()) / 1000
        );
        
        // Only count positive gaps (filter out overlapping calls)
        if (gapDuration > 0) {
          gaps.push({
            agentId: currentCall.agentId,
            callSessionId: currentCall.id,
            callEndedAt: currentCall.endedAt,
            nextCallStartedAt: nextCall.startedAt,
            gapDuration,
            gapType: this.classifyGap(gapDuration),
            hourOfDay: currentCall.endedAt.getHours(),
            dayOfWeek: currentCall.endedAt.getDay()
          });
        }
      }
    }
    
    return gaps;
  }

  /**
   * Analyze gap statistics
   */
  private analyzeGaps(gaps: CallGapAnalysis[]) {
    if (gaps.length === 0) {
      return {
        totalGapTime: 0,
        avgGapTime: 0,
        gapCount: 0,
        minGapTime: 0,
        maxGapTime: 0,
        medianGapTime: 0
      };
    }

    const durations = gaps.map(g => g.gapDuration).sort((a, b) => a - b);
    const totalGapTime = durations.reduce((sum, duration) => sum + duration, 0);
    
    return {
      totalGapTime,
      avgGapTime: totalGapTime / gaps.length,
      gapCount: gaps.length,
      minGapTime: durations[0],
      maxGapTime: durations[durations.length - 1],
      medianGapTime: durations[Math.floor(durations.length / 2)]
    };
  }

  /**
   * Classify gap type based on duration
   */
  private classifyGap(gapDuration: number): 'normal' | 'extended' | 'break' | 'end_of_day' {
    if (gapDuration <= 120) return 'normal';        // 0-2 minutes
    if (gapDuration <= 600) return 'extended';      // 2-10 minutes  
    if (gapDuration <= 1800) return 'break';        // 10-30 minutes
    return 'end_of_day';                             // 30+ minutes
  }

  /**
   * Calculate productivity score (0-100) based on multiple factors
   */
  private calculateProductivityScore(metrics: {
    callsPerHour: number;
    avgGapTime: number;
    talkTimePercentage: number;
    utilization: number;
  }): number {
    // Define benchmarks
    const benchmarks = this.getEfficiencyBenchmarks();
    
    // Score components (0-25 each, total 100)
    const volumeScore = Math.min(25, (metrics.callsPerHour / benchmarks.excellent.minCallsPerHour) * 25);
    const gapScore = Math.max(0, 25 - (metrics.avgGapTime / benchmarks.excellent.maxGapTime) * 25);
    const talkTimeScore = Math.min(25, (metrics.talkTimePercentage / 60) * 25); // 60% is excellent
    const utilizationScore = Math.min(25, (metrics.utilization / 80) * 25); // 80% is excellent
    
    return Math.round(volumeScore + gapScore + talkTimeScore + utilizationScore);
  }

  /**
   * Get efficiency benchmarks for scoring
   */
  private getEfficiencyBenchmarks(): EfficiencyBenchmarks {
    return {
      excellent: { maxGapTime: 60, minCallsPerHour: 10 },
      good: { maxGapTime: 120, minCallsPerHour: 8 },
      average: { maxGapTime: 180, minCallsPerHour: 6 },
      needsImprovement: { maxGapTime: 300, minCallsPerHour: 4 }
    };
  }

  /**
   * Compare multiple agents for a given date range
   */
  async getAgentProductivityComparison(
    filters: AgentAnalyticsFilters
  ): Promise<AgentProductivityComparison[]> {
    try {
      const agentIds = filters.agentIds || await this.getAllActiveAgentIds();
      const comparisons: AgentProductivityComparison[] = [];

      // Get metrics for each agent
      for (const agentId of agentIds) {
        const metrics = await this.getAggregatedMetrics(agentId, filters);
        if (metrics && metrics.totalCalls >= (filters.minCallsThreshold || 1)) {
          const agent = await this.deps.prisma.agent.findUnique({
            where: { id: agentId },
            select: { firstName: true, lastName: true }
          });

          comparisons.push({
            agentId,
            agentName: agent ? `${agent.firstName} ${agent.lastName}` : `Agent ${agentId}`,
            rank: 0, // Will be calculated after sorting
            metrics: {
              avgGapTime: metrics.avgGapTime,
              callsPerHour: metrics.callsPerHour,
              talkTimeRatio: metrics.talkTimeRatio,
              productivityScore: metrics.productivityScore
            },
            percentileRanks: {
              gapTime: 0,
              callVolume: 0,
              efficiency: 0
            }
          });
        }
      }

      // Sort by productivity score and assign ranks
      comparisons.sort((a, b) => b.metrics.productivityScore - a.metrics.productivityScore);
      comparisons.forEach((comp, index) => {
        comp.rank = index + 1;
      });

      // Calculate percentile ranks
      this.calculatePercentileRanks(comparisons);

      return comparisons;

    } catch (error) {
      this.deps.logger.error('Failed to get agent productivity comparison', { filters, error });
      throw error;
    }
  }

  /**
   * Get live metrics for currently active agents
   */
  async getLiveAgentMetrics(): Promise<LiveAgentMetrics[]> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const activeSessions = await this.deps.prisma.agentSession.findMany({
        where: {
          loginAt: { gte: today },
          status: { in: ['available', 'on_call', 'break'] }
        },
        include: {
          agent: {
            select: { firstName: true, lastName: true }
          }
        }
      });

      const liveMetrics: LiveAgentMetrics[] = [];

      for (const session of activeSessions) {
        // Get today's call data
        const todaysCalls = await this.deps.prisma.callSession.findMany({
          where: {
            agentId: session.agentId,
            startedAt: { gte: today },
            endedAt: { not: null }
          },
          orderBy: { startedAt: 'asc' }
        });

        const gaps = this.calculateCallGaps(todaysCalls);
        const gapMetrics = this.analyzeGaps(gaps);
        
        const totalTalkTime = todaysCalls.reduce((sum, call) => sum + (call.talkTimeSeconds || 0), 0);
        const timeOnline = Math.floor((new Date().getTime() - session.loginAt.getTime()) / 1000);
        
        // Check for current gap
        let currentGap: { startedAt: Date; duration: number } | undefined;
        if (todaysCalls.length > 0 && session.status === 'available') {
          const lastCall = todaysCalls[todaysCalls.length - 1];
          if (lastCall.endedAt) {
            const gapStart = lastCall.endedAt;
            const currentGapDuration = Math.floor((new Date().getTime() - gapStart.getTime()) / 1000);
            if (currentGapDuration > 0) {
              currentGap = { startedAt: gapStart, duration: currentGapDuration };
            }
          }
        }

        const callsPerHour = timeOnline > 0 ? (todaysCalls.length * 3600) / timeOnline : 0;
        const productivity = this.calculateProductivityScore({
          callsPerHour,
          avgGapTime: gapMetrics.avgGapTime,
          talkTimePercentage: timeOnline > 0 ? (totalTalkTime / timeOnline) * 100 : 0,
          utilization: timeOnline > 0 ? ((totalTalkTime + gapMetrics.totalGapTime) / timeOnline) * 100 : 0
        });

        liveMetrics.push({
          agentId: session.agentId,
          currentStatus: session.status,
          todayStats: {
            callsToday: todaysCalls.length,
            talkTimeToday: totalTalkTime,
            avgGapTimeToday: gapMetrics.avgGapTime,
            currentGap
          },
          sessionStats: {
            loginTime: session.loginAt,
            timeOnline,
            productivity
          }
        });
      }

      return liveMetrics;

    } catch (error) {
      this.deps.logger.error('Failed to get live agent metrics', { error });
      throw error;
    }
  }

  // Helper methods
  private createEmptyMetrics(agentId: number, date: Date, session: any): AgentEfficiencyMetrics {
    const loginTime = session.loginAt;
    const logoutTime = session.logoutAt;
    const totalLoggedTime = logoutTime ? 
      Math.floor((logoutTime.getTime() - loginTime.getTime()) / 1000) : 0;

    return {
      agentId,
      date,
      callMetrics: {
        totalCalls: 0,
        totalCallTime: 0,
        totalTalkTime: 0,
        avgCallDuration: 0,
        avgTalkTime: 0
      },
      gapMetrics: {
        totalGapTime: 0,
        avgGapTime: 0,
        gapCount: 0,
        minGapTime: 0,
        maxGapTime: 0,
        medianGapTime: 0
      },
      efficiency: {
        callsPerHour: 0,
        talkTimePercentage: 0,
        productivityScore: 0,
        gapTimePercentage: 0
      },
      timeDistribution: {
        loginTime,
        logoutTime,
        totalLoggedTime,
        totalWorkTime: 0,
        utilization: 0
      }
    };
  }

  private async getAllActiveAgentIds(): Promise<number[]> {
    const agents = await this.deps.prisma.agent.findMany({
      where: { isActive: true },
      select: { id: true }
    });
    return agents.map(a => a.id);
  }

  private async getAggregatedMetrics(agentId: number, filters: AgentAnalyticsFilters) {
    // Implementation for aggregating metrics across date range
    // This would calculate averaged metrics across the date range
    const currentDate = new Date(filters.startDate);
    let totalMetrics: any = null;
    let dayCount = 0;

    while (currentDate <= filters.endDate) {
      const dayMetrics = await this.getAgentEfficiencyMetrics(agentId, new Date(currentDate));
      if (dayMetrics && dayMetrics.callMetrics.totalCalls > 0) {
        if (!totalMetrics) {
          totalMetrics = { ...dayMetrics };
        } else {
          // Aggregate metrics across days
          totalMetrics.callMetrics.totalCalls += dayMetrics.callMetrics.totalCalls;
          totalMetrics.gapMetrics.totalGapTime += dayMetrics.gapMetrics.totalGapTime;
          totalMetrics.gapMetrics.gapCount += dayMetrics.gapMetrics.gapCount;
          totalMetrics.efficiency.productivityScore += dayMetrics.efficiency.productivityScore;
        }
        dayCount++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (totalMetrics && dayCount > 0) {
      return {
        totalCalls: totalMetrics.callMetrics.totalCalls,
        avgGapTime: totalMetrics.gapMetrics.gapCount > 0 ? 
          totalMetrics.gapMetrics.totalGapTime / totalMetrics.gapMetrics.gapCount : 0,
        callsPerHour: totalMetrics.efficiency.callsPerHour,
        talkTimeRatio: totalMetrics.efficiency.talkTimePercentage,
        productivityScore: totalMetrics.efficiency.productivityScore / dayCount
      };
    }

    return null;
  }

  private calculatePercentileRanks(comparisons: AgentProductivityComparison[]) {
    const sortedByGapTime = [...comparisons].sort((a, b) => a.metrics.avgGapTime - b.metrics.avgGapTime);
    const sortedByVolume = [...comparisons].sort((a, b) => b.metrics.callsPerHour - a.metrics.callsPerHour);
    const sortedByEfficiency = [...comparisons].sort((a, b) => b.metrics.productivityScore - a.metrics.productivityScore);

    comparisons.forEach(comp => {
      comp.percentileRanks.gapTime = (sortedByGapTime.findIndex(c => c.agentId === comp.agentId) / comparisons.length) * 100;
      comp.percentileRanks.callVolume = (sortedByVolume.findIndex(c => c.agentId === comp.agentId) / comparisons.length) * 100;
      comp.percentileRanks.efficiency = (sortedByEfficiency.findIndex(c => c.agentId === comp.agentId) / comparisons.length) * 100;
    });
  }
} 
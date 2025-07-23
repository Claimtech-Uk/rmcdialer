import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Enhanced Scoring System Monitoring API
 * 
 * Provides comprehensive statistics and insights for the 0-200 scoring system
 */
export async function GET(request: NextRequest) {
  try {
    console.log('📊 Fetching enhanced scoring system statistics...');

    // Get current scoring distribution
    const scoreDistribution = await prisma.userCallScore.groupBy({
      by: ['currentScore'],
      where: { isActive: true },
      _count: { id: true },
      orderBy: { currentScore: 'asc' }
    });

    // Calculate score ranges according to spec
    const scoreRanges = {
      redHot: 0,    // 0-10: RED HOT (call immediately)
      warm: 0,      // 11-50: WARM (good prospects)
      lukewarm: 0,  // 51-100: LUKEWARM (still worth calling)
      cold: 0,      // 101-199: COLD (low priority)
      frozen: 0     // 200+: FROZEN (converted)
    };

    scoreDistribution.forEach(({ currentScore, _count }) => {
      if (currentScore <= 10) scoreRanges.redHot += _count.id;
      else if (currentScore <= 50) scoreRanges.warm += _count.id;
      else if (currentScore <= 100) scoreRanges.lukewarm += _count.id;
      else if (currentScore <= 199) scoreRanges.cold += _count.id;
      else scoreRanges.frozen += _count.id;
    });

    // Queue type distribution
    const queueDistribution = await prisma.userCallScore.groupBy({
      by: ['currentQueueType'],
      where: { isActive: true },
      _count: { id: true }
    });

    // Conversion statistics (last 24 hours)
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const conversions = await prisma.conversion.groupBy({
      by: ['conversionType'],
      where: { convertedAt: { gte: last24Hours } },
      _count: { id: true }
    });

    // Fresh starts (score resets) in last 24 hours  
    const freshStarts = await prisma.userCallScore.count({
      where: {
        lastResetDate: { gte: last24Hours },
        isActive: true
      }
    });

    // Average scores by queue type
    const avgScoresByQueue = await prisma.userCallScore.groupBy({
      by: ['currentQueueType'],
      where: { isActive: true },
      _avg: { currentScore: true },
      _count: { id: true }
    });

    // Daily aging impact (users whose scores increased today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const agedToday = await prisma.userCallScore.count({
      where: {
        updatedAt: { gte: today },
        isActive: true
      }
    });

    // Queue performance metrics
    const queueStats = await Promise.all([
      // Callbacks (always first priority)
      prisma.callQueue.count({
        where: { queueType: 'callback', status: 'pending' }
      }),
      // Regular queues
      prisma.callQueue.count({
        where: { 
          queueType: { in: ['unsigned_users', 'outstanding_requests'] },
          status: 'pending'
        }
      }),
      // Total active scores
      prisma.userCallScore.count({
        where: { isActive: true }
      }),
      // Inactive (safety net users)
      prisma.userCallScore.count({
        where: { isActive: false, currentScore: { lt: 200 } }
      })
    ]);

    const statistics = {
      systemOverview: {
        activeUsers: queueStats[2],
        inactiveUsers: queueStats[3],
        totalConversions: conversions.reduce((sum, c) => sum + c._count.id, 0),
        freshStartsToday: freshStarts,
        usersAgedToday: agedToday
      },
      scoreDistribution: {
        ranges: scoreRanges,
        totalActiveUsers: Object.values(scoreRanges).reduce((sum, count) => sum + count, 0)
      },
      queueMetrics: {
        callbacksQueue: queueStats[0],
        regularQueues: queueStats[1],
        distribution: queueDistribution.map(q => ({
          queueType: q.currentQueueType || 'unassigned',
          userCount: q._count.id
        })),
        averageScores: avgScoresByQueue.map(q => ({
          queueType: q.currentQueueType || 'unassigned',
          averageScore: Math.round((q._avg.currentScore || 0) * 100) / 100,
          userCount: q._count.id
        }))
      },
      conversions: {
        last24Hours: conversions.map(c => ({
          type: c.conversionType,
          count: c._count.id
        })),
        total: conversions.reduce((sum, c) => sum + c._count.id, 0)
      },
      systemHealth: {
        scoringDistributionHealthy: scoreRanges.redHot > 0 && scoreRanges.warm > 0,
        conversionRateHealthy: conversions.length > 0,
        queueBalanceHealthy: queueStats[0] + queueStats[1] > 0,
        safetyNetActive: queueStats[3] > 0 // Inactive users being tracked
      }
    };

    console.log(`✅ Generated scoring statistics: ${statistics.systemOverview.activeUsers} active users, ${statistics.conversions.total} conversions in 24h`);

    return NextResponse.json({
      success: true,
      timestamp: new Date(),
      statistics,
      summary: {
        hotLeads: scoreRanges.redHot,
        warmLeads: scoreRanges.warm + scoreRanges.lukewarm,
        coldLeads: scoreRanges.cold,
        conversions24h: statistics.conversions.total,
        systemStatus: Object.values(statistics.systemHealth).every(Boolean) ? 'healthy' : 'attention_needed'
      }
    });

  } catch (error: any) {
    console.error('❌ Failed to fetch scoring statistics:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch scoring statistics',
      details: error.message
    }, { status: 500 });
  }
} 
import { prisma } from '@/lib/db';
import { logger } from '@/modules/core/utils/logger.utils';

interface DailyAgingReport {
  timestamp: Date;
  usersAged: number;
  conversionsDetected: number;
  summary: string;
  isSkippedSunday: boolean;
}

/**
 * Daily Aging Service (Simplified)
 * 
 * 🎯 SEPARATED FROM DISCOVERY:
 * - Runs once per day (not every 15 minutes)
 * - Ages all user scores by +1 point
 * - Skips Sundays (no aging on rest day)
 * - Simple and efficient
 */
export class DailyAgingService {

  async runDailyAging(): Promise<DailyAgingReport> {
    logger.info('📅 Starting daily aging process...');
    
    const report: DailyAgingReport = {
      timestamp: new Date(),
      usersAged: 0,
      conversionsDetected: 0,
      summary: '',
      isSkippedSunday: false
    };

    // Check if today is Sunday (skip aging on rest day)
    const today = new Date();
    const isSunday = today.getDay() === 0;
    
    if (isSunday) {
      report.isSkippedSunday = true;
      report.summary = '🛑 Skipped aging - Sunday is rest day';
      logger.info(report.summary);
      return report;
    }

    try {
      // Get all users with scores < 200
      const activeUsers = await prisma.userCallScore.findMany({
        where: {
          currentScore: { lt: 200 }
        },
        select: {
          id: true,
          userId: true,
          currentScore: true
        }
      });

      logger.info(`📊 Found ${activeUsers.length} users to age`);

      let conversions = 0;
      let aged = 0;

      // Age each user's score
      for (const user of activeUsers) {
        const newScore = user.currentScore + 1;
        
        await prisma.userCallScore.update({
          where: { id: user.id },
          data: {
            currentScore: newScore
          }
        });
        
        aged++;
        
        if (newScore >= 200) {
          conversions++;
          logger.info(`🎯 User ${user.userId} reached score ${newScore}`);
        }
      }

      report.usersAged = aged;
      report.conversionsDetected = conversions;
      report.summary = `✅ Daily aging complete: ${aged} users aged, ${conversions} high scores detected`;
      
      logger.info(report.summary);
      
    } catch (error) {
      logger.error('❌ Daily aging failed:', error);
      report.summary = `❌ Daily aging failed: ${error}`;
    }

    return report;
  }
} 
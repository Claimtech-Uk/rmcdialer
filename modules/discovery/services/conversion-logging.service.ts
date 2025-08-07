// =============================================================================
// Conversion Logging Service - Discovery Module
// =============================================================================
// Shared service for logging conversions from queue services and cleanup crons

import { prisma } from '@/lib/db'
import { logger } from '@/modules/core'

export interface ConversionData {
  userId: bigint
  previousQueueType: 'unsigned_users' | 'outstanding_requests'
  conversionType: 'signature_obtained' | 'requirements_completed'
  conversionReason: string
  convertedAt?: Date
  source: 'pre_call_validation' | 'cleanup_cron'
}

/**
 * Conversion Logging Service
 * 
 * Provides centralized conversion logging logic with duplicate prevention
 * Used by both pre-call validation and cleanup services
 */
export class ConversionLoggingService {
  
  /**
   * Create a conversion record if one doesn't already exist
   */
  static async logConversion(data: ConversionData): Promise<boolean> {
    try {
      const { userId, previousQueueType, conversionType, conversionReason, convertedAt, source } = data

      // Check if a conversion already exists for this user within the last hour
      // to prevent race conditions between pre-call validation and cleanup crons
      const recentConversion = await prisma.conversion.findFirst({
        where: {
          userId,
          convertedAt: {
            gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
          }
        }
      });

      if (recentConversion) {
        logger.info(`⏭️ [SKIP] User ${userId} already has recent conversion ${recentConversion.id}, skipping duplicate from ${source}`);
        return false;
      }

      // Get user call score data for additional context
      const userCallScore = await prisma.userCallScore.findUnique({
        where: { userId },
        select: {
          currentScore: true,
          totalAttempts: true,
          lastCallAt: true
        }
      });

      // Create conversion record
      const conversion = await prisma.conversion.create({
        data: {
          userId,
          previousQueueType,
          conversionType,
          conversionReason,
          finalScore: userCallScore?.currentScore || 0,
          totalCallAttempts: userCallScore?.totalAttempts || 0,
          lastCallAt: userCallScore?.lastCallAt,
          signatureObtained: conversionType === 'signature_obtained' || previousQueueType === 'outstanding_requests',
          convertedAt: convertedAt || new Date()
        }
      });

      logger.info(`📝 [CONVERSION] Created ${conversionType} record for user ${userId} via ${source} (ID: ${conversion.id})`);
      return true;

    } catch (error: any) {
      logger.error(`❌ Failed to log conversion for user ${data.userId}:`, error);
      return false;
    }
  }

  /**
   * Check if user should get a conversion based on their queue transition
   */
  static shouldLogConversion(
    fromQueueType: 'unsigned_users' | 'outstanding_requests',
    toQueueType: string | null,
    userStatus: {
      hasSignature: boolean
      pendingRequirements: number
    }
  ): { shouldLog: boolean; conversionType?: ConversionData['conversionType']; reason?: string } {
    
    // Case 1: User moving from unsigned_users to null (got signature)
    if (fromQueueType === 'unsigned_users' && toQueueType === null && userStatus.hasSignature) {
      return {
        shouldLog: true,
        conversionType: 'signature_obtained',
        reason: 'User provided signature - moved from unsigned queue'
      };
    }

    // Case 2: User moving from outstanding_requests to null (completed requirements)
    if (fromQueueType === 'outstanding_requests' && toQueueType === null && userStatus.pendingRequirements === 0) {
      return {
        shouldLog: true,
        conversionType: 'requirements_completed',
        reason: 'All outstanding requirements have been fulfilled - user complete'
      };
    }

    return { shouldLog: false };
  }
}
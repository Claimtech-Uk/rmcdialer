// =============================================================================
// Queue Health Check Service - Health Module
// =============================================================================
// Comprehensive queue health checking with batch processing and timeout protection
// Follows patterns from LeadScoringService and QueueTypeBackfillMigrationService

import { prisma } from '@/lib/db';
import { replicaDb } from '@/lib/mysql';
import { logger } from '@/modules/core';
import type {
  HealthCheckOptions,
  QueueHealthResult,
  BatchResult,
  UserWithClaims,
  UserCallScoreData,
  HealthRecommendation,
  HealthServiceDependencies
} from '../types/health.types';

export class QueueHealthCheckService {
  
  // Configuration (following your established patterns)
  private readonly BATCH_SIZE = 200; // Sweet spot for cross-database queries
  private readonly MAX_EXECUTION_TIME = 25000; // 25 seconds max (like LeadScoringService)
  private readonly EXCLUDED_TYPES = [
    'signature',
    'vehicle_registration',
    'cfa',
    'solicitor_letter_of_authority',
    'letter_of_authority'
  ];
  private startTime: number = 0;

  constructor(private dependencies?: HealthServiceDependencies) {}

  /**
   * Run comprehensive queue health check with timeout protection
   * Follows the established pattern from your existing services
   */
  async runHealthCheck(options: HealthCheckOptions = {}): Promise<QueueHealthResult> {
    
    this.startTime = Date.now();
    const batchSize = options.batchSize || this.BATCH_SIZE;
    const offset = options.offset || 0;
    const dryRun = options.dryRun || false;
    
    logger.info('🏥 Starting queue health check with timeout protection...', {
      batchSize,
      offset,
      maxUsers: options.maxUsers,
      dryRun
    });
    
    const result: QueueHealthResult = {
      success: false,
      timestamp: new Date(),
      duration: 0,
      timeoutHit: false,
      batchesProcessed: 0,
      progress: { total: 0, processed: 0, percentage: 0 },
      stats: {
        checked: 0,
        updated: 0,
        correctQueue: 0,
        wrongQueue: 0,
        queueDistribution: {
          unsigned_users: 0,
          outstanding_requests: 0,
          none: 0
        },
        issues: {
          notInUserCallScores: 0,
          noQueueTypeAssigned: 0,
          wrongQueueType: 0,
          markedInactive: 0,
          inCooldown: 0,
          shouldBeInQueue: 0,
          alreadyInQueue: 0
        }
      },
      summary: ''
    };

    // Log execution start (following cron pattern)
    await this.logCronExecution('queue-health-check', 'running', 0, {
      message: 'Queue health check started',
      batchSize,
      offset,
      maxUsers: options.maxUsers,
      dryRun
    });

    try {
      // Step 1: Get total count of non-cancelled users (fast query)
      const totalUsers = await replicaDb.user.count({
        where: { 
          status: { not: 'cancelled' },
          is_enabled: true,
          phone_number: { not: null },
          first_name: { not: null }
        }
      });
      
      result.progress.total = Math.min(totalUsers, options.maxUsers || totalUsers);
      
      logger.info(`📊 Found ${totalUsers} total enabled users to check`);
      
      if (totalUsers === 0) {
        result.success = true;
        result.summary = '✅ No users found to check - system is healthy';
        await this.logHealthCheckResult(result, options);
        return result;
      }

      // Step 2: Process in batches with timeout protection
      let processedCount = 0;
      let batchCount = 0;
      const limit = options.maxUsers || totalUsers;

      while (processedCount < limit && !this.isTimeoutApproaching()) {
        const currentOffset = offset + processedCount;
        const currentBatchSize = Math.min(batchSize, limit - processedCount);

        logger.info(`🔍 [BATCH ${batchCount + 1}] Checking users ${currentOffset + 1}-${currentOffset + currentBatchSize}`);

        const batchResult = await this.processBatch(currentOffset, currentBatchSize, dryRun);
        
        // Accumulate results
        this.accumulateResults(result, batchResult);
        
        processedCount += currentBatchSize;
        batchCount++;
        result.batchesProcessed = batchCount;
        result.progress.processed = processedCount;
        result.progress.percentage = Math.round((processedCount / limit) * 100);

        logger.info(`✅ [BATCH ${batchCount}] Complete: ${batchResult.updated} users needed updates out of ${batchResult.checked} checked`);
        logger.info(`📈 [PROGRESS] ${processedCount}/${limit} users processed (${result.progress.percentage}%)`);

        // Small delay to prevent database overload (following your pattern)
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Step 3: Generate recommendations and summary
      result.recommendations = this.generateRecommendations(result.stats);
      result.timeoutHit = this.isTimeoutApproaching();
      result.success = true;
      result.summary = this.generateSummary(result);
      
      // Step 4: Store result in database for historical analysis
      await this.logHealthCheckResult(result, options);
      
    } catch (error) {
      logger.error('❌ Queue health check failed:', error);
      result.success = false;
      result.summary = `❌ Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      
      // Log failure
      await this.logCronExecution('queue-health-check', 'failed', Date.now() - this.startTime, {
        error: error instanceof Error ? error.message : 'Unknown error',
        processedCount: result.progress.processed
      }, error instanceof Error ? error.message : 'Unknown error');
      
    } finally {
      result.duration = Date.now() - this.startTime;
      logger.info(`🏁 Queue health check completed in ${result.duration}ms`);
    }

    return result;
  }

  /**
   * Process a batch of users - core business logic
   */
  private async processBatch(offset: number, batchSize: number, dryRun: boolean): Promise<BatchResult> {
    const result: BatchResult = {
      checked: 0,
      updated: 0,
      correctQueue: 0,
      wrongQueue: 0,
      userChanges: [],
      issues: {
        notInUserCallScores: 0,
        noQueueTypeAssigned: 0,
        wrongQueueType: 0,
        markedInactive: 0,
        inCooldown: 0,
        shouldBeInQueue: 0,
        alreadyInQueue: 0
      },
      queueDistribution: {
        unsigned_users: 0,
        outstanding_requests: 0,
        none: 0
      }
    };

    try {
      // Get batch of users with all related data (following your include pattern)
      const users = await replicaDb.user.findMany({
        where: { 
          status: { not: 'cancelled' },
          is_enabled: true,
          phone_number: { not: null },
          first_name: { not: null }
        },
        include: {
          claims: {
            include: {
              requirements: {
                where: { status: 'PENDING' }
              }
            }
          }
        },
        skip: offset,
        take: batchSize,
        orderBy: { id: 'asc' }
      });

      if (users.length === 0) {
        return result;
      }

      // Get current queue types for these users (batch query for efficiency)
      const userIds = users.map(u => u.id);
      const currentQueues = await prisma.userCallScore.findMany({
        where: { userId: { in: userIds } },
        select: { 
          userId: true, 
          currentQueueType: true,
          isActive: true,
          nextCallAfter: true,
          createdAt: true
        }
      });
      
      const queueMap = new Map(currentQueues.map(q => [q.userId, q]));

      // Process each user with your exact business logic
      for (const user of users) {
        result.checked++;
        
        const correctQueue = this.determineCorrectQueue(user as any);
        const currentQueueData = queueMap.get(user.id);
        const currentQueue = currentQueueData?.currentQueueType || null;
        
        // Count distribution
        const queueKey = correctQueue || 'none';
        result.queueDistribution[queueKey]++;
        
        // Categorize the user's situation (focused on user_call_scores only)
        if (!currentQueueData) {
          result.issues.notInUserCallScores++;
        } else if (!currentQueueData.currentQueueType && correctQueue) {
          result.issues.noQueueTypeAssigned++;
        } else if (currentQueueData.currentQueueType !== correctQueue) {
          result.issues.wrongQueueType++;
        } else if (!currentQueueData.isActive) {
          result.issues.markedInactive++;
        } else if (currentQueueData.nextCallAfter && currentQueueData.nextCallAfter > new Date()) {
          result.issues.inCooldown++;
        } else if (currentQueueData.createdAt > new Date(Date.now() - 2 * 60 * 60 * 1000)) {
          result.issues.inCooldown++; // 2-hour cooling period
        } else {
          result.issues.alreadyInQueue++;
        }
        
        // Determine if update is needed
        if (correctQueue !== currentQueue) {
          result.wrongQueue++;
          
          // Only update via universal transition if not dry run
          if (!dryRun) {
            if (currentQueueData) {
              const { universalQueueTransitionService } = await import('@/modules/queue/services/universal-queue-transition.service');
              await universalQueueTransitionService.transitionUserQueue({
                userId: Number(user.id),
                fromQueue: currentQueue,
                toQueue: correctQueue,
                reason: 'Queue health correction',
                source: 'queue_health_check'
              });
            } else if (correctQueue) {
              // User missing from user_call_scores - create record with correct queue type (no transition available)
              await prisma.userCallScore.create({
                data: {
                  userId: user.id,
                  currentScore: 0,
                  currentQueueType: correctQueue,
                  isActive: true,
                  lastQueueCheck: new Date(),
                  createdAt: new Date(),
                  updatedAt: new Date()
                }
              });
            }
          }
          result.updated++;
        } else {
          result.correctQueue++;
        }
      }

    } catch (error) {
      logger.error(`❌ Error processing batch at offset ${offset}:`, error);
      throw error;
    }

    return result;
  }

  /**
   * Determine correct queue for a user - your exact business logic
   */
  private determineCorrectQueue(user: UserWithClaims): 'unsigned_users' | 'outstanding_requests' | null {
    // 1. User cancelled → no queue
    if (user.status === 'cancelled' || user.status === null) return null;
    
    // 2. All claims cancelled → no queue
    if (user.claims.length > 0 && user.claims.every(claim => claim.status === 'cancelled')) {
      return null;
    }
    
    // 3. Missing signature → unsigned queue (HIGHEST PRIORITY)
    // ⚠️  FIXED: Align with UserService logic (userData.current_signature_file_id !== null)
    // This treats empty string as "has signature" like the authoritative UserService
    const hasSignature = user.current_signature_file_id !== null;
    if (!hasSignature) {
      return 'unsigned_users';
    }
    
    // 4. Has signature → check for outstanding requirements
    const validRequirements = this.countValidRequirements(user.claims);
    if (validRequirements > 0) {
      return 'outstanding_requests';
    }
    
    // 5. All good → no queue needed
    return null;
  }

  /**
   * Count valid requirements (excluding filtered types) - your exact logic
   */
  private countValidRequirements(claims: any[]): number {
    return claims.reduce((acc, claim) => {
      if (claim.status === 'cancelled') return acc; // Skip cancelled claims
      
      const validReqs = claim.requirements.filter((req: any) => {
        if (req.status !== 'PENDING') return false;
        
        // Exclude standard types
        if (this.EXCLUDED_TYPES.includes(req.type || '')) return false;
        
        // Exclude id_document with specific reason
        if (req.type === 'id_document' && 
            req.claim_requirement_reason === 'base requirement for claim.') {
          return false;
        }
        
        return true;
      });
      
      return acc + validReqs.length;
    }, 0);
  }

  /**
   * Check if approaching timeout (following your established pattern)
   */
  private isTimeoutApproaching(): boolean {
    const elapsed = Date.now() - this.startTime;
    return elapsed > this.MAX_EXECUTION_TIME;
  }

  /**
   * Accumulate batch results into main result
   */
  private accumulateResults(mainResult: QueueHealthResult, batchResult: BatchResult): void {
    mainResult.stats.checked += batchResult.checked;
    mainResult.stats.updated += batchResult.updated;
    mainResult.stats.correctQueue += batchResult.correctQueue;
    mainResult.stats.wrongQueue += batchResult.wrongQueue;
    
            // Queue distribution
        Object.keys(batchResult.queueDistribution).forEach(queue => {
          const queueKey = queue as keyof typeof batchResult.queueDistribution;
          mainResult.stats.queueDistribution[queueKey] += batchResult.queueDistribution[queueKey];
        });
        
        // Issues breakdown
        Object.keys(batchResult.issues).forEach(issue => {
          const issueKey = issue as keyof typeof batchResult.issues;
          mainResult.stats.issues[issueKey] += batchResult.issues[issueKey];
        });
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(stats: QueueHealthResult['stats']): HealthRecommendation[] {
    const recommendations: HealthRecommendation[] = [];
    
    if (stats.issues.notInUserCallScores > 0) {
      recommendations.push({
        issue: 'Users not in user_call_scores',
        count: stats.issues.notInUserCallScores,
        action: 'Run lead scoring service: /api/cron/scoring-maintenance',
        priority: 'high'
      });
    }
    
    if (stats.issues.noQueueTypeAssigned > 0) {
      recommendations.push({
        issue: 'Users missing queue type',
        count: stats.issues.noQueueTypeAssigned,
        action: 'Run queue type backfill: /api/migration/queue-type-backfill',
        priority: 'high'
      });
    }
    
    if (stats.issues.notInUserCallScores > 0) {
      recommendations.push({
        issue: 'Users missing from user_call_scores completely',
        count: stats.issues.notInUserCallScores,
        action: 'Will be auto-created with correct queue type during fix',
        priority: 'medium'
      });
    }

    if (stats.issues.wrongQueueType > 0) {
      recommendations.push({
        issue: 'Users in wrong queue type',
        count: stats.issues.wrongQueueType,
        action: 'Review queue classification logic',
        priority: 'medium'
      });
    }

    return recommendations;
  }

  /**
   * Generate summary message
   */
  private generateSummary(result: QueueHealthResult): string {
    const { stats } = result;
    const updatePercentage = stats.checked > 0 ? ((stats.updated / stats.checked) * 100).toFixed(1) : '0.0';
    
    return `🏥 Health Check Complete: ${stats.checked} users checked, ${stats.updated} needed updates (${updatePercentage}%). Distribution: ${stats.queueDistribution.unsigned_users} unsigned, ${stats.queueDistribution.outstanding_requests} outstanding, ${stats.queueDistribution.none} complete.`;
  }

  /**
   * Store health check result in database (following your established pattern)
   */
  private async logHealthCheckResult(result: QueueHealthResult, options: HealthCheckOptions): Promise<void> {
    try {
      await prisma.$executeRaw`
        INSERT INTO queue_health_check_results (
          executed_at, duration_ms, success, timeout_hit, batches_processed,
          batch_size, start_offset, max_users_limit, dry_run,
          total_checked, total_updated, correct_queue_count, wrong_queue_count,
          unsigned_users_count, outstanding_requests_count, no_queue_count,
          not_in_user_call_scores, no_queue_type_assigned, wrong_queue_type,
          marked_inactive, in_cooldown, should_be_in_queue, already_in_queue,
          full_result, summary_message, next_offset, can_resume
        ) VALUES (
          ${result.timestamp},
          ${result.duration},
          ${result.success},
          ${result.timeoutHit},
          ${result.batchesProcessed},
          ${options.batchSize || this.BATCH_SIZE},
          ${options.offset || 0},
          ${options.maxUsers || null},
          ${options.dryRun || false},
          ${result.stats.checked},
          ${result.stats.updated},
          ${result.stats.correctQueue},
          ${result.stats.wrongQueue},
          ${result.stats.queueDistribution.unsigned_users},
          ${result.stats.queueDistribution.outstanding_requests},
          ${result.stats.queueDistribution.none},
          ${result.stats.issues.notInUserCallScores},
          ${result.stats.issues.noQueueTypeAssigned},
          ${result.stats.issues.wrongQueueType},
          ${result.stats.issues.markedInactive},
          ${result.stats.issues.inCooldown},
          ${result.stats.issues.shouldBeInQueue},
          ${result.stats.issues.alreadyInQueue},
          ${JSON.stringify(result)}::jsonb,
          ${result.summary},
          ${result.timeoutHit ? (options.offset || 0) + result.progress.processed : null},
          ${result.timeoutHit}
        )
      `;
      
      logger.info('✅ [DB LOG] Health check result stored in database');
      
    } catch (error) {
      logger.error('❌ Failed to log health check result to database:', error);
      // Don't throw - this is just logging
    }
  }

  /**
   * Cron execution logging (following your established pattern)
   */
  private async logCronExecution(jobName: string, status: 'running' | 'success' | 'failed', duration: number, details: any, error?: string) {
    try {
      const logData = {
        job_name: jobName,
        status,
        duration_ms: duration,
        details,
        executed_at: new Date().toISOString(),
        error: error || null
      };
      
      console.log(`📊 [CRON LOG] ${jobName}:`, logData);
      
      // Future: Store in your planned cron_execution_log table
      // await prisma.cronExecutionLog.create({ data: logData });
      
    } catch (logError) {
      console.error('Failed to log cron execution:', logError);
    }
  }
}

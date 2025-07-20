import { replicaDb } from '@/lib/mysql';
import { prisma } from '@/lib/db';
import type { QueueType } from '@/modules/queue/types/queue.types';
import { logger } from '@/modules/core/utils/logger.utils';

interface QueueDiscoveryResult {
  queueType: QueueType;
  discovered: number;
  added: number;
  skipped: number;
  errors: number;
  duration: number;
}

interface QueueDiscoveryReport {
  timestamp: Date;
  totalDiscovered: number;
  totalAdded: number;
  results: QueueDiscoveryResult[];
  summary: string;
}

/**
 * Queue Discovery Service
 * 
 * Automatically discovers eligible users from MySQL replica and populates
 * PostgreSQL queues for agent calling. Runs hourly to ensure fresh leads.
 */
export class QueueDiscoveryService {
  
  /**
   * Run complete queue discovery for all queue types
   * This is the main method called by the hourly cron job
   */
  async runHourlyDiscovery(): Promise<QueueDiscoveryReport> {
    const startTime = Date.now();
    logger.info('🔍 Starting hourly queue discovery...');
    
    const results: QueueDiscoveryResult[] = [];
    
    try {
      // Discover unsigned users
      const unsignedResult = await this.discoverUnsignedUsers();
      results.push(unsignedResult);
      
      // Discover outstanding requests
      const outstandingResult = await this.discoverOutstandingRequests();
      results.push(outstandingResult);
      
      // Note: Callbacks are managed separately through the callback scheduling system
      
      const totalDuration = Date.now() - startTime;
      const totalDiscovered = results.reduce((sum, r) => sum + r.discovered, 0);
      const totalAdded = results.reduce((sum, r) => sum + r.added, 0);
      
      const report: QueueDiscoveryReport = {
        timestamp: new Date(),
        totalDiscovered,
        totalAdded,
        results,
        summary: `Discovered ${totalDiscovered} leads, added ${totalAdded} to queues in ${Math.round(totalDuration / 1000)}s`
      };
      
      logger.info(`✅ Hourly discovery completed: ${report.summary}`);
      return report;
      
    } catch (error) {
      logger.error('❌ Hourly discovery failed:', error);
      throw error;
    }
  }
  
  /**
   * Discover eligible unsigned users from MySQL replica
   */
  async discoverUnsignedUsers(limit: number = 50): Promise<QueueDiscoveryResult> {
    const startTime = Date.now();
    logger.info('📋 Discovering unsigned users...');
    
    try {
      // Find users who need signatures
      const eligibleUsers = await replicaDb.user.findMany({
        where: {
          is_enabled: true,
          current_signature_file_id: null,
          claims: {
            some: {
              status: { not: 'complete' }
            }
          }
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
        orderBy: { created_at: 'desc' }, // Newest users first
        take: limit
      });
      
      // Filter out users already in queue
      const existingQueueUserIds = await prisma.callQueue.findMany({
        where: { queueType: 'unsigned_users' },
        select: { userId: true }
      }).then((entries: { userId: bigint }[]) => entries.map((e: { userId: bigint }) => e.userId));
      
      const newUsers = eligibleUsers.filter(user => 
        !existingQueueUserIds.includes(user.id)
      );
      
      // Add new users to queue
      let added = 0;
      let skipped = 0;
      let errors = 0;
      
      for (let i = 0; i < newUsers.length; i++) {
        const user = newUsers[i];
        
        try {
          const pendingRequirements = user.claims.reduce((acc, claim) => 
            acc + claim.requirements.length, 0
          );
          
          // Calculate priority score (lower = higher priority)
          // New users get higher priority than existing users
          const priorityScore = i * 10;
          
          await prisma.callQueue.create({
            data: {
              userId: user.id,
              claimId: user.claims[0]?.id || null,
              queueType: 'unsigned_users',
              priorityScore,
              queuePosition: await this.getNextQueuePosition('unsigned_users'),
              status: 'pending',
              queueReason: 'Missing signature to proceed with claim',
              availableFrom: new Date(),
              createdAt: new Date(),
              updatedAt: new Date()
            }
          });
          
          added++;
          logger.debug(`✅ Added unsigned user ${user.id} (${user.first_name} ${user.last_name}) to queue`);
          
        } catch (error) {
          errors++;
          logger.error(`❌ Failed to add unsigned user ${user.id} to queue:`, error);
        }
      }
      
      const duration = Date.now() - startTime;
      
      const result: QueueDiscoveryResult = {
        queueType: 'unsigned_users',
        discovered: eligibleUsers.length,
        added,
        skipped,
        errors,
        duration
      };
      
      logger.info(`📋 Unsigned users discovery: ${result.discovered} found, ${result.added} added, ${result.errors} errors`);
      return result;
      
    } catch (error) {
      logger.error('❌ Failed to discover unsigned users:', error);
      throw error;
    }
  }
  
  /**
   * Discover users with outstanding requirements from MySQL replica
   */
  async discoverOutstandingRequests(limit: number = 50): Promise<QueueDiscoveryResult> {
    const startTime = Date.now();
    logger.info('📋 Discovering outstanding requests...');
    
    try {
      // Find users with signatures but pending requirements
      const eligibleUsers = await replicaDb.user.findMany({
        where: {
          is_enabled: true,
          current_signature_file_id: { not: null },
          claims: {
            some: {
              requirements: {
                some: {
                  status: 'PENDING'
                }
              }
            }
          }
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
        orderBy: { updated_at: 'desc' }, // Recently updated first
        take: limit
      });
      
      // Filter out users already in queue
      const existingQueueUserIds = await prisma.callQueue.findMany({
        where: { queueType: 'outstanding_requests' },
        select: { userId: true }
      }).then((entries: { userId: bigint }[]) => entries.map((e: { userId: bigint }) => e.userId));
      
      const newUsers = eligibleUsers.filter(user => 
        !existingQueueUserIds.includes(user.id)
      );
      
      // Add new users to queue
      let added = 0;
      let skipped = 0;
      let errors = 0;
      
      for (let i = 0; i < newUsers.length; i++) {
        const user = newUsers[i];
        
        try {
          const pendingRequirements = user.claims.reduce((acc, claim) => 
            acc + claim.requirements.length, 0
          );
          
          // Calculate priority score based on requirement count and urgency
          // More requirements = higher priority (lower score)
          const priorityScore = Math.max(1, 100 - (pendingRequirements * 10)) + i;
          
          await prisma.callQueue.create({
            data: {
              userId: user.id,
              claimId: user.claims[0]?.id || null,
              queueType: 'outstanding_requests',
              priorityScore,
              queuePosition: await this.getNextQueuePosition('outstanding_requests'),
              status: 'pending',
              queueReason: `${pendingRequirements} pending requirement(s)`,
              availableFrom: new Date(),
              createdAt: new Date(),
              updatedAt: new Date()
            }
          });
          
          added++;
          logger.debug(`✅ Added outstanding requests user ${user.id} (${user.first_name} ${user.last_name}) to queue`);
          
        } catch (error) {
          errors++;
          logger.error(`❌ Failed to add outstanding requests user ${user.id} to queue:`, error);
        }
      }
      
      const duration = Date.now() - startTime;
      
      const result: QueueDiscoveryResult = {
        queueType: 'outstanding_requests',
        discovered: eligibleUsers.length,
        added,
        skipped,
        errors,
        duration
      };
      
      logger.info(`📋 Outstanding requests discovery: ${result.discovered} found, ${result.added} added, ${result.errors} errors`);
      return result;
      
    } catch (error) {
      logger.error('❌ Failed to discover outstanding requests:', error);
      throw error;
    }
  }
  
  /**
   * Clean up invalid queue entries (users no longer eligible)
   */
  async cleanupInvalidQueueEntries(): Promise<{ removed: number; queueType: QueueType }[]> {
    logger.info('🧹 Cleaning up invalid queue entries...');
    
    const results: { removed: number; queueType: QueueType }[] = [];
    
    try {
      // Clean unsigned_users queue
      const invalidUnsigned = await prisma.callQueue.findMany({
        where: { queueType: 'unsigned_users' },
        select: { id: true, userId: true }
      });
      
      let removedUnsigned = 0;
      for (const entry of invalidUnsigned) {
        // Check if user still needs signature
        const user = await replicaDb.user.findUnique({
          where: { id: entry.userId },
          select: { is_enabled: true, current_signature_file_id: true }
        });
        
        if (!user || !user.is_enabled || user.current_signature_file_id !== null) {
          await prisma.callQueue.delete({ where: { id: entry.id } });
          removedUnsigned++;
        }
      }
      
      results.push({ removed: removedUnsigned, queueType: 'unsigned_users' });
      
      // Clean outstanding_requests queue
      const invalidOutstanding = await prisma.callQueue.findMany({
        where: { queueType: 'outstanding_requests' },
        select: { id: true, userId: true }
      });
      
      let removedOutstanding = 0;
      for (const entry of invalidOutstanding) {
        // Check if user still has pending requirements
        const userWithClaims = await replicaDb.user.findUnique({
          where: { id: entry.userId },
          include: {
            claims: {
              include: {
                requirements: {
                  where: { status: 'PENDING' }
                }
              }
            }
          }
        });
        
        const pendingCount = userWithClaims?.claims.reduce((acc, claim) => 
          acc + claim.requirements.length, 0
        ) || 0;
        
        if (!userWithClaims || !userWithClaims.is_enabled || 
            !userWithClaims.current_signature_file_id || pendingCount === 0) {
          await prisma.callQueue.delete({ where: { id: entry.id } });
          removedOutstanding++;
        }
      }
      
      results.push({ removed: removedOutstanding, queueType: 'outstanding_requests' });
      
      logger.info(`🧹 Cleanup completed: ${removedUnsigned} unsigned, ${removedOutstanding} outstanding requests removed`);
      return results;
      
    } catch (error) {
      logger.error('❌ Queue cleanup failed:', error);
      throw error;
    }
  }
  
  /**
   * Get next available queue position for a queue type
   */
  private async getNextQueuePosition(queueType: QueueType): Promise<number> {
    const maxPosition = await prisma.callQueue.findFirst({
      where: { queueType },
      orderBy: { queuePosition: 'desc' },
      select: { queuePosition: true }
    });
    
    return (maxPosition?.queuePosition || 0) + 1;
  }
} 
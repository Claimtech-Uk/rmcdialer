import { NextResponse } from 'next/server';
import { replicaDb } from '@/lib/mysql';
import { prisma } from '@/lib/db';
import type { QueueType } from '@/modules/queue/types/queue.types';

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const queueTypeParam = searchParams.get('queueType') as QueueType | null;
    const limitParam = searchParams.get('limit') || '10';
    const limit = parseInt(limitParam);

    console.log(`🔄 Populating queue with ${limit} users...`);
    
    const results: any = {
      timestamp: new Date().toISOString(),
      populated: []
    };

    // If specific queue type is requested, populate just that queue
    const queueTypes: QueueType[] = queueTypeParam ? [queueTypeParam] : ['unsigned_users', 'outstanding_requests'];

    for (const queueType of queueTypes) {
      console.log(`📋 Populating ${queueType} queue...`);
      
      let users: any[] = [];
      
      if (queueType === 'unsigned_users') {
        // Get unsigned users from MySQL replica
        users = await replicaDb.user.findMany({
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
          take: limit
        });
      } else if (queueType === 'outstanding_requests') {
        // Get users with pending requirements but have signatures
        users = await replicaDb.user.findMany({
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
          take: limit
        });
      }

      // Clear existing queue entries for this queue type
      await prisma.callQueue.deleteMany({
        where: { queueType }
      });

      // Add users to PostgreSQL queue
      const queueEntries = [];
      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        const pendingRequirements = user.claims.reduce((acc: number, claim: any) => 
          acc + claim.requirements.length, 0
        );

        // Calculate simple priority score (lower = higher priority)
        const priorityScore = i * 10 + (pendingRequirements > 0 ? 0 : 50);

        const queueEntry = {
          userId: user.id,
          claimId: user.claims[0]?.id || null,
          queueType,
          priorityScore,
          queuePosition: i + 1,
          status: 'pending' as const,
          queueReason: queueType === 'unsigned_users' 
            ? 'Missing signature to proceed with claim'
            : `${pendingRequirements} pending requirement(s)`,
          availableFrom: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        };

        queueEntries.push(queueEntry);
      }

      if (queueEntries.length > 0) {
        await prisma.callQueue.createMany({
          data: queueEntries
        });
      }

      results.populated.push({
        queueType,
        usersAdded: queueEntries.length,
        sampleUsers: users.slice(0, 3).map(user => ({
          userId: Number(user.id),
          firstName: user.first_name,
          lastName: user.last_name,
          hasSignature: !!user.current_signature_file_id,
          pendingRequirements: user.claims.reduce((acc: number, claim: any) => 
            acc + claim.requirements.length, 0
          )
        }))
      });

      console.log(`✅ Added ${queueEntries.length} users to ${queueType} queue`);
    }

    console.log('✅ Queue population completed successfully');
    
    return NextResponse.json({
      success: true,
      message: 'Queue populated successfully',
      results,
      usage: {
        populateSpecificQueue: 'Add ?queueType=unsigned_users to populate specific queue',
        setLimit: 'Add &limit=5 to limit number of users added',
        populateAll: 'No parameters to populate all queue types'
      }
    });

  } catch (error: any) {
    console.error('❌ Queue population failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      details: error.stack,
      timestamp: new Date().toISOString(),
      message: 'Queue population failed'
    }, { status: 500 });
  }
} 
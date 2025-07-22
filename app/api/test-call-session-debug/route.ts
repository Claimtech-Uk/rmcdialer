import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { replicaDb } from '@/lib/mysql';

export async function GET() {
  const debugResults = {
    timestamp: new Date().toISOString(),
    sessionId: 'call_1753175877063_5777',
    userId: 5777,
    tests: [] as any[]
  };

  try {
    console.log('🔧 [DEBUG] Starting call session debug tests...');

    // Test 1: Check if call session exists in PostgreSQL
    const test1Start = Date.now();
    try {
      const callSession = await prisma.callSession.findUnique({
        where: { id: 'call_1753175877063_5777' },
        include: {
          agent: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });

      debugResults.tests.push({
        test: 'PostgreSQL Call Session Lookup',
        duration: Date.now() - test1Start,
        status: callSession ? 'SUCCESS' : 'NOT_FOUND',
        result: callSession ? {
          sessionId: callSession.id,
          userId: Number(callSession.userId),
          agentId: callSession.agentId,
          status: callSession.status,
          direction: callSession.direction,
          startedAt: callSession.startedAt,
          agentName: `${callSession.agent.firstName} ${callSession.agent.lastName}`
        } : null
      });
    } catch (error: any) {
      debugResults.tests.push({
        test: 'PostgreSQL Call Session Lookup',
        duration: Date.now() - test1Start,
        status: 'ERROR',
        error: error.message
      });
    }

    // Test 2: Check if user exists in MySQL replica
    const test2Start = Date.now();
    try {
      const user = await replicaDb.user.findUnique({
        where: { id: BigInt(5777) },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          phone_number: true,
          email_address: true,
          is_enabled: true,
          status: true,
          current_signature_file_id: true
        }
      });

      debugResults.tests.push({
        test: 'MySQL Replica User Lookup',
        duration: Date.now() - test2Start,
        status: user ? 'SUCCESS' : 'NOT_FOUND',
        result: user ? {
          userId: Number(user.id),
          name: `${user.first_name} ${user.last_name}`,
          phone: user.phone_number,
          email: user.email_address,
          enabled: user.is_enabled,
          status: user.status,
          hasSignature: !!user.current_signature_file_id
        } : null
      });
    } catch (error: any) {
      debugResults.tests.push({
        test: 'MySQL Replica User Lookup',
        duration: Date.now() - test2Start,
        status: 'ERROR',
        error: error.message
      });
    }

    // Test 3: Test getUserContext directly with timeout
    const test3Start = Date.now();
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('getUserContext timeout after 10 seconds')), 10000)
      );

      const getUserContextPromise = (async () => {
        const { UserService } = await import('@/modules/users/services/user.service');
        const userService = new UserService();
        return await userService.getUserCallContext(5777);
      })();

      const userContext = await Promise.race([getUserContextPromise, timeoutPromise]);

             debugResults.tests.push({
         test: 'getUserContext with Timeout',
         duration: Date.now() - test3Start,
         status: userContext ? 'SUCCESS' : 'NULL_RESULT',
         result: userContext ? {
           userId: (userContext as any).user.id,
           name: `${(userContext as any).user.firstName} ${(userContext as any).user.lastName}`,
           phone: (userContext as any).user.phoneNumber,
           claimsCount: (userContext as any).claims.length,
           requirementsCount: (userContext as any).claims.reduce((acc: number, c: any) => acc + c.requirements.length, 0),
           callScore: (userContext as any).callScore
         } : null
       });
    } catch (error: any) {
      debugResults.tests.push({
        test: 'getUserContext with Timeout',
        duration: Date.now() - test3Start,
        status: 'ERROR',
        error: error.message
      });
    }

    // Test 4: Check for current agent session conflicts
    const test4Start = Date.now();
    try {
      const agentSessions = await prisma.agentSession.findMany({
        where: {
          currentCallSessionId: 'call_1753175877063_5777'
        },
        include: {
          agent: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });

      debugResults.tests.push({
        test: 'Agent Session Conflicts',
        duration: Date.now() - test4Start,
        status: 'SUCCESS',
        result: {
          conflictingAgents: agentSessions.map(session => ({
            agentId: session.agentId,
            agentName: `${session.agent.firstName} ${session.agent.lastName}`,
            status: session.status,
            lastActivity: session.lastActivity
          }))
        }
      });
    } catch (error: any) {
      debugResults.tests.push({
        test: 'Agent Session Conflicts',
        duration: Date.now() - test4Start,
        status: 'ERROR',
        error: error.message
      });
    }

    // Test 5: Check for user locks in queue
    const test5Start = Date.now();
    try {
      const queueEntries = await prisma.callQueue.findMany({
        where: {
          userId: BigInt(5777),
          status: { in: ['pending', 'assigned'] }
        }
      });

      debugResults.tests.push({
        test: 'User Queue Locks',
        duration: Date.now() - test5Start,
        status: 'SUCCESS',
        result: {
          activeQueueEntries: queueEntries.length,
          entries: queueEntries.map(entry => ({
            id: entry.id,
            queueType: entry.queueType,
            status: entry.status,
            assignedToAgentId: entry.assignedToAgentId,
            createdAt: entry.createdAt
          }))
        }
      });
    } catch (error: any) {
      debugResults.tests.push({
        test: 'User Queue Locks',
        duration: Date.now() - test5Start,
        status: 'ERROR',
        error: error.message
      });
    }

    console.log('🔧 [DEBUG] All tests completed');

    return NextResponse.json({
      success: true,
      debug: debugResults,
      summary: {
        totalTests: debugResults.tests.length,
        passedTests: debugResults.tests.filter(t => t.status === 'SUCCESS').length,
        failedTests: debugResults.tests.filter(t => t.status === 'ERROR').length,
        recommendations: generateRecommendations(debugResults.tests)
      }
    });

  } catch (error: any) {
    console.error('🔧 [DEBUG] Debug test failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      debug: debugResults
    }, { status: 500 });
  }
}

function generateRecommendations(tests: any[]) {
  const recommendations = [];

  const getUserContextTest = tests.find(t => t.test === 'getUserContext with Timeout');
  if (getUserContextTest?.status === 'ERROR' && getUserContextTest?.error?.includes('timeout')) {
    recommendations.push('getUserContext is timing out - likely database connection issue');
  }

  const userLookupTest = tests.find(t => t.test === 'MySQL Replica User Lookup');
  if (userLookupTest?.status === 'NOT_FOUND') {
    recommendations.push('User 5777 not found in MySQL replica - data sync issue');
  }

  const sessionLookupTest = tests.find(t => t.test === 'PostgreSQL Call Session Lookup');
  if (sessionLookupTest?.status === 'NOT_FOUND') {
    recommendations.push('Call session call_1753175877063_5777 not found - orphaned session ID');
  }

  const agentConflictTest = tests.find(t => t.test === 'Agent Session Conflicts');
  if (agentConflictTest?.result?.conflictingAgents?.length > 0) {
    recommendations.push('Agent session conflict detected - multiple agents assigned to same call');
  }

  const queueLockTest = tests.find(t => t.test === 'User Queue Locks');
  if (queueLockTest?.result?.activeQueueEntries > 1) {
    recommendations.push('Multiple active queue entries for user - queue conflict');
  }

  if (recommendations.length === 0) {
    recommendations.push('No obvious issues detected - may be a frontend caching or state issue');
  }

  return recommendations;
} 
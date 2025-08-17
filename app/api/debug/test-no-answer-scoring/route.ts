import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { CallService } from '@/modules/calls/services/call.service';
import { UserService } from '@/modules/users/services/user.service';
import { PriorityScoringService } from '@/modules/scoring/services/priority-scoring.service';
import { CallOutcomeManager } from '@/modules/call-outcomes/services/call-outcome-manager.service';

/**
 * Test endpoint to verify no_answer scoring fix
 * Tests that scores are additive, not reset to 10
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('🧪 [DEBUG] Testing no_answer scoring fix...');
    
    const body = await request.json();
    const { 
      userId = 99999, // Default test user
      initialScore = 50,
      dryRun = true 
    } = body;
    
    console.log(`🔧 [DEBUG] Test config: userId=${userId}, initialScore=${initialScore}, dryRun=${dryRun}`);
    
    // Step 1: Setup test user with known score
    console.log('📋 Step 1: Setting up test user with initial score...');
    
    if (!dryRun) {
      await prisma.userCallScore.upsert({
        where: { userId: BigInt(userId) },
        update: {
          currentScore: initialScore,
          isActive: true,
          currentQueueType: 'unsigned_users',
          lastOutcome: 'previous_outcome',
          totalAttempts: 2,
          lastResetDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
          updatedAt: new Date()
        },
        create: {
          userId: BigInt(userId),
          currentScore: initialScore,
          isActive: true,
          currentQueueType: 'unsigned_users',
          lastOutcome: 'previous_outcome',
          totalAttempts: 2,
          lastResetDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        }
      });
      
      console.log(`✅ Test user ${userId} setup with score: ${initialScore}`);
    } else {
      console.log(`📝 DRY RUN: Would setup user ${userId} with score ${initialScore}`);
    }
    
    // Step 2: Get user score before no_answer outcome
    const scoreBefore = await prisma.userCallScore.findUnique({
      where: { userId: BigInt(userId) }
    });
    
    console.log('📊 Score before no_answer outcome:', {
      currentScore: scoreBefore?.currentScore || 0,
      currentQueueType: scoreBefore?.currentQueueType,
      totalAttempts: scoreBefore?.totalAttempts || 0,
      lastOutcome: scoreBefore?.lastOutcome
    });
    
    // Step 3: Create a test call session
    let testSession;
    if (!dryRun) {
      // Find an available agent for the test
      const testAgent = await prisma.agent.findFirst({
        where: { isActive: true }
      });
      
      if (!testAgent) {
        throw new Error('No active agent found for test');
      }
      
      // Create a minimal call queue entry for the test
      const testQueueEntry = await prisma.callQueue.create({
        data: {
          userId: BigInt(userId),
          queueType: 'unsigned_users',
          priorityScore: initialScore,
          status: 'assigned'
        }
      });
      
      testSession = await prisma.callSession.create({
        data: {
          userId: BigInt(userId),
          agentId: testAgent.id,
          callQueueId: testQueueEntry.id,
          status: 'completed',
          direction: 'outbound',
          startedAt: new Date(Date.now() - 60000), // 1 minute ago
          endedAt: new Date(),
          durationSeconds: 30
        }
      });
      
      console.log(`✅ Test call session created: ${testSession.id}`);
    } else {
      console.log('📝 DRY RUN: Would create test call session');
    }
    
    // Step 4: Initialize services and process no_answer outcome
    console.log('🔄 Step 4: Processing no_answer outcome...');
    
    if (!dryRun && testSession) {
      const userService = new UserService({ prisma });
      const scoringService = new PriorityScoringService({
        logger: console,
        outcomeManager: new CallOutcomeManager()
      });
      
      const callService = new CallService({
        prisma,
        logger: console,
        userService,
        scoringService,
        callOutcomeManager: new CallOutcomeManager()
      });
      
      // Record no_answer outcome
      await callService.recordCallOutcome(
        testSession.id,
        testSession.agentId,
        {
          outcomeType: 'no_answer',
          outcomeNotes: 'Test no_answer outcome - customer did not pick up',
          nextCallDelayHours: 4
        }
      );
      
      console.log('✅ no_answer outcome processed');
    } else {
      console.log('📝 DRY RUN: Would process no_answer outcome');
    }
    
    // Step 5: Check score after no_answer outcome
    const scoreAfter = dryRun ? null : await prisma.userCallScore.findUnique({
      where: { userId: BigInt(userId) }
    });
    
    console.log('📈 Score after no_answer outcome:', {
      currentScore: scoreAfter?.currentScore || 'N/A (dry run)',
      scoreChange: scoreAfter ? (scoreAfter.currentScore - (scoreBefore?.currentScore || 0)) : 'N/A (dry run)',
      expectedChange: '+10 (additive)',
      actuallyAdditive: scoreAfter ? (scoreAfter.currentScore === (scoreBefore?.currentScore || 0) + 10) : 'N/A (dry run)',
      lastOutcome: scoreAfter?.lastOutcome || 'N/A (dry run)',
      totalAttempts: scoreAfter?.totalAttempts || 'N/A (dry run)'
    });
    
    // Step 6: Analyze results
    const isFixed = scoreAfter ? 
      (scoreAfter.currentScore === (scoreBefore?.currentScore || 0) + 10) : 
      null;
    
    const analysis = {
      testSuccessful: dryRun ? 'dry_run' : isFixed,
      beforeScore: scoreBefore?.currentScore || 0,
      afterScore: scoreAfter?.currentScore || 'N/A (dry run)',
      expectedAfterScore: (scoreBefore?.currentScore || 0) + 10,
      scoreAdjustment: scoreAfter ? 
        (scoreAfter.currentScore - (scoreBefore?.currentScore || 0)) : 
        'N/A (dry run)',
      isAdditive: isFixed,
      bugFixed: dryRun ? 'unknown (dry run)' : isFixed
    };
    
    // Step 7: Cleanup test data
    if (!dryRun && testSession) {
      console.log('🧹 Cleaning up test data...');
      
      await prisma.callOutcome.deleteMany({
        where: { callSessionId: testSession.id }
      });
      
      await prisma.callSession.delete({
        where: { id: testSession.id }
      });
      
      await prisma.callQueue.deleteMany({
        where: { userId: BigInt(userId) }
      });
      
      // Optionally reset user score to original value
      if (scoreBefore) {
        await prisma.userCallScore.update({
          where: { userId: BigInt(userId) },
          data: {
            currentScore: scoreBefore.currentScore,
            lastOutcome: scoreBefore.lastOutcome,
            totalAttempts: scoreBefore.totalAttempts,
            updatedAt: scoreBefore.updatedAt
          }
        });
      }
      
      console.log('✅ Test data cleaned up');
    }
    
    const duration = Date.now() - startTime;
    
    console.log('✅ [DEBUG] no_answer scoring test completed:', {
      executionTime: `${duration}ms`,
      ...analysis
    });
    
    return NextResponse.json({
      success: true,
      message: 'no_answer scoring test completed',
      executionTime: `${duration}ms`,
      testConfiguration: {
        userId,
        initialScore,
        dryRun
      },
      results: analysis,
      timestamp: new Date().toISOString()
    }, { status: 200 });
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    console.error('❌ [DEBUG] no_answer scoring test failed:', {
      error: error.message,
      stack: error.stack,
      executionTime: `${duration}ms`
    });
    
    return NextResponse.json({
      success: false,
      error: error.message,
      executionTime: `${duration}ms`,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * GET method for quick test with defaults
 */
export async function GET(request: NextRequest) {
  // Safe URL parsing with fallback
  let userId = 99999;
  let initialScore = 50;
  
  try {
    const url = new URL(request.url || 'http://localhost:3000');
    userId = parseInt(url.searchParams.get('userId') || '99999');
    initialScore = parseInt(url.searchParams.get('initialScore') || '50');
  } catch (e) {
    console.warn('Failed to parse URL parameters, using defaults:', e);
  }
  const dryRun = url.searchParams.get('dryRun') !== 'false';
  
  // Forward to POST with default parameters
  return POST(new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify({ userId, initialScore, dryRun }),
    headers: { 'Content-Type': 'application/json' }
  }));
}

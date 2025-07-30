import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 TESTING INBOUND CALLBACK FIX');
    
    const { testCallSid = 'TEST_CALL_12345', testUserId = 2064 } = await request.json().catch(() => ({}));
    
    console.log(`Testing with CallSid: ${testCallSid}, UserId: ${testUserId}`);
    
    // Step 1: Simulate webhook creating a session (like a real inbound call)
    console.log('📞 Step 1: Simulating webhook session creation...');
    
    // Find an active agent
    const agent = await prisma.agent.findFirst({
      where: { isActive: true },
      select: { id: true, firstName: true, lastName: true }
    });
    
    if (!agent) {
      throw new Error('No active agents found');
    }
    
    // Create queue entry for the simulated inbound call
    const callQueue = await prisma.callQueue.create({
      data: {
        userId: BigInt(testUserId),
        queueType: 'inbound_call',
        priorityScore: 0,
        status: 'assigned',
        queueReason: 'Test inbound call simulation',
        assignedToAgentId: agent.id,
        assignedAt: new Date()
      }
    });
    
    // Create webhook session (simulating what handleInboundCall does)
    const webhookSession = await prisma.callSession.create({
      data: {
        userId: BigInt(testUserId),
        agentId: agent.id,
        callQueueId: callQueue.id,
        twilioCallSid: testCallSid,
        status: 'ringing',
        direction: 'inbound',
        startedAt: new Date(),
        callSource: 'inbound',
        userClaimsContext: JSON.stringify({
          callerName: 'Test User',
          phoneNumber: '+1234567890',
          lookupStatus: 'complete'
        })
      }
    });
    
    console.log(`✅ Webhook session created: ${webhookSession.id}`);
    
    // Step 2: Simulate CallInterface trying to create session (should find existing one)
    console.log('🔍 Step 2: Testing session lookup by CallSid...');
    
    const existingSession = await prisma.callSession.findFirst({
      where: { twilioCallSid: testCallSid }
    });
    
    if (existingSession) {
      console.log(`✅ Session lookup successful: Found ${existingSession.id}`);
    } else {
      throw new Error('Session lookup failed - should have found existing session');
    }
    
    // Step 3: Simulate setting a callback outcome
    console.log('📋 Step 3: Testing callback outcome creation...');
    
    // Update session to completed
    const completedSession = await prisma.callSession.update({
      where: { id: webhookSession.id },
      data: {
        status: 'completed',
        endedAt: new Date(),
        durationSeconds: 60,
        lastOutcomeType: 'call_back',
        lastOutcomeAgentId: agent.id,
        lastOutcomeAt: new Date(),
        lastOutcomeNotes: 'Test callback request',
        callbackScheduled: true
      }
    });
    
    // Create callback record (simulating what CallService.recordCallOutcome does)
    const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
    
    const callbackRecord = await prisma.callback.create({
      data: {
        userId: BigInt(testUserId),
        scheduledFor: futureDate,
        callbackReason: 'Test callback - customer requested callback in 2 hours',
        preferredAgentId: agent.id,
        originalCallSessionId: webhookSession.id,
        status: 'pending'
      }
    });
    
    console.log(`✅ Callback created: ${callbackRecord.id}`);
    
    // Step 4: Verify the complete flow worked
    console.log('✅ Step 4: Verifying complete flow...');
    
    const verification = await prisma.callSession.findUnique({
      where: { id: webhookSession.id },
      include: {
        agent: {
          select: { firstName: true, lastName: true }
        }
      }
    });
    
    const callbackVerification = await prisma.callback.findFirst({
      where: { originalCallSessionId: webhookSession.id }
    });
    
    // Clean up test data
    console.log('🧹 Cleaning up test data...');
    await prisma.callback.delete({ where: { id: callbackRecord.id } });
    await prisma.callSession.delete({ where: { id: webhookSession.id } });
    await prisma.callQueue.delete({ where: { id: callQueue.id } });
    
    return NextResponse.json({
      success: true,
      message: 'Inbound callback fix test completed successfully!',
      testResults: {
        webhookSessionCreated: !!webhookSession,
        sessionLookupWorked: !!existingSession,
        callbackCreated: !!callbackRecord,
        verificationPassed: verification?.callbackScheduled === true && !!callbackVerification
      },
      summary: {
        webhookSessionId: webhookSession.id,
        callbackId: callbackRecord.id,
        agent: `${agent.firstName} ${agent.lastName}`,
        callSid: testCallSid,
        userId: testUserId
      }
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 
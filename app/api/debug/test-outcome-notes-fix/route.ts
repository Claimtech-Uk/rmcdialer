import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { CallService } from '@/modules/calls/services/call.service';
import { UserService } from '@/modules/users/services/user.service';
import { PriorityScoringService } from '@/modules/scoring/services/priority-scoring.service';
import { CallOutcomeManager } from '@/modules/call-outcomes/services/call-outcome-manager.service';

/**
 * Test endpoint to verify outcome notes fix
 * Tests that user notes are preserved instead of being overwritten with stock notes
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('🧪 [DEBUG] Testing outcome notes fix...');
    
    const body = await request.json();
    const { 
      userId = 99998, // Default test user
      customNotes = "Customer wants to discuss with spouse before proceeding. Called said very interested but needs time to review terms with partner. Follow up in 2 days.",
      outcomeType = 'call_back',
      dryRun = false 
    } = body;
    
    console.log(`🔧 [DEBUG] Test config:`, { userId, customNotes, outcomeType, dryRun });
    
    // Step 1: Setup test user and agent
    console.log('📋 Step 1: Setting up test user and finding agent...');
    
    const agent = await prisma.agent.findFirst({
      where: { isActive: true }
    });
    
    if (!agent) {
      throw new Error('No active agent found for testing');
    }
    
    // Ensure test user exists
    const testUser = await prisma.user.upsert({
      where: { id: BigInt(userId) },
      update: {},
      create: {
        id: BigInt(userId),
        phoneNumber: '+15551234567',
        firstName: 'Test',
        lastName: 'User',
        email: 'test.user@example.com'
      }
    });
    
    console.log(`✅ Test user ready: ${testUser.firstName} ${testUser.lastName} (${testUser.id})`);
    console.log(`✅ Using agent: ${agent.firstName} ${agent.lastName} (${agent.id})`);
    
    // Step 2: Create test call session
    console.log('📞 Step 2: Creating test call session...');
    
    const testSession = await prisma.callSession.create({
      data: {
        id: `test-notes-${Date.now()}`,
        userId: testUser.id,
        direction: 'outbound',
        status: 'completed',
        startedAt: new Date(),
        endedAt: new Date(),
        durationSeconds: 120,
        agentId: agent.id,
        phoneNumber: testUser.phoneNumber,
        callSource: 'test_outcome_notes'
      }
    });
    
    console.log(`✅ Test session created: ${testSession.id}`);
    
    // Step 3: Initialize services and process outcome with custom notes
    console.log('🔄 Step 3: Processing outcome with custom notes...');
    
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
    
    // Record outcome with custom notes
    await callService.recordCallOutcome(
      testSession.id,
      agent.id,
      {
        outcomeType: outcomeType,
        outcomeNotes: customNotes,
        ...(outcomeType === 'call_back' && {
          callbackDateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days
          callbackReason: 'Customer requested callback after spouse discussion'
        })
      }
    );
    
    console.log('✅ Outcome processed');
    
    // Step 4: Verify the notes were preserved
    console.log('🔍 Step 4: Verifying notes preservation...');
    
    // Check CallSession.lastOutcomeNotes
    const updatedSession = await prisma.callSession.findUnique({
      where: { id: testSession.id }
    });
    
    // Check CallOutcome.outcomeNotes
    const callOutcome = await prisma.callOutcome.findFirst({
      where: { callSessionId: testSession.id },
      orderBy: { createdAt: 'desc' }
    });
    
    // Analyze results
    const sessionNotesMatch = updatedSession?.lastOutcomeNotes === customNotes;
    const outcomeNotesMatch = callOutcome?.outcomeNotes === customNotes;
    
    // Get stock note for comparison
    const stockNoteMap: Record<string, string> = {
      'call_back': 'Customer requested a callback',
      'no_answer': 'Customer did not answer the phone',
      'hung_up': 'Customer hung up during conversation',
      'completed_form': 'Customer completed their form submission',
      'going_to_complete': 'Customer committed to completing their form',
      'might_complete': 'Customer showed some interest but no commitment',
      'not_interested': 'Customer expressed they are not interested'
    };
    
    const expectedStockNote = stockNoteMap[outcomeType] || `Processed ${outcomeType} outcome`;
    const notesAreStock = updatedSession?.lastOutcomeNotes === expectedStockNote;
    
    const results = {
      testSuccessful: sessionNotesMatch && outcomeNotesMatch && !notesAreStock,
      customNotes,
      expectedStockNote,
      actualSessionNotes: updatedSession?.lastOutcomeNotes,
      actualOutcomeNotes: callOutcome?.outcomeNotes,
      sessionNotesMatch,
      outcomeNotesMatch,
      notesAreStock: notesAreStock,
      analysis: {
        fixed: sessionNotesMatch && outcomeNotesMatch && !notesAreStock,
        issue: notesAreStock ? 'Notes were replaced with stock notes' : 
               !sessionNotesMatch ? 'Session notes don\'t match input' :
               !outcomeNotesMatch ? 'Outcome notes don\'t match input' : 'None'
      }
    };
    
    console.log('📊 Test Results:', results);
    
    // Step 5: Clean up test data
    if (!dryRun) {
      console.log('🧹 Cleaning up test data...');
      
      await prisma.callOutcome.deleteMany({
        where: { callSessionId: testSession.id }
      });
      
      await prisma.callSession.delete({
        where: { id: testSession.id }
      });
      
      console.log('✅ Test data cleaned up');
    }
    
    const duration = Date.now() - startTime;
    console.log(`⏱️ Test completed in ${duration}ms`);
    
    return NextResponse.json({
      success: true,
      testResults: results,
      duration,
      metadata: {
        testUserId: userId,
        testSessionId: testSession.id,
        agentId: agent.id,
        outcomeType,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error: any) {
    console.error('❌ Test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      duration: Date.now() - startTime
    }, { status: 500 });
  }
}

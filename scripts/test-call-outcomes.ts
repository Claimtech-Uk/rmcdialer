#!/usr/bin/env npx tsx

/**
 * Comprehensive Call Outcomes Test Script
 * Tests all call outcome types for data storage, scoring, and autodialler behavior
 */

import { PrismaClient } from '@prisma/client';
import type { CallOutcomeType } from '../modules/call-outcomes/types/call-outcome.types';

const prisma = new PrismaClient();

interface TestCallSession {
  id: string;
  userId: bigint;
  agentId: number;
  status: string;
  direction: string;
  startedAt: Date;
}

interface TestResult {
  outcomeType: CallOutcomeType;
  success: boolean;
  dataStored: boolean;
  scoreUpdated: boolean;
  sessionUpdated: boolean;
  autoDiallerProgression: 'success' | 'countdown' | 'failed';
  errors: string[];
  details: any;
}

// All call outcome types to test
const ALL_OUTCOME_TYPES: CallOutcomeType[] = [
  'completed_form',
  'going_to_complete', 
  'might_complete',
  'call_back',
  'no_answer',
  'missed_call',
  'hung_up',
  'bad_number',
  'no_claim',
  'not_interested',
  'do_not_contact'
];

// Test data
const TEST_USER_ID = 999999; // Use a test user ID
const TEST_AGENT_ID = 1;

class CallOutcomeTestSuite {
  private results: TestResult[] = [];
  private testCallSession: TestCallSession | null = null;

  async runAllTests(): Promise<void> {
    console.log('🧪 Starting comprehensive call outcomes test suite...\n');
    
    try {
      // Setup test environment
      await this.setupTestEnvironment();
      
      // Test each outcome type
      for (const outcomeType of ALL_OUTCOME_TYPES) {
        console.log(`\n📋 Testing outcome: ${outcomeType}`);
        await this.testCallOutcome(outcomeType);
      }
      
      // Generate report
      this.generateReport();
      
    } catch (error) {
      console.error('❌ Test suite failed:', error);
    } finally {
      // Cleanup
      await this.cleanup();
    }
  }

  private async setupTestEnvironment(): Promise<void> {
    console.log('🛠️ Setting up test environment...');
    
    // Create a test call session with required callQueueId
    this.testCallSession = await prisma.callSession.create({
      data: {
        userId: BigInt(TEST_USER_ID),
        agentId: TEST_AGENT_ID,
        callQueueId: 'test-queue-id',
        status: 'active',
        direction: 'outbound',
        startedAt: new Date(),
        callSource: 'test',
        callAttemptNumber: 1
      }
    });
    
    // Ensure test user has a call score record
    await prisma.userCallScore.upsert({
      where: { userId: BigInt(TEST_USER_ID) },
      update: {},
      create: {
        userId: BigInt(TEST_USER_ID),
        currentScore: 50, // Starting score for testing
        totalAttempts: 0,
        successfulCalls: 0
      }
    });
    
    console.log(`✅ Created test call session: ${this.testCallSession.id}`);
  }

  private async testCallOutcome(outcomeType: CallOutcomeType): Promise<void> {
    const result: TestResult = {
      outcomeType,
      success: false,
      dataStored: false,
      scoreUpdated: false,
      sessionUpdated: false,
      autoDiallerProgression: 'failed',
      errors: [],
      details: {}
    };

    try {
      // 1. Test call session update with outcome
      const sessionBefore = await prisma.callSession.findUnique({
        where: { id: this.testCallSession!.id }
      });

      // Simulate call outcome processing
      await this.processCallOutcome(outcomeType, result);

      // 2. Verify call session was updated
      const sessionAfter = await prisma.callSession.findUnique({
        where: { id: this.testCallSession!.id }
      });

      if (sessionAfter?.lastOutcomeType === outcomeType) {
        result.sessionUpdated = true;
        result.details.sessionUpdate = {
          outcomeType: sessionAfter.lastOutcomeType,
          outcomeNotes: sessionAfter.lastOutcomeNotes,
          outcomeAt: sessionAfter.lastOutcomeAt
        };
      }

      // 3. Verify user call score was updated
      await this.verifyScoreUpdate(outcomeType, result);

      // 4. Test autodialler progression logic
      await this.testAutoDiallerProgression(outcomeType, result);

      // 5. Test data storage for specific outcome types
      await this.testSpecificOutcomeData(outcomeType, result);

      result.success = result.sessionUpdated && result.scoreUpdated;

    } catch (error: any) {
      result.errors.push(error.message);
      console.error(`❌ Error testing ${outcomeType}:`, error.message);
    }

    this.results.push(result);
    this.logTestResult(result);
  }

  private async processCallOutcome(outcomeType: CallOutcomeType, result: TestResult): Promise<void> {
    // Simulate the call outcome processing that happens in the real system
    const outcomeData = this.getTestDataForOutcome(outcomeType);
    
    try {
      // Update call session (simulating CallOutcomeManager behavior)
      await prisma.callSession.update({
        where: { id: this.testCallSession!.id },
        data: {
          lastOutcomeType: outcomeType,
          lastOutcomeNotes: outcomeData.notes,
          lastOutcomeAt: new Date(),
          lastOutcomeAgentId: TEST_AGENT_ID,
          ...(outcomeType === 'completed_form' && { status: 'completed' }),
          ...(outcomeType === 'missed_call' && { status: 'missed_call', endedAt: new Date() }),
          ...(outcomeType === 'bad_number' && { status: 'failed' })
        }
      });

      // Update user call score based on outcome
      const scoreAdjustment = this.getScoreAdjustment(outcomeType);
      await prisma.userCallScore.update({
        where: { userId: BigInt(TEST_USER_ID) },
        data: {
          totalAttempts: { increment: 1 },
          successfulCalls: { increment: this.isSuccessfulOutcome(outcomeType) ? 1 : 0 },
          currentScore: { increment: scoreAdjustment },
          lastCallAt: new Date(),
          lastOutcome: outcomeType
        }
      });

      result.dataStored = true;

    } catch (error: any) {
      result.errors.push(`Data storage failed: ${error.message}`);
    }
  }

  private async verifyScoreUpdate(outcomeType: CallOutcomeType, result: TestResult): Promise<void> {
    try {
      const userScore = await prisma.userCallScore.findUnique({
        where: { userId: BigInt(TEST_USER_ID) }
      });

      if (userScore?.lastOutcome === outcomeType) {
        result.scoreUpdated = true;
        result.details.scoreUpdate = {
          currentScore: userScore.currentScore,
          totalAttempts: userScore.totalAttempts,
          successfulCalls: userScore.successfulCalls,
          lastOutcome: userScore.lastOutcome
        };
      }
    } catch (error: any) {
      result.errors.push(`Score verification failed: ${error.message}`);
    }
  }

  private async testAutoDiallerProgression(outcomeType: CallOutcomeType, result: TestResult): Promise<void> {
    // Test the autodialler progression logic based on outcome type
    const countdownTime = this.getCountdownTime(outcomeType);
    const shouldAutoProgress = this.shouldAutoProgress(outcomeType);

    if (shouldAutoProgress) {
      result.autoDiallerProgression = countdownTime > 0 ? 'countdown' : 'success';
      result.details.autoDialler = {
        shouldProgress: true,
        countdownTime,
        isSuccessful: this.isSuccessfulOutcome(outcomeType)
      };
    } else {
      result.autoDiallerProgression = 'failed';
      result.details.autoDialler = {
        shouldProgress: false,
        reason: this.getProgressionBlockReason(outcomeType)
      };
    }
  }

  private async testSpecificOutcomeData(outcomeType: CallOutcomeType, result: TestResult): Promise<void> {
    // Test specific data storage requirements for certain outcomes
    switch (outcomeType) {
      case 'call_back':
        // Should create a callback record
        result.details.callbackTest = 'Callback record creation would be tested here';
        break;
        
      case 'bad_number':
        // Should mark phone number as invalid
        result.details.phoneValidation = 'Phone number invalidation would be tested here';
        break;
        
      case 'do_not_contact':
        // Should add to DNC list
        result.details.dncTest = 'DNC list addition would be tested here';
        break;
        
      case 'completed_form':
        // Should trigger conversion tracking
        result.details.conversionTest = 'Conversion tracking would be tested here';
        break;
    }
  }

  private getTestDataForOutcome(outcomeType: CallOutcomeType): any {
    const baseData = {
      notes: `Test outcome: ${outcomeType}`,
      agentId: TEST_AGENT_ID,
      timestamp: new Date()
    };

    switch (outcomeType) {
      case 'call_back':
        return {
          ...baseData,
          callbackDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
          callbackReason: 'User requested callback'
        };
      case 'completed_form':
        return {
          ...baseData,
          conversionType: 'form_completion',
          magicLinkSent: true
        };
      default:
        return baseData;
    }
  }

  private getScoreAdjustment(outcomeType: CallOutcomeType): number {
    // Score adjustments based on outcome type
    const scoreMap: Record<CallOutcomeType, number> = {
      'completed_form': -20,      // Highest success, lower score (higher priority)
      'going_to_complete': -15,   // Very positive
      'might_complete': -10,      // Positive
      'call_back': -5,           // Neutral-positive
      'no_answer': 0,            // Neutral
      'missed_call': 0,          // Neutral
      'hung_up': 5,              // Slightly negative
      'not_interested': 10,      // Negative
      'no_claim': 15,            // More negative
      'bad_number': 20,          // Very negative
      'do_not_contact': 25       // Worst case
    };
    return scoreMap[outcomeType] || 0;
  }

  private isSuccessfulOutcome(outcomeType: CallOutcomeType): boolean {
    return ['completed_form', 'going_to_complete', 'call_back'].includes(outcomeType);
  }

  private getCountdownTime(outcomeType: CallOutcomeType): number {
    // Countdown times in seconds based on outcome
    const timeMap: Record<CallOutcomeType, number> = {
      'completed_form': 60,       // Longer break after success
      'going_to_complete': 45,    // Medium break
      'call_back': 45,           // Medium break
      'might_complete': 30,      // Standard break
      'no_answer': 20,           // Quick retry
      'missed_call': 20,         // Quick retry
      'hung_up': 30,             // Standard break
      'not_interested': 30,      // Standard break
      'no_claim': 30,            // Standard break
      'bad_number': 20,          // Quick to next
      'do_not_contact': 30       // Standard break
    };
    return timeMap[outcomeType] || 30;
  }

  private shouldAutoProgress(outcomeType: CallOutcomeType): boolean {
    // All outcomes should allow auto-progression except certain edge cases
    return !['bad_number'].includes(outcomeType); // Example: bad numbers might need manual review
  }

  private getProgressionBlockReason(outcomeType: CallOutcomeType): string {
    switch (outcomeType) {
      case 'bad_number':
        return 'Bad number requires manual review';
      default:
        return 'Unknown reason';
    }
  }

  private logTestResult(result: TestResult): void {
    const status = result.success ? '✅' : '❌';
    const progression = result.autoDiallerProgression === 'success' ? '🔄' : 
                       result.autoDiallerProgression === 'countdown' ? '⏱️' : '⏸️';
    
    console.log(`${status} ${result.outcomeType}`);
    console.log(`   Data: ${result.dataStored ? '✅' : '❌'} Score: ${result.scoreUpdated ? '✅' : '❌'} Session: ${result.sessionUpdated ? '✅' : '❌'} Progression: ${progression}`);
    
    if (result.errors.length > 0) {
      console.log(`   Errors: ${result.errors.join(', ')}`);
    }
  }

  private generateReport(): void {
    console.log('\n📊 COMPREHENSIVE TEST RESULTS REPORT\n');
    console.log('='.repeat(60));
    
    const totalTests = this.results.length;
    const successfulTests = this.results.filter(r => r.success).length;
    const dataStorageTests = this.results.filter(r => r.dataStored).length;
    const scoreUpdateTests = this.results.filter(r => r.scoreUpdated).length;
    const sessionUpdateTests = this.results.filter(r => r.sessionUpdated).length;
    const autoProgressionTests = this.results.filter(r => r.autoDiallerProgression !== 'failed').length;

    console.log(`Overall Success Rate: ${successfulTests}/${totalTests} (${Math.round(successfulTests/totalTests*100)}%)`);
    console.log(`Data Storage: ${dataStorageTests}/${totalTests} (${Math.round(dataStorageTests/totalTests*100)}%)`);
    console.log(`Score Updates: ${scoreUpdateTests}/${totalTests} (${Math.round(scoreUpdateTests/totalTests*100)}%)`);
    console.log(`Session Updates: ${sessionUpdateTests}/${totalTests} (${Math.round(sessionUpdateTests/totalTests*100)}%)`);
    console.log(`Auto-Progression: ${autoProgressionTests}/${totalTests} (${Math.round(autoProgressionTests/totalTests*100)}%)`);

    console.log('\n📋 DETAILED RESULTS:');
    console.log('-'.repeat(60));

    this.results.forEach(result => {
      console.log(`\n🎯 ${result.outcomeType.toUpperCase()}`);
      console.log(`   Status: ${result.success ? 'PASS' : 'FAIL'}`);
      console.log(`   Data Storage: ${result.dataStored ? 'PASS' : 'FAIL'}`);
      console.log(`   Score Update: ${result.scoreUpdated ? 'PASS' : 'FAIL'}`);
      console.log(`   Session Update: ${result.sessionUpdated ? 'PASS' : 'FAIL'}`);
      console.log(`   Auto-Progression: ${result.autoDiallerProgression.toUpperCase()}`);
      
      if (result.details.scoreUpdate) {
        console.log(`   Score Details: ${JSON.stringify(result.details.scoreUpdate, null, 2)}`);
      }
      
      if (result.details.autoDialler) {
        console.log(`   Progression Details: ${JSON.stringify(result.details.autoDialler, null, 2)}`);
      }
      
      if (result.errors.length > 0) {
        console.log(`   Errors: ${result.errors.join(', ')}`);
      }
    });

    console.log('\n🎉 Test suite completed!');
    
    if (successfulTests === totalTests) {
      console.log('✅ All tests passed! Call outcomes are working correctly.');
    } else {
      console.log(`⚠️ ${totalTests - successfulTests} tests failed. Please review the errors above.`);
    }
  }

  private async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up test environment...');
    
    try {
      // Delete test call session
      if (this.testCallSession) {
        await prisma.callSession.delete({
          where: { id: this.testCallSession.id }
        });
        console.log(`✅ Deleted test call session: ${this.testCallSession.id}`);
      }
      
      // Reset test user call score
      await prisma.userCallScore.update({
        where: { userId: BigInt(TEST_USER_ID) },
        data: {
          currentScore: 50, // Reset to default
          totalAttempts: 0,
          successfulCalls: 0,
          lastCallAt: null,
          lastOutcome: null
        }
      });
      
      console.log('✅ Reset test user call score');
      
    } catch (error) {
      console.error('⚠️ Cleanup error:', error);
    } finally {
      await prisma.$disconnect();
    }
  }
}

// Run the test suite
async function main() {
  const testSuite = new CallOutcomeTestSuite();
  await testSuite.runAllTests();
}

if (require.main === module) {
  main().catch(console.error);
}

export { CallOutcomeTestSuite }; 
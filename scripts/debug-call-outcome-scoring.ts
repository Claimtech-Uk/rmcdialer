#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import { CallOutcomeManager } from '../modules/call-outcomes/services/call-outcome-manager.service';
import { PriorityScoringService } from '../modules/scoring/services/priority-scoring.service';
import type { CallOutcomeType } from '../modules/call-outcomes/types/call-outcome.types';
import type { ScoringContext } from '../modules/scoring/types/scoring.types';

const prisma = new PrismaClient();

// All call outcome types with their expected score adjustments
const EXPECTED_SCORE_ADJUSTMENTS: Record<CallOutcomeType, number> = {
  'completed_form': 0,       // No change, triggers conversion
  'going_to_complete': 3,    // Add 3 to current score
  'might_complete': 3,       // Add 3 to current score
  'call_back': 3,            // Add 3 to current score
  'missed_call': 0,          // No change
  'no_answer': 10,           // Penalty - slightly lower priority
  'hung_up': 25,             // Penalty - lower priority
  'bad_number': 50,          // Penalty - significant problem
  'not_interested': 100,     // Penalty - very low priority
  'no_claim': 200,           // Penalty - triggers conversion
  'do_not_contact': 200      // Penalty - triggers conversion
};

interface ScoreTest {
  outcomeType: CallOutcomeType;
  expectedAdjustment: number;
  actualAdjustment: number;
  newUserTest: {
    initialScore: number;
    expectedFinalScore: number;
    actualFinalScore: number;
    isCorrect: boolean;
  };
  existingUserTest: {
    initialScore: number;
    expectedFinalScore: number;
    actualFinalScore: number;
    isCorrect: boolean;
  };
}

class CallOutcomeScoringDiagnostic {
  private outcomeManager = new CallOutcomeManager();
  private scoringService!: PriorityScoringService;
  
  constructor() {
    // Initialize scoring service with minimal dependencies
    this.scoringService = new PriorityScoringService({
      logger: {
        info: console.log,
        warn: console.warn,
        error: console.error
      }
    });
  }

  async runDiagnostic(): Promise<void> {
    console.log('🔍 Call Outcome Scoring Diagnostic');
    console.log('=====================================\n');

    // Step 1: Verify outcome manager score adjustments
    console.log('📊 Step 1: Verifying Outcome Score Adjustments');
    console.log('-----------------------------------------------');
    this.verifyOutcomeAdjustments();

    // Step 2: Test scoring calculation for different scenarios
    console.log('\n🧮 Step 2: Testing Scoring Calculations');
    console.log('---------------------------------------');
    await this.testScoringCalculations();

    // Step 3: Test with real users from database
    console.log('\n👥 Step 3: Testing with Real Users');
    console.log('----------------------------------');
    await this.testWithRealUsers();

    console.log('\n✅ Diagnostic Complete!');
  }

  private verifyOutcomeAdjustments(): void {
    console.log('Checking if outcome handlers return correct score adjustments...\n');
    
    let allCorrect = true;
    
    for (const [outcomeType, expectedAdjustment] of Object.entries(EXPECTED_SCORE_ADJUSTMENTS)) {
      const actualAdjustment = this.outcomeManager.getScoreAdjustment(outcomeType as CallOutcomeType);
      const isCorrect = actualAdjustment === expectedAdjustment;
      
      if (!isCorrect) allCorrect = false;
      
      console.log(`${isCorrect ? '✅' : '❌'} ${outcomeType.padEnd(20)} | Expected: ${expectedAdjustment.toString().padStart(3)} | Actual: ${actualAdjustment.toString().padStart(3)}`);
    }
    
    if (allCorrect) {
      console.log('\n🎉 All outcome score adjustments are correct!');
    } else {
      console.log('\n🚨 Some outcome score adjustments are INCORRECT!');
    }
  }

  private async testScoringCalculations(): Promise<void> {
    const results: ScoreTest[] = [];

    for (const [outcomeType, expectedAdjustment] of Object.entries(EXPECTED_SCORE_ADJUSTMENTS)) {
      const test = await this.testOutcomeScoring(outcomeType as CallOutcomeType, expectedAdjustment);
      results.push(test);
    }

    // Display results
    console.log('\nScoring Calculation Results:');
    console.log('============================\n');
    
    console.log('Outcome Type'.padEnd(20) + ' | New User Test'.padEnd(20) + ' | Existing User Test');
    console.log('-'.repeat(70));
    
    for (const result of results) {
      const newUserStatus = result.newUserTest.isCorrect ? '✅ PASS' : '❌ FAIL';
      const existingUserStatus = result.existingUserTest.isCorrect ? '✅ PASS' : '❌ FAIL';
      
      console.log(`${result.outcomeType.padEnd(20)} | ${newUserStatus.padEnd(20)} | ${existingUserStatus}`);
      
      if (!result.newUserTest.isCorrect) {
        console.log(`   NEW USER: Expected ${result.newUserTest.expectedFinalScore}, got ${result.newUserTest.actualFinalScore}`);
      }
      
      if (!result.existingUserTest.isCorrect) {
        console.log(`   EXISTING: Expected ${result.existingUserTest.expectedFinalScore}, got ${result.existingUserTest.actualFinalScore}`);
      }
    }

    // Summary
    const failedTests = results.filter(r => !r.newUserTest.isCorrect || !r.existingUserTest.isCorrect);
    if (failedTests.length === 0) {
      console.log('\n🎉 All scoring calculations are working correctly!');
    } else {
      console.log(`\n🚨 ${failedTests.length} outcome types have scoring issues!`);
      console.log('Failed outcomes:', failedTests.map(t => t.outcomeType).join(', '));
    }
  }

  private async testOutcomeScoring(outcomeType: CallOutcomeType, expectedAdjustment: number): Promise<ScoreTest> {
    const actualAdjustment = this.outcomeManager.getScoreAdjustment(outcomeType);

    // Test with new user (fresh start)
    const newUserContext: ScoringContext = {
      userId: 99999,
      userCreatedAt: new Date(),
      currentTime: new Date(),
      lastOutcome: outcomeType,
      totalAttempts: 1,
      lastCallAt: new Date(),
      hasExistingRecord: false, // New user
      currentScore: 0
    };

    const newUserResult = await this.scoringService.calculatePriority(newUserContext);
    
    // Expected: 0 (base) + outcome adjustment + attempt penalty (usually ~5)
    const expectedNewUserScore = 0 + expectedAdjustment + 5; // Rough estimate including attempt penalty
    const actualNewUserScore = newUserResult.finalScore;
    
    // Allow small variance for attempt penalty calculation
    const newUserIsCorrect = Math.abs(actualNewUserScore - expectedNewUserScore) <= 5;

    // Test with existing user
    const existingUserCurrentScore = 30;
    const existingUserContext: ScoringContext = {
      userId: 99998,
      userCreatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      currentTime: new Date(),
      lastResetDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      lastOutcome: outcomeType,
      totalAttempts: 3,
      lastCallAt: new Date(),
      hasExistingRecord: true, // Existing user
      currentScore: existingUserCurrentScore
    };

    const existingUserResult = await this.scoringService.calculatePriority(existingUserContext);
    
    // Expected: current score + outcome adjustment + attempt penalty
    const expectedExistingUserScore = existingUserCurrentScore + expectedAdjustment + 10; // Rough estimate
    const actualExistingUserScore = existingUserResult.finalScore;
    
    // Allow small variance for attempt penalty calculation
    const existingUserIsCorrect = Math.abs(actualExistingUserScore - expectedExistingUserScore) <= 10;

    return {
      outcomeType,
      expectedAdjustment,
      actualAdjustment,
      newUserTest: {
        initialScore: 0,
        expectedFinalScore: expectedNewUserScore,
        actualFinalScore: actualNewUserScore,
        isCorrect: newUserIsCorrect
      },
      existingUserTest: {
        initialScore: existingUserCurrentScore,
        expectedFinalScore: expectedExistingUserScore,
        actualFinalScore: actualExistingUserScore,
        isCorrect: existingUserIsCorrect
      }
    };
  }

  private async testWithRealUsers(): Promise<void> {
    try {
      console.log('Finding users with recent call outcomes...');
      
      // Get users with user_call_score records and recent call history
      const usersWithScores = await prisma.userCallScore.findMany({
        take: 5,
        where: {
          isActive: true,
          currentScore: { gt: 0 }
        },
        select: {
          userId: true,
          currentScore: true,
          lastOutcome: true,
          totalAttempts: true,
          lastResetDate: true,
          lastCallAt: true
        },
        orderBy: {
          lastCallAt: 'desc'
        }
      });

      if (usersWithScores.length === 0) {
        console.log('⚠️  No users found with call scores. Cannot test with real data.');
        return;
      }

      console.log(`\nTesting scoring with ${usersWithScores.length} real users:`);
      console.log('-'.repeat(50));

      for (const user of usersWithScores) {
        if (!user.lastOutcome) continue;

        console.log(`\nUser ${user.userId}:`);
        console.log(`  Current Score: ${user.currentScore}`);
        console.log(`  Last Outcome: ${user.lastOutcome}`);
        console.log(`  Total Attempts: ${user.totalAttempts}`);

        // Test what would happen if they got the same outcome again
        const context: ScoringContext = {
          userId: Number(user.userId),
          userCreatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Estimate
          currentTime: new Date(),
          lastResetDate: user.lastResetDate || undefined,
          lastOutcome: user.lastOutcome,
          totalAttempts: user.totalAttempts || 1,
          lastCallAt: user.lastCallAt || new Date(),
          hasExistingRecord: true,
          currentScore: user.currentScore || 0
        };

        const newScore = await this.scoringService.calculatePriority(context);
        const expectedAdjustment = EXPECTED_SCORE_ADJUSTMENTS[user.lastOutcome as CallOutcomeType] || 0;
        
        console.log(`  Expected Adjustment: +${expectedAdjustment}`);
        console.log(`  New Calculated Score: ${newScore.finalScore}`);
        console.log(`  Score Change: ${newScore.finalScore - (user.currentScore || 0)}`);
        
        // Check if it looks like it's working correctly
        const actualChange = newScore.finalScore - (user.currentScore || 0);
        const isWorking = Math.abs(actualChange - expectedAdjustment) <= 15; // Allow for attempt penalties
        
        console.log(`  Status: ${isWorking ? '✅ Appears correct' : '❌ Unexpected score change'}`);
      }

    } catch (error) {
      console.error('Error testing with real users:', error);
    }
  }
}

async function main() {
  try {
    const diagnostic = new CallOutcomeScoringDiagnostic();
    await diagnostic.runDiagnostic();
  } catch (error) {
    console.error('Diagnostic failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
} 
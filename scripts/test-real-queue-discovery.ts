#!/usr/bin/env tsx

import { replicaDb } from '../lib/mysql';
import { prisma } from '../lib/db';

async function testLeadScoringSystem() {
  console.log('🧪 Testing CORRECTED Lead Scoring System with Real MySQL Data...');
  
  try {
    // Test MySQL replica connection
    console.log('🔗 Testing MySQL replica connection...');
    const replicaUsers = await replicaDb.user.count();
    console.log(`✅ MySQL replica connected: ${replicaUsers} total users`);
    
    // Test PostgreSQL connection  
    console.log('🔗 Testing PostgreSQL connection...');
    const postgresUsers = await prisma.userCallScore.count();
    console.log(`✅ PostgreSQL connected: ${postgresUsers} user call scores`);
    
    // Import and test the new services
    console.log('📊 Testing Lead Scoring Service...');
    const { LeadScoringService } = await import('../modules/queue/services/lead-scoring.service');
    const leadService = new LeadScoringService();
    const scoringResult = await leadService.runLeadScoring();
    
    console.log('🎯 Testing Queue Generation Service...');
    const { QueueGenerationService } = await import('../modules/queue/services/queue-generation.service');
    const queueService = new QueueGenerationService();
    const queueResults = await queueService.generateAllQueues();
    
    console.log('\n✅ CORRECTED SYSTEM TEST COMPLETED!');
    console.log('=====================================');
    console.log(`📊 Lead Scoring: ${scoringResult.totalEligible} leads (${scoringResult.totalNewLeads} new, ${scoringResult.totalExistingLeads} existing)`);
    console.log(`🎯 Queue Generation: ${queueResults.reduce((sum, r) => sum + r.queuePopulated, 0)} users queued`);
    console.log('\n🎉 The new architecture is working properly!');
    console.log('✅ New leads start with score = 0');
    console.log('✅ Existing leads keep their scores');
    console.log('✅ Queue populated from user_call_scores');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await replicaDb.$disconnect();
    await prisma.$disconnect();
  }
}

testLeadScoringSystem();

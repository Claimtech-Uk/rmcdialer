#!/usr/bin/env tsx
import { LeadScoringService } from '../modules/queue/services/lead-scoring.service';
import { QueueGenerationService } from '../modules/queue/services/queue-generation.service';

async function triggerQueueDiscovery() {
  console.log('🎯 Triggering CORRECTED lead scoring and queue generation...');
  
  try {
    // Step 1: Lead Scoring
    console.log('📊 Step 1: Lead scoring...');
    const leadService = new LeadScoringService();
    const scoringResult = await leadService.runLeadScoring();
    
    // Step 2: Queue Generation
    console.log('🎯 Step 2: Queue generation...');
    const queueService = new QueueGenerationService();
    const queueResults = await queueService.generateAllQueues();
    
    console.log('\n✅ CORRECTED system completed successfully!');
    console.log(`📊 Lead Scoring: ${scoringResult.totalEligible} leads (${scoringResult.totalNewLeads} new)`);
    console.log(`🎯 Queue Generation: ${queueResults.reduce((sum, r) => sum + r.queuePopulated, 0)} users queued`);
    
  } catch (error) {
    console.error('❌ Corrected system failed:', error);
    process.exit(1);
  }
}

triggerQueueDiscovery();

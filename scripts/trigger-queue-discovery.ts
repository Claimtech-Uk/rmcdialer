#!/usr/bin/env tsx

import { QueueDiscoveryService } from '../modules/queue/services/queue-discovery.service';

async function runQueueDiscovery() {
  console.log('🚀 Triggering Queue Discovery for Production...');
  
  try {
    const discoveryService = new QueueDiscoveryService();
    const report = await discoveryService.runHourlyDiscovery();
    
    console.log('✅ Queue Discovery completed!');
    console.log('📊 Summary:', report.summary);
    console.log('📋 Report:', JSON.stringify(report, null, 2));
    
  } catch (error) {
    console.error('❌ Queue Discovery failed:', error);
  }
}

runQueueDiscovery();

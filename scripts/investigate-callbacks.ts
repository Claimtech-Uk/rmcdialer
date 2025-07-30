#!/usr/bin/env tsx

import { config } from 'dotenv';
import path from 'path';
import { PrismaClient } from '@prisma/client';

// Load environment variables from .env.local and .env
config({ path: path.resolve(process.cwd(), '.env.local') });
config({ path: path.resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();

async function investigateCallbacks() {
  console.log('🔍 INVESTIGATING INBOUND CALL CALLBACK ISSUES\n');
  
  try {
    // Check recent call sessions (last 24 hours)
    const recentSessions = await prisma.callSession.findMany({
      where: {
        startedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      include: {
        agent: {
          select: { firstName: true, lastName: true }
        },
        callOutcomes: true
      },
      orderBy: { startedAt: 'desc' },
      take: 20
    });

    console.log(`📊 Found ${recentSessions.length} call sessions in the last 24 hours:\n`);
    
    recentSessions.forEach((session, index) => {
      console.log(`${index + 1}. Session ${session.id.slice(0, 8)}...`);
      console.log(`   Direction: ${session.direction}`);
      console.log(`   Status: ${session.status}`);
      console.log(`   Agent: ${session.agent?.firstName} ${session.agent?.lastName}`);
      console.log(`   Started: ${session.startedAt.toISOString()}`);
      console.log(`   Duration: ${session.durationSeconds || 0}s`);
      console.log(`   Last Outcome: ${session.lastOutcomeType || 'none'}`);
      console.log(`   Callback Scheduled: ${session.callbackScheduled}`);
      console.log(`   Outcomes Count: ${session.callOutcomes.length}`);
      console.log('');
    });

    // Check recent callbacks
    const recentCallbacks = await prisma.callback.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      include: {
        preferredAgent: {
          select: { firstName: true, lastName: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    console.log(`📞 Found ${recentCallbacks.length} callbacks in the last 24 hours:\n`);
    
    recentCallbacks.forEach((callback, index) => {
      console.log(`${index + 1}. Callback ${callback.id.slice(0, 8)}...`);
      console.log(`   User ID: ${callback.userId}`);
      console.log(`   Status: ${callback.status}`);
      console.log(`   Scheduled For: ${callback.scheduledFor.toISOString()}`);
      console.log(`   Reason: ${callback.callbackReason || 'No reason specified'}`);
      console.log(`   Preferred Agent: ${callback.preferredAgent?.firstName} ${callback.preferredAgent?.lastName}`);
      console.log(`   Original Session: ${callback.originalCallSessionId.slice(0, 8)}...`);
      console.log('');
    });

    // Check for inbound sessions without callbacks
    const inboundSessionsWithoutCallbacks = await prisma.callSession.findMany({
      where: {
        direction: 'inbound',
        startedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        },
        lastOutcomeType: 'call_back',
        callbackScheduled: true
      },
      include: {
        agent: {
          select: { firstName: true, lastName: true }
        }
      }
    });

    console.log(`⚠️ Found ${inboundSessionsWithoutCallbacks.length} inbound sessions marked for callback:\n`);
    
    inboundSessionsWithoutCallbacks.forEach((session, index) => {
      console.log(`${index + 1}. Session ${session.id.slice(0, 8)}... - Agent: ${session.agent?.firstName} ${session.agent?.lastName}`);
    });

    // Check if callbacks exist for these sessions
    if (inboundSessionsWithoutCallbacks.length > 0) {
      const sessionIds = inboundSessionsWithoutCallbacks.map(s => s.id);
      const matchingCallbacks = await prisma.callback.findMany({
        where: {
          originalCallSessionId: {
            in: sessionIds
          }
        }
      });

      console.log(`\n✅ Found ${matchingCallbacks.length} matching callback records for these sessions`);
      if (matchingCallbacks.length < inboundSessionsWithoutCallbacks.length) {
        console.log(`❌ MISSING CALLBACKS: ${inboundSessionsWithoutCallbacks.length - matchingCallbacks.length} sessions marked for callback but no callback record found!`);
      }
    }

    console.log('\n📈 SUMMARY:');
    console.log(`Total recent sessions: ${recentSessions.length}`);
    console.log(`Inbound sessions: ${recentSessions.filter(s => s.direction === 'inbound').length}`);
    console.log(`Sessions with outcomes: ${recentSessions.filter(s => s.lastOutcomeType).length}`);
    console.log(`Sessions with callbacks scheduled: ${recentSessions.filter(s => s.callbackScheduled).length}`);
    console.log(`Total callbacks created: ${recentCallbacks.length}`);

  } catch (error) {
    console.error('❌ Database investigation failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

investigateCallbacks().catch(console.error); 
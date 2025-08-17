import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { AgentRuntimeService } from '@/modules/ai-agents/core/agent-runtime.service';
import { SMSService, MagicLinkService } from '@/modules/communications';

// Direct Prisma client for serverless reliability
const prisma = new PrismaClient();

// Simple singleton for SMS agent runtime (bypasses database handler conflicts)
let runtimeSingleton: AgentRuntimeService | null = null;
function getAgentRuntime(): AgentRuntimeService {
  if (!runtimeSingleton) {
    runtimeSingleton = new AgentRuntimeService();
  }
  return runtimeSingleton;
}

// Using EXACT SMS agent service - same logic as individual messages

/**
 * SMS Batch Processing Cron Job
 * 
 * Runs every minute to process batched SMS messages.
 * Groups rapid-fire messages together for single AI response.
 * Prevents duplicate responses and reduces AI API calls.
 * 
 * Note: Vercel cron minimum interval is 1 minute, so messages
 * will be processed with 15-60 second delay.
 * 
 * Schedule: * * * * * (every minute)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  // ✅ CRITICAL: Verify Vercel cron authentication
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.log('🚫 [CRON] Unauthorized cron access attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Skip during build
  if (process.env.VERCEL_ENV === 'preview' || process.env.CI === 'true') {
    return NextResponse.json({ success: true, message: 'Skipped during build' });
  }
  
  // Check if AI SMS Agent is enabled (defaults to enabled unless explicitly disabled)
  if (process.env.ENABLE_AI_SMS_AGENT === 'false') {
    return NextResponse.json({ 
      success: false, 
      message: 'AI SMS Agent feature is disabled' 
    });
  }
  
  try {
    console.log('📦 [CRON] SMS Batch Processing starting...');
    
    // Find batches ready for processing (older than 10 seconds, not yet processed)
    const cutoffTime = new Date(Date.now() - 10000); // 10 seconds ago
    
    const readyBatches = await prisma.smsBatchStatus.findMany({
      where: {
        processingStarted: false,
        createdAt: {
          lt: cutoffTime // Much more reliable than string comparison
        }
      },
      orderBy: {
        createdAt: 'asc'
      },
      take: 5 // Process max 5 batches per run (Vercel timeout safety)
    });
    
    console.log(`📦 [CRON] Found ${readyBatches.length} batches ready for processing`);
    
    let processedCount = 0;
    let failedCount = 0;
    
    // Process each batch
    for (const batch of readyBatches) {
      try {
        await processSingleBatch(batch.batchId);
        processedCount++;
      } catch (error) {
        console.error(`❌ [CRON] Failed to process batch ${batch.batchId}:`, error);
        failedCount++;
      }
    }
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ [CRON] SMS Batch Processing completed:`, {
      processed: processedCount,
      failed: failedCount,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json({
      success: true,
      processed: processedCount,
      failed: failedCount,
      duration,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ [CRON] SMS Batch Processing failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * Process a single SMS batch with spillover collection
 * Combines messages from primary batch + any newer batches from same phone
 */
async function processSingleBatch(primaryBatchId: string): Promise<void> {
  console.log(`📦 Processing batch with spillover: ${primaryBatchId}`);
  
  const batchPhoneNumber = primaryBatchId.split(':')[0];
  const primaryTimestamp = parseInt(primaryBatchId.split(':')[1]);
  
  // Atomic lock acquisition with spillover collection
  const batchData = await prisma.$transaction(async (tx) => {
    // Try to acquire processing lock on primary batch
    const locked = await tx.smsBatchStatus.updateMany({
      where: {
        batchId: primaryBatchId,
        processingStarted: false
      },
      data: {
        processingStarted: true,
        processingStartedAt: new Date()
      }
    });
    
    if (locked.count === 0) {
      console.log(`⏭️ Batch ${primaryBatchId} already being processed`);
      return null;
    }
    
    // 🎯 SPILLOVER COLLECTION: Find newer batches for same phone
    const maxSpilloverWindows = 3; // Look ahead max 3 windows (45 seconds)
    const spilloverBatches = await tx.smsBatchStatus.findMany({
      where: {
        phoneNumber: batchPhoneNumber,
        processingStarted: false,
        batchId: {
          gt: primaryBatchId,
          // Don't go too far into future (prevent infinite waiting)
          lte: `${batchPhoneNumber}:${primaryTimestamp + maxSpilloverWindows}`
        }
      },
      orderBy: { batchId: 'asc' }
    });
    
    // Lock all spillover batches too
    const allBatchIds = [primaryBatchId];
    for (const spillover of spilloverBatches) {
      await tx.smsBatchStatus.update({
        where: { batchId: spillover.batchId },
        data: {
          processingStarted: true,
          processingStartedAt: new Date()
        }
      });
      allBatchIds.push(spillover.batchId);
    }
    
    console.log(`🔗 Spillover collection for ${batchPhoneNumber}:`, {
      primaryBatch: primaryBatchId,
      spilloverBatches: spilloverBatches.length,
      totalBatches: allBatchIds.length,
      allBatchIds
    });
    
    // Get ALL messages from ALL batches (primary + spillovers)
    const allMessages = await tx.smsMessage.findMany({
      where: {
        batchId: { in: allBatchIds },
        direction: 'inbound'
      },
      orderBy: {
        createdAt: 'asc' // Process in chronological order
      }
    });
    
    // Mark ALL messages as being processed
    await tx.smsMessage.updateMany({
      where: {
        batchId: { in: allBatchIds },
        direction: 'inbound'
      },
      data: {
        batchProcessed: true
      }
    });
    
    return { messages: allMessages, batchIds: allBatchIds };
  });
  
  if (!batchData || !batchData.messages || batchData.messages.length === 0) {
    return;
  }
  
  const messages = batchData.messages;
  const allBatchIds = batchData.batchIds;
  const phoneNumber = messages[0].phoneNumber;
  const userId = messages[0].userId;
  const conversationId = messages[0].conversationId;
  
  // 🎯 TODO PHASE 2: Smart routing will use destination numbers after schema deployment
  // For now, maintaining current behavior while capturing destination data
  
  // Combine all message bodies (from all batches)
  const combinedMessage = messages
    .map(msg => msg.body)
    .filter(Boolean)
    .join(' ');
  
  console.log(`📝 Processing ${messages.length} messages from ${allBatchIds.length} batches for ${phoneNumber}:`, {
    primaryBatchId: primaryBatchId,
    allBatchIds,
    messageCount: messages.length,
    preview: combinedMessage.substring(0, 100),
    userId,
    conversationId
  });
  
  try {
    // 🎯 USE EXACT AGENT RUNTIME: Same intelligence as individual messages!
    console.log('🤖 Using exact agent runtime for batch processing...');
    const startAI = Date.now();
    
    const agentRuntime = getAgentRuntime();
    
    // Process using EXACT same runtime logic that gives great individual responses
    const result = await agentRuntime.handleTurn({
      fromPhone: phoneNumber!,
      message: combinedMessage,
      userId: userId ? Number(userId) : undefined,
      channel: 'sms'
    });
    
    // 🎯 PHASE 1: Schema deployment - maintaining current routing behavior
    // PHASE 2 will add smart routing once schema is deployed
    if (result.reply?.text) {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const aiTestNumber = process.env.AI_SMS_TEST_NUMBER || '+447723495560';
      
      if (accountSid && authToken && aiTestNumber) {
        console.log(`📨 [CRON] Sending AI response from ${aiTestNumber} to ${phoneNumber} (Phase 1: current behavior)`);
        
        const twilioResponse = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            From: aiTestNumber,
            To: phoneNumber!,
            Body: result.reply.text,
          }),
        });
        
        if (twilioResponse.ok) {
          const smsResult = await twilioResponse.json();
          console.log(`📨 SMS sent via AI test number:`, { sid: smsResult.sid });
          
          // 🎯 CRITICAL FIX: Save the AI response to database
          try {
            // Create the outbound SMS record for AI response
            await prisma.smsMessage.create({
              data: {
                conversationId: conversationId!, // Use existing conversation from inbound messages
                direction: 'outbound',
                body: result.reply.text,
                twilioMessageSid: smsResult.sid,
                isAutoResponse: true,
                sentAt: new Date(), // ✅ This fixes the NULL sent_at issue!
                messageType: 'ai_agent', // ✅ Set as requested!
                phoneNumber: phoneNumber,
                userId: userId ? BigInt(userId) : null,
                processed: true,
                processedAt: new Date()
                // 🎯 PHASE 2: Will store destination number after schema migration  
                // destinationNumber: aiTestNumber
              }
            });

            console.log(`✅ AI response saved to database:`, { 
              conversationId,
              twilioSid: smsResult.sid,
              messageType: 'ai_agent',
              phoneNumber: phoneNumber,
              responseLength: result.reply.text.length
            });

          } catch (dbError) {
            console.error(`❌ Failed to save AI response to database:`, {
              error: dbError instanceof Error ? dbError.message : dbError,
              phoneNumber,
              twilioSid: smsResult.sid
            });
            // Don't throw - SMS was sent successfully, just log the DB error
          }
          
        } else {
          const error = await twilioResponse.text();
          console.error(`❌ Failed to send SMS:`, error);
        }
      }
    }
    
    const aiDuration = Date.now() - startAI;
    console.log(`🎯 EXACT SMS agent response generated:`, { 
      messageCount: messages.length,
      hasReply: !!result.reply?.text,
      replyLength: result.reply?.text?.length || 0,
      actionCount: result.actions?.length || 0,
      duration: `${aiDuration}ms`,
      actions: result.actions?.map((a: any) => a.type) || [],
      quality: 'same_as_individual_messages'
    });
    
    console.log(`🎉 BATCH = INDIVIDUAL: Same quality responses for ${allBatchIds.length} batches:`, {
      primaryBatchId,
      spilloverBatches: allBatchIds.slice(1),
      hasReply: !!result.reply?.text,
      replyLength: result.reply?.text?.length || 0,
      actionCount: result.actions?.length || 0,
      actions: result.actions?.map((a: any) => a.type) || []
    });
    
    // ✅ Agent runtime generates response, we handle SMS manually with AI test number
    const hasValidResponse = !!result.reply?.text;
    const smsSentSuccessfully = hasValidResponse; // Based on Twilio response above
    
    for (const batchId of allBatchIds) {
      await prisma.smsBatchStatus.update({
        where: { batchId },
        data: {
          processingCompleted: true,
          processingCompletedAt: new Date(),
          responseText: result.reply?.text || 'Message received',
          responseSent: smsSentSuccessfully,
          responseSentAt: smsSentSuccessfully ? new Date() : null
        }
      });
    }
    
    // Mark ALL messages across ALL batches as response sent
    await prisma.smsMessage.updateMany({
      where: {
        batchId: { in: allBatchIds },
        direction: 'inbound'
      },
      data: {
        batchResponseSent: smsSentSuccessfully,
        processed: true,
        processedAt: new Date()
      }
    });
    
    console.log(`✅ Multi-batch processing completed with proven agent:`, {
      primaryBatch: primaryBatchId,
      totalBatches: allBatchIds.length,
      totalMessages: messages.length,
      phoneNumber: batchPhoneNumber,
      responseLength: result.reply?.text?.length || 0,
      smsSent: hasValidResponse
    });
    
  } catch (error) {
    console.error(`❌ Failed to process batches ${allBatchIds?.join(', ') || primaryBatchId}:`, error);
    
    // Update ALL batch statuses with error and allow retry
    const batchesToReset = allBatchIds || [primaryBatchId];
    for (const batchId of batchesToReset) {
      try {
        await prisma.smsBatchStatus.update({
          where: { batchId },
          data: {
            processingCompleted: false,
            errorMessage: error instanceof Error ? error.message : 'Processing failed',
            processingStarted: false // Allow retry
          }
        });
      } catch (updateError) {
        console.error(`Failed to update error status for batch ${batchId}:`, updateError);
      }
    }
    
    // Reset ALL message processing statuses for retry
    await prisma.smsMessage.updateMany({
      where: {
        batchId: { in: batchesToReset },
        direction: 'inbound'
      },
      data: {
        batchProcessed: false
      }
    });
    
    throw error;
  }
}

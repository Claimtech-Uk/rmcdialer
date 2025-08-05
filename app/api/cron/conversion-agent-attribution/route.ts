import { NextRequest, NextResponse } from 'next/server'
import { ConversionAgentAttributionService } from '@/modules/discovery/services/conversion-agent-attribution.service'

// Standard cron execution logging (following pattern from other cron jobs)
async function logCronExecution(jobName: string, status: 'running' | 'success' | 'failed', duration: number, details: any, error?: string) {
  try {
    const logData = {
      job_name: jobName,
      status,
      duration_ms: duration,
      details,
      executed_at: new Date().toISOString(),
      error: error || null
    }
    
    console.log(`📊 [CRON LOG] ${jobName}:`, logData)
    
    // Future: Could store in database for monitoring
    // await prisma.cronExecutionLog.create({ data: logData })
    
  } catch (logError) {
    console.error('Failed to log cron execution:', logError);
  }
}

function getNextRunTime(): string {
  const now = new Date()
  const nextRun = new Date(now.getTime() + 15 * 60 * 1000) // Add 15 minutes
  return nextRun.toISOString()
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    console.log('🏷️ [CRON] Conversion Agent Attribution starting...')
    
    // Log start
    await logCronExecution('conversion-agent-attribution', 'running', 0, { 
      message: 'Conversion agent attribution started',
      timestamp: new Date().toISOString()
    });
    
    const attributionService = new ConversionAgentAttributionService()
    const result = await attributionService.attributeAgentsToConversions()
    
    const duration = Date.now() - startTime
    
    console.log(`✅ [CRON] Conversion Agent Attribution completed: ${result.summary} (${duration}ms)`)
    
    // Log success
    await logCronExecution('conversion-agent-attribution', 'success', duration, {
      totalUnattributedConversions: result.totalUnattributedConversions,
      conversionsChecked: result.conversionsChecked,
      conversionsAttributed: result.conversionsAttributed,
      conversionsSkippedNoCallHistory: result.conversionsSkippedNoCallHistory,
      batchesProcessed: result.batchesProcessed,
      processingStrategy: result.processingStrategy,
      completed: result.completed,
      summary: result.summary
    });
    
    // Convert BigInt values to strings for JSON serialization
    const serializedAttributions = result.attributions.map(attribution => ({
      ...attribution,
      userId: attribution.userId.toString()
    }))

    return NextResponse.json({
      success: result.success,
      duration,
      timestamp: result.timestamp,
      summary: result.summary,
      stats: {
        totalUnattributedConversions: result.totalUnattributedConversions,
        conversionsChecked: result.conversionsChecked,
        conversionsAttributed: result.conversionsAttributed,
        conversionsSkippedNoCallHistory: result.conversionsSkippedNoCallHistory,
        batchesProcessed: result.batchesProcessed,
        processingStrategy: result.processingStrategy,
        completed: result.completed
      },
      attributions: serializedAttributions,
      errors: result.errors,
      nextRun: getNextRunTime()
    })

  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    
    console.error(`❌ [CRON ERROR] Conversion Agent Attribution failed:`, error)
    
    // Log failure
    await logCronExecution('conversion-agent-attribution', 'failed', duration, {
      errorMessage,
      timestamp: new Date().toISOString()
    }, errorMessage);

    return NextResponse.json({
      success: false,
      duration,
      timestamp: new Date(),
      summary: `❌ Attribution Failed: ${errorMessage}`,
      error: errorMessage,
      nextRun: getNextRunTime()
    }, { 
      status: 500 
    })
  }
} 
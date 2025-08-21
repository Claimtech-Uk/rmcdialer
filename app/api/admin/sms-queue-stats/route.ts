import { NextRequest, NextResponse } from 'next/server'
import { databaseSmsHandler } from '@/modules/ai-agents/channels/sms/database-sms-handler'

export async function GET(request: NextRequest) {
  try {
    // Get database SMS processing statistics (replaces old queue stats)
    const stats = await databaseSmsHandler.getProcessingStats()
    
    const response = {
      timestamp: new Date().toISOString(),
      processing: {
        unprocessed: stats.unprocessed,
        processing: stats.processing,
        processed: stats.processed,
        stuck: stats.stuck
      },
      system: {
        type: 'database_first_processing',
        queueSystem: 'disabled - using immediate processing'
      },
      health: {
        status: stats.stuck > 10 ? 'warning' : 'healthy',
        message: stats.stuck > 10 
          ? `${stats.stuck} messages stuck in processing`
          : 'SMS processing operating normally'
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching SMS processing stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch processing stats' },
      { status: 500 }
    )
  }
}

// Clean stuck processing (replaces queue clear)
export async function DELETE(request: NextRequest) {
  try {
    // Clean stuck messages instead of clearing queue
    const cleaned = await databaseSmsHandler.cleanStuckProcessing(5)

    return NextResponse.json({
      message: `Cleaned ${cleaned} stuck messages`,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error cleaning stuck processing:', error)
    return NextResponse.json(
      { error: 'Failed to clean stuck processing' },
      { status: 500 }
    )
  }
}

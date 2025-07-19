import { NextResponse } from 'next/server'

// Global CDC runner instance (in production this would be managed differently)
let cdcRunnerInstance: any = null

export async function GET() {
  try {
    // Check if CDC service is available
    if (!process.env.SQS_QUEUE_URL) {
      return NextResponse.json({
        status: 'disabled',
        message: 'CDC not configured - missing SQS_QUEUE_URL',
        timestamp: new Date().toISOString()
      })
    }

    // Try to get health from CDC runner if available
    if (cdcRunnerInstance) {
      const health = cdcRunnerInstance.getHealth()
      
      return NextResponse.json({
        status: health.isRunning ? 'healthy' : 'unhealthy',
        cdc: {
          isRunning: health.isRunning,
          uptime: health.uptime,
          restartCount: health.restartCount,
          stats: health.stats
        },
        environment: {
          region: process.env.AWS_REGION,
          queueConfigured: !!process.env.SQS_QUEUE_URL,
          nodeEnv: process.env.NODE_ENV
        },
        timestamp: new Date().toISOString()
      })
    }

    // CDC runner not initialized yet
    return NextResponse.json({
      status: 'initializing',
      message: 'CDC service not started yet',
      environment: {
        region: process.env.AWS_REGION,
        queueConfigured: !!process.env.SQS_QUEUE_URL,
        nodeEnv: process.env.NODE_ENV
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('CDC health check error:', error)
    
    return NextResponse.json({
      status: 'error',
      message: 'Failed to check CDC health',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// Endpoint to manually trigger cache invalidation (for testing)
export async function POST(request: Request) {
  try {
    const { userId } = await request.json()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    // Import and trigger cache invalidation
    const { UserService } = await import('@/modules/users')
    const userService = new UserService()
    
    await userService.invalidateUserCache(userId)
    
    return NextResponse.json({
      success: true,
      message: `Cache invalidated for user ${userId}`,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Manual cache invalidation error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
} 
// Background CDC Runner
// Manages the CDC processor as a background service with health monitoring

import { CDCProcessor } from './cdc-processor.service'

interface CDCServiceHealth {
  isRunning: boolean
  lastHeartbeat: Date
  stats: any
  uptime: number
  restartCount: number
}

export class BackgroundCDCRunner {
  private processor: CDCProcessor
  private startTime: Date = new Date()
  private restartCount: number = 0
  private isHealthy: boolean = true
  private healthCheckInterval: NodeJS.Timeout | null = null

  private readonly logger = {
    info: (message: string, meta?: any) => console.log(`[CDC Runner] ${message}`, meta || ''),
    error: (message: string, error?: any) => console.error(`[CDC Runner ERROR] ${message}`, error || ''),
    warn: (message: string, meta?: any) => console.warn(`[CDC Runner WARN] ${message}`, meta || '')
  }

  constructor() {
    this.processor = new CDCProcessor()
    
    // Setup graceful shutdown handlers
    this.setupGracefulShutdown()
  }

  /**
   * Start the CDC background service
   */
  async start(): Promise<void> {
    this.logger.info('🚀 Starting CDC background service')
    
    try {
      // Start health monitoring
      this.startHealthMonitoring()
      
      // Start the CDC processor
      await this.processor.startProcessing()
      
    } catch (error) {
      this.logger.error('Failed to start CDC service:', error)
      this.restartCount++
      
      // Attempt restart after delay
      setTimeout(() => this.start(), 10000)
    }
  }

  /**
   * Stop the CDC background service
   */
  async stop(): Promise<void> {
    this.logger.info('🛑 Stopping CDC background service')
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }
    
    await this.processor.stopProcessing()
  }

  /**
   * Get service health information
   */
  getHealth(): CDCServiceHealth {
    return {
      isRunning: this.isHealthy,
      lastHeartbeat: new Date(),
      stats: this.processor.getStats(),
      uptime: Date.now() - this.startTime.getTime(),
      restartCount: this.restartCount
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      const stats = this.processor.getStats()
      const timeSinceLastProcess = Date.now() - stats.lastProcessedAt.getTime()
      
      // Consider unhealthy if no processing for 10 minutes
      if (timeSinceLastProcess > 10 * 60 * 1000) {
        this.logger.warn('CDC processor appears stalled', {
          timeSinceLastProcess: timeSinceLastProcess / 1000,
          stats
        })
        this.isHealthy = false
      } else {
        this.isHealthy = true
      }
      
      // Log periodic health status
      if (stats.messagesProcessed > 0) {
        this.logger.info('CDC health check', {
          messagesProcessed: stats.messagesProcessed,
          errors: stats.errors,
          uptime: Date.now() - this.startTime.getTime()
        })
      }
      
    }, 60000) // Check every minute
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      this.logger.info(`Received ${signal}, shutting down gracefully`)
      await this.stop()
      process.exit(0)
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('SIGINT', () => shutdown('SIGINT'))
    
    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception:', error)
      this.restartCount++
      setTimeout(() => this.start(), 5000)
    })

    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled rejection:', { reason, promise })
    })
  }
}

// If this file is run directly, start the CDC service
if (require.main === module) {
  const runner = new BackgroundCDCRunner()
  runner.start().catch(console.error)
} 
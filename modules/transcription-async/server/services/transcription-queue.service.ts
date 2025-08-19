// Server-only transcription queue service using Redis
// Persistent, serverless-friendly background job processing

import { cacheService } from '@/lib/redis'
import type { TranscriptStatus } from '../../client/types/index'

export interface TranscriptionJob {
  callId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  createdAt: number
  startedAt?: number
  completedAt?: number
  error?: string
  progress?: number
  downloadUrl?: string
}

export class TranscriptionQueueService {
  private static readonly QUEUE_KEY = 'transcription:queue'
  private static readonly JOB_PREFIX = 'transcription:job:'
  private static readonly STATUS_PREFIX = 'transcription:status:'
  private static readonly JOB_TTL = 24 * 60 * 60 // 24 hours

  /**
   * Add a new transcription job to the queue
   */
  async addJob(callId: string): Promise<string> {
    const jobId = `${callId}-${Date.now()}`
    const job: TranscriptionJob = {
      callId,
      status: 'pending',
      createdAt: Date.now()
    }

    // Store job details using cache service
    await cacheService.set(
      `${TranscriptionQueueService.JOB_PREFIX}${jobId}`,
      job,
      TranscriptionQueueService.JOB_TTL
    )

    // Get current queue and add new job
    const currentQueue = await cacheService.get(TranscriptionQueueService.QUEUE_KEY) || []
    currentQueue.push(jobId)
    await cacheService.set(TranscriptionQueueService.QUEUE_KEY, currentQueue, TranscriptionQueueService.JOB_TTL)

    // Store status for quick lookup
    await cacheService.set(
      `${TranscriptionQueueService.STATUS_PREFIX}${callId}`,
      {
        status: 'pending',
        jobId,
        createdAt: Date.now()
      },
      TranscriptionQueueService.JOB_TTL
    )

    console.log(`🎙️ [TRANSCRIPTION-QUEUE] Job ${jobId} added for call ${callId}`)
    return jobId
  }

  /**
   * Get the next job from the queue for processing
   */
  async getNextJob(): Promise<TranscriptionJob | null> {
    // Get current queue
    const queue = await cacheService.get(TranscriptionQueueService.QUEUE_KEY) || []
    
    if (queue.length === 0) {
      return null // No jobs available
    }

    // Get first job ID (FIFO)
    const jobId = queue.shift()
    
    // Update queue
    await cacheService.set(TranscriptionQueueService.QUEUE_KEY, queue, TranscriptionQueueService.JOB_TTL)
    
    // Get job details
    const job = await cacheService.get(`${TranscriptionQueueService.JOB_PREFIX}${jobId}`)
    
    if (!job || !job.callId) {
      console.warn(`⚠️ [TRANSCRIPTION-QUEUE] Job ${jobId} not found or invalid`)
      return null
    }

    // Mark as processing
    await this.updateJobStatus(jobId, 'processing', { startedAt: Date.now() })

    console.log(`🎬 [TRANSCRIPTION-QUEUE] Processing job ${jobId} for call ${job.callId}`)
    return job
  }

  /**
   * Update job status and details
   */
  async updateJobStatus(
    jobId: string, 
    status: TranscriptionJob['status'],
    updates: Partial<TranscriptionJob> = {}
  ): Promise<void> {
    // Get existing job
    const existingJob = await cacheService.get(`${TranscriptionQueueService.JOB_PREFIX}${jobId}`)
    
    if (!existingJob) {
      console.warn(`⚠️ [TRANSCRIPTION-QUEUE] Cannot update job ${jobId} - not found`)
      return
    }

    const callId = existingJob.callId

    // Update job record
    const updatedJob = {
      ...existingJob,
      status,
      ...updates,
      updatedAt: Date.now()
    }
    
    await cacheService.set(
      `${TranscriptionQueueService.JOB_PREFIX}${jobId}`,
      updatedJob,
      TranscriptionQueueService.JOB_TTL
    )

    // Update quick status lookup
    const statusData = {
      status,
      jobId,
      updatedAt: Date.now(),
      ...(updates.progress && { progress: updates.progress }),
      ...(updates.downloadUrl && { downloadUrl: updates.downloadUrl }),
      ...(updates.error && { error: updates.error })
    }
    
    await cacheService.set(
      `${TranscriptionQueueService.STATUS_PREFIX}${callId}`,
      statusData,
      TranscriptionQueueService.JOB_TTL
    )

    console.log(`📊 [TRANSCRIPTION-QUEUE] Job ${jobId} status: ${status}`)
  }

  /**
   * Get transcription status for a call
   */
  async getCallStatus(callId: string): Promise<{
    status: TranscriptStatus
    progress?: number
    downloadUrl?: string
    error?: string
  } | null> {
    const statusData = await cacheService.get(`${TranscriptionQueueService.STATUS_PREFIX}${callId}`)
    
    if (!statusData || !statusData.status) {
      return null
    }

    return {
      status: statusData.status,
      progress: statusData.progress,
      downloadUrl: statusData.downloadUrl,
      error: statusData.error
    }
  }

  /**
   * Mark job as completed with download URL
   */
  async completeJob(jobId: string, downloadUrl: string): Promise<void> {
    await this.updateJobStatus(jobId, 'completed', {
      completedAt: Date.now(),
      downloadUrl
    })
  }

  /**
   * Mark job as failed with error message
   */
  async failJob(jobId: string, error: string): Promise<void> {
    await this.updateJobStatus(jobId, 'failed', {
      completedAt: Date.now(),
      error
    })
  }

  /**
   * Clean up old completed/failed jobs (called by cron)
   */
  async cleanup(): Promise<{ cleaned: number }> {
    // For now, rely on TTL for cleanup
    // Could implement pattern-based cleanup if needed
    console.log(`🧹 [TRANSCRIPTION-QUEUE] Cleanup relying on TTL (24h auto-expiry)`)
    return { cleaned: 0 }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    pending: number
    processing: number
    completed: number
    failed: number
  }> {
    const queue = await cacheService.get(TranscriptionQueueService.QUEUE_KEY) || []
    
    // For simplified stats, just return queue length as pending
    // In a full Redis implementation, we'd scan all job keys
    const stats = { 
      pending: queue.length,
      processing: 0, 
      completed: 0, 
      failed: 0 
    }

    return stats
  }
}

// Singleton instance for reuse across the application
export const transcriptionQueue = new TranscriptionQueueService()

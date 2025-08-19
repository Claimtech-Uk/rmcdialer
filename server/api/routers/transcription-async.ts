import { z } from 'zod'
import { createTRPCRouter, publicProcedure } from '@/lib/trpc/server'
import { transcriptionQueue } from '@/modules/transcription-async/server/services/transcription-queue.service'
import { prisma } from '@/lib/db'

// Input validation schemas
const CallIdSchema = z.object({
  callId: z.string().min(1, 'Call ID is required')
})

const QueueTranscriptionSchema = z.object({
  callId: z.string().min(1, 'Call ID is required')
})

/**
 * tRPC router for async transcription operations
 * Uses existing auth patterns and integrates cleanly with the frontend
 */
export const transcriptionAsyncRouter = createTRPCRouter({
  /**
   * Queue a transcription job
   */
  queue: publicProcedure
    .input(QueueTranscriptionSchema)
    .mutation(async ({ input }) => {
      const { callId } = input

      try {
        // Check if already processing/completed
        const existingStatus = await transcriptionQueue.getCallStatus(callId)
        
        if (existingStatus?.status === 'processing') {
          return {
            success: true,
            message: 'Transcription already in progress',
            status: existingStatus.status,
            alreadyQueued: true
          }
        }

        if (existingStatus?.status === 'completed') {
          return {
            success: true,
            message: 'Transcription already completed',
            status: existingStatus.status,
            downloadUrl: existingStatus.downloadUrl,
            alreadyCompleted: true
          }
        }

        // Add to queue
        const jobId = await transcriptionQueue.addJob(callId)
        
        console.log(`🎙️ [TRPC] Queued transcription job ${jobId} for call ${callId}`)
        
        return {
          success: true,
          message: 'Transcription queued successfully',
          jobId,
          callId,
          status: 'pending' as const
        }
        
      } catch (error) {
        console.error('❌ [TRPC] Queue error:', error)
        throw new Error(`Failed to queue transcription: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }),

  /**
   * Get transcription status for a call
   */
  getStatus: publicProcedure
    .input(CallIdSchema)
    .query(async ({ input }) => {
      const { callId } = input

      try {
        const status = await transcriptionQueue.getCallStatus(callId)
        
        if (!status) {
          return {
            success: true,
            status: 'idle' as const,
            message: 'No transcription found for this call'
          }
        }

        return {
          success: true,
          ...status
        }
        
      } catch (error) {
        console.error('❌ [TRPC] Status check error:', error)
        throw new Error(`Failed to check transcription status: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }),

  /**
   * Download completed transcription
   */
  download: publicProcedure
    .input(z.object({
      callId: z.string().min(1, 'Call ID is required'),
      format: z.enum(['txt', 'json', 'srt']).optional().default('txt')
    }))
    .mutation(async ({ input }) => {
      const { callId, format } = input

      try {
        // Get transcription from database
        const callSession = await prisma.callSession.findUnique({
          where: { id: callId },
          select: {
            id: true,
            transcriptStatus: true,
            transcriptText: true,
            transcriptSummary: true,
            startedAt: true,
            durationSeconds: true,
            agent: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        })

        if (!callSession) {
          throw new Error('Call session not found')
        }

        if (callSession.transcriptStatus !== 'completed' || !callSession.transcriptText) {
          throw new Error(`Transcription not available (status: ${callSession.transcriptStatus})`)
        }

        // Generate download URL (the actual file serving will be handled by the download API)
        const downloadUrl = `/api/transcription-async/download/${callId}?format=${format}`
        
        return {
          success: true,
          downloadUrl,
          callId,
          format,
          transcriptLength: callSession.transcriptText.length,
          hasSummary: !!callSession.transcriptSummary
        }
        
      } catch (error) {
        console.error('❌ [TRPC] Download error:', error)
        throw new Error(`Failed to prepare download: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }),

  /**
   * Get queue statistics (for monitoring)
   */
  getQueueStats: publicProcedure
    .query(async () => {
      try {
        const stats = await transcriptionQueue.getQueueStats()
        
        return {
          success: true,
          stats,
          timestamp: new Date().toISOString()
        }
      } catch (error) {
        console.error('❌ [TRPC] Queue stats error:', error)
        throw new Error(`Failed to get queue stats: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    })
})

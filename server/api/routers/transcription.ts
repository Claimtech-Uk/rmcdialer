import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '@/lib/trpc/server';
import { TRPCError } from '@trpc/server';
import { transcriptionService } from '@/modules/transcription';
import type {
  TranscriptionTriggerRequest,
  TranscriptionTriggerResponse,
  TranscriptionStatusResponse
} from '@/modules/transcription';

// Validation schemas
const CallSessionIdSchema = z.object({
  callSessionId: z.string().min(1, 'Call session ID is required')
});

const TriggerTranscriptionSchema = z.object({
  callSessionId: z.string().min(1, 'Call session ID is required'),
  forceRetranscribe: z.boolean().optional().default(false)
});

const DownloadTranscriptionSchema = z.object({
  callSessionId: z.string().min(1, 'Call session ID is required'),
  format: z.enum(['txt', 'json', 'srt']).optional().default('txt')
});

export const transcriptionRouter = createTRPCRouter({
  // Trigger transcription for a call
  trigger: protectedProcedure
    .input(TriggerTranscriptionSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { callSessionId, forceRetranscribe } = input;
        
        console.log(`🎙️ [tRPC] Triggering transcription for call ${callSessionId} by agent ${ctx.agent.id}`);

        // Check if user has permission to access this call session
        // You might want to add authorization logic here
        
        await transcriptionService.transcribeCall(callSessionId, forceRetranscribe);
        
        const response: TranscriptionTriggerResponse = {
          success: true,
          callSessionId,
          status: 'processing',
          message: 'Transcription started successfully',
          estimatedWaitTimeSeconds: 120
        };

        console.log(`✅ [tRPC] Transcription triggered successfully for call ${callSessionId}`);
        return response;

      } catch (error: any) {
        console.error(`❌ [tRPC] Transcription trigger error:`, error);
        
        // Handle specific error types
        if (error.message?.includes('not found')) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Call session not found or no recording available'
          });
        }
        
        if (error.message?.includes('already')) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: error.message
          });
        }
        
        if (error.message?.includes('Cooldown')) {
          throw new TRPCError({
            code: 'TOO_MANY_REQUESTS',
            message: error.message
          });
        }
        
        if (error.message?.includes('too long')) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Audio file is too long for transcription'
          });
        }
        
        // Generic server error
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to start transcription. Please try again.'
        });
      }
    }),

  // Get transcription status
  status: protectedProcedure
    .input(CallSessionIdSchema)
    .query(async ({ input, ctx }) => {
      try {
        const { callSessionId } = input;
        
        console.log(`🔍 [tRPC] Checking transcription status for call ${callSessionId}`);

        const transcriptionResult = await transcriptionService.getTranscriptionStatus(callSessionId);
        
        if (!transcriptionResult) {
          // Return null status instead of throwing error
          const response: TranscriptionStatusResponse = {
            callSessionId,
            status: null
          };
          return response;
        }

        // Calculate progress
        let progress: number | undefined;
        if (transcriptionResult.status === 'pending') {
          progress = 10;
        } else if (transcriptionResult.status === 'processing') {
          progress = 50;
        } else if (transcriptionResult.status === 'completed') {
          progress = 100;
        } else if (transcriptionResult.status === 'failed') {
          progress = 0;
        }

        const response: TranscriptionStatusResponse = {
          callSessionId,
          status: transcriptionResult.status,
          transcriptText: transcriptionResult.transcriptText,
          transcriptSummary: transcriptionResult.transcriptSummary,
          transcriptUrl: transcriptionResult.transcriptUrl,
          progress,
          failureReason: transcriptionResult.failureReason,
          completedAt: transcriptionResult.completedAt,
          wordCount: transcriptionResult.wordCount,
          confidence: transcriptionResult.confidence,
          language: transcriptionResult.language
        };

        return response;

      } catch (error: any) {
        console.error(`❌ [tRPC] Status check error:`, error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to check transcription status'
        });
      }
    }),

  // Download transcription
  download: protectedProcedure
    .input(DownloadTranscriptionSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { callSessionId, format } = input;
        
        console.log(`📥 [tRPC] Download request for call ${callSessionId}, format: ${format}`);

        const transcriptionResult = await transcriptionService.getTranscriptionStatus(callSessionId);
        
        if (!transcriptionResult) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Transcription not found'
          });
        }

        if (transcriptionResult.status !== 'completed' || !transcriptionResult.transcriptText) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Transcription not completed or text not available'
          });
        }

        // Generate download URL (points to our API endpoint)
        const downloadUrl = `/api/transcription/download/${callSessionId}?format=${format}`;

        return {
          success: true,
          downloadUrl,
          format,
          callSessionId,
          wordCount: transcriptionResult.wordCount,
          fileSize: transcriptionResult.transcriptText.length
        };

      } catch (error: any) {
        console.error(`❌ [tRPC] Download error:`, error);
        
        if (error instanceof TRPCError) {
          throw error;
        }
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to prepare download'
        });
      }
    }),

  // Get transcription analytics (for admin/reporting)
  analytics: protectedProcedure
    .input(z.object({
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      agentId: z.number().optional()
    }).optional())
    .query(async ({ input, ctx }) => {
      try {
        // This is a placeholder for analytics functionality
        // You could implement detailed analytics here
        
        console.log(`📊 [tRPC] Analytics request by agent ${ctx.agent.id}`);
        
        // For now, return basic stats
        // In a real implementation, you'd query the database for transcription metrics
        
        return {
          totalTranscriptions: 0,
          successfulTranscriptions: 0,
          failedTranscriptions: 0,
          averageProcessingTimeSeconds: 0,
          totalAudioMinutesProcessed: 0,
          popularLanguages: [],
          errorBreakdown: []
        };

      } catch (error: any) {
        console.error(`❌ [tRPC] Analytics error:`, error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve analytics'
        });
      }
    }),

  // Batch status check for multiple calls
  batchStatus: protectedProcedure
    .input(z.object({
      callSessionIds: z.array(z.string().uuid()).max(50, 'Maximum 50 calls per batch')
    }))
    .query(async ({ input, ctx }) => {
      try {
        const { callSessionIds } = input;
        
        console.log(`🔍 [tRPC] Batch status check for ${callSessionIds.length} calls`);

        const results = await Promise.allSettled(
          callSessionIds.map(async (callSessionId) => {
            const result = await transcriptionService.getTranscriptionStatus(callSessionId);
            return {
              callSessionId,
              status: result?.status || null,
              hasTranscript: !!result?.transcriptText,
              wordCount: result?.wordCount,
              completedAt: result?.completedAt
            };
          })
        );

        const transcriptionStatuses = results
          .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
          .map(result => result.value);

        return {
          results: transcriptionStatuses,
          summary: {
            total: callSessionIds.length,
            completed: transcriptionStatuses.filter(r => r.status === 'completed').length,
            processing: transcriptionStatuses.filter(r => r.status === 'processing').length,
            failed: transcriptionStatuses.filter(r => r.status === 'failed').length,
            notStarted: transcriptionStatuses.filter(r => r.status === null).length
          }
        };

      } catch (error: any) {
        console.error(`❌ [tRPC] Batch status error:`, error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to check batch status'
        });
      }
    })
});

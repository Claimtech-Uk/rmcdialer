import OpenAI from 'openai';
import { prisma } from '@/lib/db';
import type {
  TranscriptionResult,
  TranscriptStatus,
  WhisperTranscriptionOptions,
  WhisperTranscriptionResult,
  SummaryGenerationOptions,
  SummaryGenerationResult,
  TranscriptionError,
  TranscriptionConfig
} from '../types/transcription.types';

// Lazy initialization following existing patterns
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not set');
    }
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

// Configuration with sensible defaults
const DEFAULT_CONFIG: TranscriptionConfig = {
  maxAudioDurationMinutes: 30, // Reasonable limit for call recordings
  supportedAudioFormats: ['wav', 'mp3', 'ogg', 'webm', 'aac'],
  defaultLanguage: 'en',
  autoSummaryEnabled: true,
  cooldownSeconds: 60, // Prevent duplicate requests
  maxRetries: 3,
  apiTimeoutSeconds: 300 // 5 minutes for Whisper processing
};

export class TranscriptionService {
  private config: TranscriptionConfig;
  private processingCooldowns: Map<string, Date> = new Map();

  constructor(config?: Partial<TranscriptionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Main entry point: Transcribe a call recording
   */
  async transcribeCall(
    callSessionId: string,
    forceRetranscribe: boolean = false
  ): Promise<TranscriptionResult> {
    console.log(`🎙️ [TRANSCRIPTION] Starting transcription for call ${callSessionId}`);

    try {
      // 1. Validate call session and get recording info
      const callSession = await this.validateCallSession(callSessionId);
      
      // 2. Check cooldown and existing status
      await this.checkCooldownAndStatus(callSessionId, forceRetranscribe);
      
      // 3. Update status to processing
      await this.updateTranscriptionStatus(callSessionId, 'processing');
      
      // 4. Download and process audio
      const audioBuffer = await this.downloadAudioFile(callSession.recordingUrl!);
      
      // 5. Transcribe with OpenAI Whisper
      const whisperResult = await this.transcribeWithWhisper(audioBuffer, {
        language: this.config.defaultLanguage,
        prompt: this.buildContextPrompt(callSession),
        temperature: 0.2 // Lower for more accurate transcription
      });
      
      // 6. Generate AI summary if enabled
      let summaryResult: SummaryGenerationResult | undefined;
      if (this.config.autoSummaryEnabled) {
        summaryResult = await this.generateSummary(whisperResult.text, {
          callContext: {
            agentName: callSession.agent?.firstName + ' ' + callSession.agent?.lastName,
            callDirection: callSession.direction || 'outbound',
            callDurationSeconds: callSession.durationSeconds || undefined,
            callOutcome: callSession.lastOutcomeType || undefined
          }
        });
      }
      
      // 7. Update database with results
      const result = await this.saveTranscriptionResult(callSessionId, {
        transcriptText: whisperResult.text,
        transcriptSummary: summaryResult?.summary,
        confidence: whisperResult.confidence,
        language: whisperResult.language,
        wordCount: whisperResult.text.split(/\s+/).length
      });
      
      console.log(`✅ [TRANSCRIPTION] Completed successfully for call ${callSessionId}`);
      return result;
      
    } catch (error: any) {
      console.error(`❌ [TRANSCRIPTION] Failed for call ${callSessionId}:`, error);
      
      // Update status to failed with error details
      await this.updateTranscriptionStatus(callSessionId, 'failed', error.message);
      
      // Convert to our error type
      const transcriptionError: TranscriptionError = this.normalizeError(error);
      throw transcriptionError;
    }
  }

  /**
   * Get current transcription status for a call
   */
  async getTranscriptionStatus(callSessionId: string): Promise<TranscriptionResult | null> {
    try {
      const callSession = await prisma.callSession.findUnique({
        where: { id: callSessionId },
        select: {
          id: true,
          transcriptStatus: true,
          transcriptText: true,
          transcriptSummary: true,
          transcriptUrl: true,
          recordingUrl: true,
          recordingDurationSeconds: true,
          createdAt: true,
          updatedAt: true
        }
      });

      if (!callSession) {
        return null;
      }

      return {
        id: callSession.id,
        callSessionId: callSession.id,
        status: callSession.transcriptStatus as TranscriptStatus,
        transcriptText: callSession.transcriptText || undefined,
        transcriptSummary: callSession.transcriptSummary || undefined,
        transcriptUrl: callSession.transcriptUrl || undefined,
        audioUrl: callSession.recordingUrl || undefined,
        audioDurationSeconds: callSession.recordingDurationSeconds || undefined,
        wordCount: callSession.transcriptText?.split(/\s+/).length || undefined,
        createdAt: callSession.createdAt,
        updatedAt: callSession.updatedAt
      };
    } catch (error) {
      console.error(`❌ [TRANSCRIPTION] Failed to get status for call ${callSessionId}:`, error);
      throw this.normalizeError(error);
    }
  }

  /**
   * Validate call session has required recording data
   */
  private async validateCallSession(callSessionId: string) {
    const callSession = await prisma.callSession.findUnique({
      where: { id: callSessionId },
      include: {
        agent: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (!callSession) {
      throw new Error(`Call session ${callSessionId} not found`);
    }

    if (!callSession.recordingUrl) {
      throw new Error(`No recording URL found for call ${callSessionId}`);
    }

    if (callSession.recordingStatus !== 'completed') {
      throw new Error(`Recording not completed for call ${callSessionId}. Status: ${callSession.recordingStatus}`);
    }

    // Check duration limits
    if (callSession.recordingDurationSeconds && 
        callSession.recordingDurationSeconds > (this.config.maxAudioDurationMinutes * 60)) {
      throw new Error(`Recording too long: ${callSession.recordingDurationSeconds}s exceeds limit of ${this.config.maxAudioDurationMinutes} minutes`);
    }

    return callSession;
  }

  /**
   * Check cooldown period and existing transcription status
   */
  private async checkCooldownAndStatus(callSessionId: string, forceRetranscribe: boolean) {
    // Check cooldown
    const lastProcessing = this.processingCooldowns.get(callSessionId);
    if (lastProcessing && Date.now() - lastProcessing.getTime() < (this.config.cooldownSeconds * 1000)) {
      throw new Error(`Cooldown active. Please wait ${this.config.cooldownSeconds} seconds between transcription requests`);
    }

    // Check existing status
    const existing = await this.getTranscriptionStatus(callSessionId);
    if (existing && !forceRetranscribe) {
      if (existing.status === 'processing') {
        throw new Error('Transcription already in progress');
      }
      if (existing.status === 'completed') {
        throw new Error('Transcription already completed. Use forceRetranscribe=true to re-process');
      }
    }

    // Set cooldown
    this.processingCooldowns.set(callSessionId, new Date());
  }

  /**
   * Download audio file from recording URL
   */
  private async downloadAudioFile(recordingUrl: string): Promise<ArrayBuffer> {
    console.log(`📥 [TRANSCRIPTION] Downloading audio from: ${recordingUrl}`);

    // Use Twilio authentication for recording access
    const authHeader = `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`;
    
    const response = await fetch(recordingUrl, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'audio/*'
      },
      signal: AbortSignal.timeout(this.config.apiTimeoutSeconds * 1000)
    });

    if (!response.ok) {
      throw new Error(`Failed to download audio: ${response.status} ${response.statusText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    console.log(`📁 [TRANSCRIPTION] Downloaded ${audioBuffer.byteLength} bytes`);

    return audioBuffer;
  }

  /**
   * Transcribe audio using OpenAI Whisper
   */
  private async transcribeWithWhisper(
    audioBuffer: ArrayBuffer,
    options: WhisperTranscriptionOptions
  ): Promise<WhisperTranscriptionResult> {
    console.log(`🤖 [TRANSCRIPTION] Starting Whisper transcription`);

    try {
      // Create File object for OpenAI API
      const audioFile = new File([audioBuffer], 'recording.wav', { type: 'audio/wav' });

      const transcription = await getOpenAIClient().audio.transcriptions.create({
        file: audioFile,
        model: options.model || 'whisper-1',
        language: options.language === 'auto-detect' ? undefined : options.language,
        prompt: options.prompt,
        temperature: options.temperature || 0,
        response_format: 'verbose_json' // Get detailed response with segments
      });

      console.log(`✅ [TRANSCRIPTION] Whisper completed. Text length: ${transcription.text.length}`);

      return {
        text: transcription.text,
        language: transcription.language,
        duration: transcription.duration,
        segments: transcription.segments?.map(segment => ({
          id: segment.id,
          start: segment.start,
          end: segment.end,
          text: segment.text,
          confidence: segment.avg_logprob // Map to confidence score
        }))
      };
    } catch (error: any) {
      console.error(`❌ [TRANSCRIPTION] Whisper API error:`, error);
      throw new Error(`Whisper transcription failed: ${error.message}`);
    }
  }

  /**
   * Generate AI summary of the transcript
   */
  private async generateSummary(
    transcriptText: string,
    options: SummaryGenerationOptions
  ): Promise<SummaryGenerationResult> {
    console.log(`📝 [TRANSCRIPTION] Generating AI summary`);

    const systemPrompt = `You are an expert call analyst for a UK motor finance claims company. 
Analyze this call transcript and provide a structured summary focusing on:

1. Key points discussed
2. Customer sentiment and engagement
3. Action items or next steps
4. Important details mentioned
5. Call outcome and effectiveness

Respond in JSON format:
{
  "summary": "Brief 2-3 sentence overview",
  "keyPoints": ["point 1", "point 2", "point 3"],
  "actionItems": ["action 1", "action 2"],
  "sentiment": "positive|neutral|negative",
  "topics": ["topic 1", "topic 2"],
  "confidence": 0.85
}`;

    const userPrompt = `Call Context:
${options.callContext ? `Agent: ${options.callContext.agentName}` : ''}
${options.callContext ? `Direction: ${options.callContext.callDirection}` : ''}
${options.callContext ? `Duration: ${options.callContext.callDurationSeconds}s` : ''}
${options.callContext ? `Outcome: ${options.callContext.callOutcome}` : ''}

Transcript:
${transcriptText}`;

    try {
      const response = await getOpenAIClient().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 800,
        response_format: { type: 'json_object' }
      });

      const result = response.choices[0]?.message?.content;
      if (!result) {
        throw new Error('No response from OpenAI');
      }

      const parsed = JSON.parse(result);
      console.log(`✅ [TRANSCRIPTION] Summary generated successfully`);

      return {
        summary: parsed.summary || 'Summary generation failed',
        keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
        actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
        sentiment: parsed.sentiment || 'neutral',
        topics: Array.isArray(parsed.topics) ? parsed.topics : [],
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5
      };
    } catch (error: any) {
      console.error(`❌ [TRANSCRIPTION] Summary generation error:`, error);
      // Return basic summary on failure
      return {
        summary: 'AI summary generation failed',
        keyPoints: ['Summary could not be generated'],
        actionItems: [],
        sentiment: 'neutral',
        topics: [],
        confidence: 0
      };
    }
  }

  /**
   * Build context prompt for better Whisper accuracy
   */
  private buildContextPrompt(callSession: any): string {
    const prompts = [
      'This is a customer service call recording.',
      'The conversation is about motor finance claims and PCP agreements.',
      'Common terms include: claim, lender, finance, PCP, HP, vehicle, documents, requirements.'
    ];

    if (callSession.agent?.firstName) {
      prompts.push(`The agent's name is ${callSession.agent.firstName}.`);
    }

    return prompts.join(' ');
  }

  /**
   * Update transcription status in database
   */
  private async updateTranscriptionStatus(
    callSessionId: string,
    status: TranscriptStatus,
    failureReason?: string
  ): Promise<void> {
    const updateData: any = {
      transcriptStatus: status,
      updatedAt: new Date()
    };

    if (status === 'processing') {
      // Clear any previous failure reason
      updateData.transcriptText = null;
      updateData.transcriptSummary = null;
    }

    if (failureReason) {
      // Store failure reason in notes or a dedicated field
      console.log(`📝 [TRANSCRIPTION] Failure reason for ${callSessionId}: ${failureReason}`);
    }

    await prisma.callSession.update({
      where: { id: callSessionId },
      data: updateData
    });
  }

  /**
   * Save successful transcription results to database
   */
  private async saveTranscriptionResult(
    callSessionId: string,
    result: {
      transcriptText: string;
      transcriptSummary?: string;
      confidence?: number;
      language?: string;
      wordCount?: number;
    }
  ): Promise<TranscriptionResult> {
    const updatedSession = await prisma.callSession.update({
      where: { id: callSessionId },
      data: {
        transcriptStatus: 'completed',
        transcriptText: result.transcriptText,
        transcriptSummary: result.transcriptSummary,
        updatedAt: new Date()
      }
    });

    return {
      id: updatedSession.id,
      callSessionId: updatedSession.id,
      status: 'completed',
      transcriptText: result.transcriptText,
      transcriptSummary: result.transcriptSummary,
      confidence: result.confidence,
      language: result.language,
      wordCount: result.wordCount,
      completedAt: new Date(),
      createdAt: updatedSession.createdAt,
      updatedAt: updatedSession.updatedAt
    };
  }

  /**
   * Normalize errors to our TranscriptionError type
   */
  private normalizeError(error: any): TranscriptionError {
    if (error.message?.includes('not found')) {
      return {
        code: 'CALL_SESSION_NOT_FOUND',
        message: error.message,
        retryable: false
      };
    }

    if (error.message?.includes('already in progress')) {
      return {
        code: 'ALREADY_PROCESSING',
        message: error.message,
        retryable: false
      };
    }

    if (error.message?.includes('Cooldown active')) {
      return {
        code: 'ALREADY_PROCESSING',
        message: error.message,
        retryable: true
      };
    }

    if (error.message?.includes('too long')) {
      return {
        code: 'AUDIO_TOO_LONG',
        message: error.message,
        retryable: false
      };
    }

    if (error.message?.includes('download audio')) {
      return {
        code: 'AUDIO_NOT_FOUND',
        message: error.message,
        retryable: true
      };
    }

    if (error.message?.includes('Whisper')) {
      return {
        code: 'WHISPER_API_ERROR',
        message: error.message,
        retryable: true
      };
    }

    // Default to network error
    return {
      code: 'NETWORK_ERROR',
      message: error.message || 'Unknown transcription error',
      retryable: true
    };
  }
}

// Export singleton instance
export const transcriptionService = new TranscriptionService();

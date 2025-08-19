// Server-only transcription processing service
// Uses existing OpenAI utilities and follows established patterns

import { prisma } from '@/lib/db'
import OpenAI from 'openai'
import { transcriptionQueue, type TranscriptionJob } from './transcription-queue.service'

interface TranscriptionConfig {
  maxAudioDurationMinutes: number
  defaultLanguage: string
  autoSummaryEnabled: boolean
  timeoutSeconds: number
}

const DEFAULT_CONFIG: TranscriptionConfig = {
  maxAudioDurationMinutes: 30,
  defaultLanguage: 'en',
  autoSummaryEnabled: true,
  timeoutSeconds: 300 // 5 minutes for Whisper processing
}

export class TranscriptionProcessorService {
  private config: TranscriptionConfig
  private openai: OpenAI | null = null

  constructor(config?: Partial<TranscriptionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Get OpenAI client with lazy initialization
   */
  private getOpenAIClient(): OpenAI {
    if (!this.openai) {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY not configured')
      }
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      })
    }
    return this.openai
  }

  /**
   * Process a single transcription job from the queue
   */
  async processJob(job: TranscriptionJob): Promise<void> {
    const { callId } = job
    console.log(`🎙️ [TRANSCRIPTION-PROCESSOR] Starting transcription for call ${callId}`)

    try {
      // 1. Validate call session and get recording info
      const callSession = await this.validateCallSession(callId)
      
      // 2. Update progress
      await this.updateProgress(callId, 'processing', 10)
      
      // 3. Download audio file
      const audioBuffer = await this.downloadAudioFile(callSession.recordingUrl!)
      await this.updateProgress(callId, 'processing', 30)
      
      // 4. Transcribe with OpenAI Whisper
      const transcriptText = await this.transcribeWithWhisper(audioBuffer, callSession)
      await this.updateProgress(callId, 'processing', 70)
      
      // 5. Generate summary if enabled
      let summary: string | undefined
      if (this.config.autoSummaryEnabled && transcriptText) {
        summary = await this.generateSummary(transcriptText, callSession)
        await this.updateProgress(callId, 'processing', 90)
      }
      
      // 6. Save to database
      await this.saveTranscriptionResult(callId, transcriptText, summary)
      await this.updateProgress(callId, 'processing', 95)
      
      // 7. Mark as completed
      const downloadUrl = `/api/transcription-async/download/${callId}`
      await transcriptionQueue.completeJob(`${callId}-${job.createdAt}`, downloadUrl)
      
      console.log(`✅ [TRANSCRIPTION-PROCESSOR] Completed transcription for call ${callId}`)
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(`❌ [TRANSCRIPTION-PROCESSOR] Failed to transcribe call ${callId}:`, error)
      
      await transcriptionQueue.failJob(`${callId}-${job.createdAt}`, errorMessage)
    }
  }

  /**
   * Validate call session exists and has recording
   */
  private async validateCallSession(callId: string) {
    const callSession = await prisma.callSession.findUnique({
      where: { id: callId },
      include: {
        agent: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    })

    if (!callSession) {
      throw new Error(`Call session ${callId} not found`)
    }

    if (!callSession.recordingUrl) {
      throw new Error(`No recording URL for call ${callId}`)
    }

    if (callSession.recordingStatus !== 'completed') {
      throw new Error(`Recording not ready for call ${callId} (status: ${callSession.recordingStatus})`)
    }

    return callSession
  }

  /**
   * Download audio file from Twilio
   */
  private async downloadAudioFile(recordingUrl: string): Promise<ArrayBuffer> {
    console.log(`📥 [TRANSCRIPTION-PROCESSOR] Downloading audio from ${recordingUrl.substring(0, 50)}...`)
    
    const response = await fetch(recordingUrl, {
      headers: {
        'Authorization': `Basic ${Buffer.from(
          `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
        ).toString('base64')}`
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to download audio: ${response.status} ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    
    // Validate file size (prevent huge files)
    const fileSizeMB = arrayBuffer.byteLength / (1024 * 1024)
    if (fileSizeMB > 25) { // OpenAI Whisper limit is 25MB
      throw new Error(`Audio file too large: ${fileSizeMB.toFixed(1)}MB (max 25MB)`)
    }

    console.log(`📥 [TRANSCRIPTION-PROCESSOR] Downloaded ${fileSizeMB.toFixed(1)}MB audio file`)
    return arrayBuffer
  }

  /**
   * Transcribe audio using OpenAI Whisper
   */
  private async transcribeWithWhisper(audioBuffer: ArrayBuffer, callSession: any): Promise<string> {
    console.log(`🤖 [TRANSCRIPTION-PROCESSOR] Starting Whisper transcription...`)
    
    const openai = this.getOpenAIClient()
    
    // Convert ArrayBuffer to File for OpenAI
    const audioFile = new File([audioBuffer], `call-${callSession.id}.mp3`, {
      type: 'audio/mpeg'
    })

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: this.config.defaultLanguage,
      prompt: this.buildContextPrompt(callSession),
      temperature: 0.2, // Lower for more accurate transcription
      response_format: 'text'
    })

    if (!transcription || typeof transcription !== 'string') {
      throw new Error('Invalid transcription response from OpenAI')
    }

    console.log(`🤖 [TRANSCRIPTION-PROCESSOR] Transcription completed: ${transcription.length} characters`)
    return transcription
  }

  /**
   * Generate AI summary of transcription
   */
  private async generateSummary(transcriptText: string, callSession: any): Promise<string> {
    console.log(`📝 [TRANSCRIPTION-PROCESSOR] Generating summary...`)
    
    const openai = this.getOpenAIClient()
    
    const prompt = `Please provide a concise summary of this customer service call:

Call Context:
- Agent: ${callSession.agent?.firstName} ${callSession.agent?.lastName}
- Duration: ${callSession.durationSeconds ? Math.round(callSession.durationSeconds / 60) : 'Unknown'} minutes
- Outcome: ${callSession.lastOutcomeType || 'Unknown'}

Transcript:
${transcriptText}

Please summarize in 2-3 sentences covering:
1. Main purpose of the call
2. Key outcomes or next steps
3. Customer sentiment (if apparent)`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Fast and cost-effective
      messages: [
        { role: 'system', content: 'You are a customer service call summarization expert.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 200
    })

    const summary = completion.choices[0]?.message?.content?.trim()
    
    if (!summary) {
      throw new Error('Failed to generate summary')
    }

    console.log(`📝 [TRANSCRIPTION-PROCESSOR] Summary generated: ${summary.length} characters`)
    return summary
  }

  /**
   * Build context prompt for better transcription accuracy
   */
  private buildContextPrompt(callSession: any): string {
    return `This is a customer service call about insurance claims. The agent is helping a customer with their claim process. Common terms include: claim, policy, documents, requirements, signature, portal, magic link.`
  }

  /**
   * Save transcription results to database
   */
  private async saveTranscriptionResult(callId: string, transcriptText: string, summary?: string): Promise<void> {
    await prisma.callSession.update({
      where: { id: callId },
      data: {
        transcriptStatus: 'completed',
        transcriptText,
        transcriptSummary: summary,
        transcriptUrl: `/api/transcription-async/download/${callId}`,
        updatedAt: new Date()
      }
    })

    console.log(`💾 [TRANSCRIPTION-PROCESSOR] Saved transcription to database for call ${callId}`)
  }

  /**
   * Update job progress (simplified for cache service)
   */
  private async updateProgress(callId: string, status: 'processing', progress: number): Promise<void> {
    // For now, just log progress - full progress tracking can be added later
    console.log(`📊 [TRANSCRIPTION-PROCESSOR] Call ${callId} progress: ${progress}%`)
  }
}

// Singleton instance
export const transcriptionProcessor = new TranscriptionProcessorService()

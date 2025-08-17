import { NextRequest, NextResponse } from 'next/server'
import { transcriptionService } from '@/modules/transcription'

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { callSessionId: string } }
) {
  try {
    const { callSessionId } = params
    
    // Safely extract search params with validation
    let format = 'txt'
    try {
      // Use nextUrl which is guaranteed to be valid in Next.js
      const searchParams = request.nextUrl?.searchParams || new URLSearchParams()
      format = searchParams.get('format') || 'txt'
    } catch (urlError) {
      console.warn(`⚠️ [API] URL parsing failed, using default format:`, urlError)
      // format already defaults to 'txt'
    }
    
    console.log(`📥 [API] Download request for call ${callSessionId}, format: ${format}`)

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(callSessionId)) {
      return NextResponse.json({
        error: 'Invalid call session ID format'
      }, { status: 400 })
    }

    // Validate format
    if (!['txt', 'json', 'srt'].includes(format)) {
      return NextResponse.json({
        error: 'Invalid format. Supported formats: txt, json, srt'
      }, { status: 400 })
    }

    // Get transcription data
    const transcriptionResult = await transcriptionService.getTranscriptionStatus(callSessionId)
    
    if (!transcriptionResult) {
      return NextResponse.json({
        error: 'Transcription not found'
      }, { status: 404 })
    }

    if (transcriptionResult.status !== 'completed' || !transcriptionResult.transcriptText) {
      return NextResponse.json({
        error: 'Transcription not completed or text not available'
      }, { status: 400 })
    }

    // Generate content based on format
    let content: string
    let contentType: string
    let filename: string

    switch (format) {
      case 'txt':
        content = formatAsText(transcriptionResult)
        contentType = 'text/plain'
        filename = `transcript-${callSessionId}.txt`
        break
        
      case 'json':
        content = JSON.stringify(formatAsJSON(transcriptionResult), null, 2)
        contentType = 'application/json'
        filename = `transcript-${callSessionId}.json`
        break
        
      case 'srt':
        content = formatAsSRT(transcriptionResult)
        contentType = 'text/srt'
        filename = `transcript-${callSessionId}.srt`
        break
        
      default:
        throw new Error('Unsupported format')
    }

    console.log(`✅ [API] Download prepared for call ${callSessionId}, size: ${content.length} chars`)

    // Return file content with appropriate headers
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': Buffer.byteLength(content, 'utf8').toString(),
        'Cache-Control': 'private, max-age=3600', // Cache for 1 hour
      },
    })

  } catch (error: any) {
    console.error(`❌ [API] Download error for call ${params.callSessionId}:`, error)
    
    return NextResponse.json({
      error: 'Failed to download transcript',
      message: error.message || 'Internal server error'
    }, { status: 500 })
  }
}

// Format transcription as plain text
function formatAsText(transcriptionResult: any): string {
  const lines = [
    `Call Transcript - ${new Date().toLocaleString()}`,
    `Call Session ID: ${transcriptionResult.callSessionId}`,
    `Status: ${transcriptionResult.status}`,
    ''
  ]

  if (transcriptionResult.transcriptSummary) {
    lines.push('=== AI SUMMARY ===')
    lines.push(transcriptionResult.transcriptSummary)
    lines.push('')
  }

  lines.push('=== FULL TRANSCRIPT ===')
  lines.push(transcriptionResult.transcriptText)
  
  if (transcriptionResult.wordCount) {
    lines.push('')
    lines.push(`Word Count: ${transcriptionResult.wordCount}`)
  }
  
  if (transcriptionResult.language) {
    lines.push(`Language: ${transcriptionResult.language}`)
  }
  
  if (transcriptionResult.confidence) {
    lines.push(`Confidence: ${Math.round(transcriptionResult.confidence * 100)}%`)
  }

  return lines.join('\n')
}

// Format transcription as JSON
function formatAsJSON(transcriptionResult: any) {
  return {
    metadata: {
      callSessionId: transcriptionResult.callSessionId,
      status: transcriptionResult.status,
      completedAt: transcriptionResult.completedAt,
      wordCount: transcriptionResult.wordCount,
      language: transcriptionResult.language,
      confidence: transcriptionResult.confidence,
      exportedAt: new Date().toISOString()
    },
    summary: transcriptionResult.transcriptSummary,
    transcript: {
      text: transcriptionResult.transcriptText,
      segments: transcriptionResult.segments || []
    }
  }
}

// Format transcription as SRT subtitles
function formatAsSRT(transcriptionResult: any): string {
  // If we have segments with timestamps, use them
  if (transcriptionResult.segments && transcriptionResult.segments.length > 0) {
    return transcriptionResult.segments
      .map((segment: any, index: number) => {
        const startTime = formatSRTTime(segment.start || 0)
        const endTime = formatSRTTime(segment.end || segment.start + 3)
        
        return `${index + 1}\n${startTime} --> ${endTime}\n${segment.text}\n`
      })
      .join('\n')
  }
  
  // Fallback: Split text into chunks and create artificial timestamps
  const words = transcriptionResult.transcriptText.split(' ')
  const chunks = []
  const wordsPerChunk = 10
  
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    chunks.push(words.slice(i, i + wordsPerChunk).join(' '))
  }
  
  return chunks
    .map((chunk, index) => {
      const startSeconds = index * 3 // 3 seconds per chunk
      const endSeconds = (index + 1) * 3
      const startTime = formatSRTTime(startSeconds)
      const endTime = formatSRTTime(endSeconds)
      
      return `${index + 1}\n${startTime} --> ${endTime}\n${chunk}\n`
    })
    .join('\n')
}

// Format time for SRT format (HH:MM:SS,mmm)
function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const milliseconds = Math.floor((seconds % 1) * 1000)
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`
}

// Health check endpoint
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

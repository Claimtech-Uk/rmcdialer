import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 10 // Quick file serving

/**
 * Download Transcription API
 * 
 * Serves completed transcriptions as downloadable files.
 * Supports multiple formats: txt, json, srt
 * 
 * DESIGN PRINCIPLES:
 * - Fast file serving
 * - Proper MIME types
 * - Safe filename generation
 * - No complex URL construction
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { callId: string } }
) {
  try {
    const { callId } = params
    
    // Safe URL parsing - using Next.js built-in params
    const searchParams = request.nextUrl?.searchParams
    const format = searchParams?.get('format') || 'txt'

    // Validate callId
    if (!callId || typeof callId !== 'string' || callId.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Valid callId is required' 
        },
        { status: 400 }
      )
    }

    // Validate format
    if (!['txt', 'json', 'srt'].includes(format)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Format must be txt, json, or srt' 
        },
        { status: 400 }
      )
    }

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
      return NextResponse.json(
        { 
          success: false, 
          error: 'Call session not found' 
        },
        { status: 404 }
      )
    }

    if (callSession.transcriptStatus !== 'completed' || !callSession.transcriptText) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Transcription not available',
          status: callSession.transcriptStatus 
        },
        { status: 404 }
      )
    }

    // Generate content based on format
    let content: string
    let mimeType: string
    let filename: string

    switch (format) {
      case 'json':
        content = JSON.stringify({
          callId: callSession.id,
          transcriptText: callSession.transcriptText,
          transcriptSummary: callSession.transcriptSummary,
          startedAt: callSession.startedAt,
          durationSeconds: callSession.durationSeconds,
          agent: callSession.agent,
          generatedAt: new Date().toISOString()
        }, null, 2)
        mimeType = 'application/json'
        filename = `transcript-${callId}.json`
        break

      case 'srt':
        // Simple SRT format (single subtitle for entire call)
        const duration = callSession.durationSeconds || 300
        content = `1
00:00:00,000 --> ${formatSRTTime(duration)}
${callSession.transcriptText}

`
        mimeType = 'text/srt'
        filename = `transcript-${callId}.srt`
        break

      default: // txt
        content = `Call Transcription
================

Call ID: ${callSession.id}
Date: ${callSession.startedAt}
Agent: ${callSession.agent?.firstName} ${callSession.agent?.lastName}
Duration: ${callSession.durationSeconds ? Math.round(callSession.durationSeconds / 60) : 'Unknown'} minutes

Transcript:
-----------
${callSession.transcriptText}

${callSession.transcriptSummary ? `
Summary:
--------
${callSession.transcriptSummary}
` : ''}

Generated: ${new Date().toISOString()}
`
        mimeType = 'text/plain'
        filename = `transcript-${callId}.txt`
        break
    }

    // Return file with proper headers
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': Buffer.byteLength(content, 'utf8').toString(),
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      }
    })
    
  } catch (error) {
    console.error('❌ [TRANSCRIPTION-DOWNLOAD] Download error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to download transcription',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * Helper function to format seconds as SRT time format
 */
function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`
}

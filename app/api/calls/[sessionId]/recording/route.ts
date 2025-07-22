import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params;

    // Get call session with recording information
    const callSession = await prisma.callSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        twilioCallSid: true,
        recordingUrl: true,
        recordingSid: true,
        recordingStatus: true,
        recordingDurationSeconds: true,
        status: true,
        direction: true,
        startedAt: true,
        endedAt: true,
        durationSeconds: true,
        // Include user and agent info for security check
        userId: true,
        agentId: true,
        agent: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (!callSession) {
      return NextResponse.json(
        { error: 'Call session not found' },
        { status: 404 }
      );
    }

    // Check if recording exists and is completed
    if (!callSession.recordingUrl || callSession.recordingStatus !== 'completed') {
      return NextResponse.json({
        hasRecording: false,
        status: callSession.recordingStatus || 'no_recording',
        message: callSession.recordingStatus === 'failed' 
          ? 'Recording failed' 
          : 'Recording not available'
      }, { status: 404 });
    }

    // Check if this is a download request
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Download recording from Twilio with authentication
    const authHeader = `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`;
    
    console.log(`📥 Fetching recording from Twilio: ${callSession.recordingUrl}`);
    const recordingResponse = await fetch(callSession.recordingUrl, {
      headers: {
        'Authorization': authHeader,
      },
    });

    if (!recordingResponse.ok) {
      console.error(`❌ Failed to fetch recording from Twilio: ${recordingResponse.status} ${recordingResponse.statusText}`);
      return NextResponse.json(
        { error: 'Recording not available from Twilio' },
        { status: 404 }
      );
    }

    // Get the recording buffer
    const recordingBuffer = await recordingResponse.arrayBuffer();
    
    // Detect and set proper content type based on Twilio's response
    const twilioContentType = recordingResponse.headers.get('content-type') || '';
    console.log(`🎵 Twilio content-type: ${twilioContentType}`);
    
    let contentType = 'audio/wav'; // Default fallback
    let fileExtension = 'wav';
    
    // Map Twilio content types to browser-compatible MIME types
    if (twilioContentType.includes('mp3') || twilioContentType.includes('mpeg')) {
      contentType = 'audio/mpeg';
      fileExtension = 'mp3';
    } else if (twilioContentType.includes('wav')) {
      contentType = 'audio/wav';
      fileExtension = 'wav';
    } else if (twilioContentType.includes('ogg')) {
      contentType = 'audio/ogg';
      fileExtension = 'ogg';
    } else if (twilioContentType.includes('webm')) {
      contentType = 'audio/webm';
      fileExtension = 'webm';
    } else if (twilioContentType.includes('aac')) {
      contentType = 'audio/aac';
      fileExtension = 'aac';
    }
    
    console.log(`🎵 Serving audio as: ${contentType} (${fileExtension})`);

    // Stream the recording
    if (action === 'stream') {
      return new NextResponse(recordingBuffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Length': recordingBuffer.byteLength.toString(),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'private, max-age=3600',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Range, Content-Range, Content-Length',
        },
      });
    }

    // Download the recording
    if (action === 'download') {
      const filename = `recording-${callSession.id}-${new Date(callSession.startedAt).toISOString().split('T')[0]}.${fileExtension}`;
      
      return new NextResponse(recordingBuffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Length': recordingBuffer.byteLength.toString(),
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'private, max-age=3600',
        },
      });
    }

    // Default: Return recording metadata
    return NextResponse.json({
      hasRecording: true,
      recording: {
        sessionId: callSession.id,
        twilioCallSid: callSession.twilioCallSid,
        recordingSid: callSession.recordingSid,
        status: callSession.recordingStatus,
        durationSeconds: callSession.recordingDurationSeconds,
        streamUrl: `/api/calls/${sessionId}/recording?action=stream`,
        downloadUrl: `/api/calls/${sessionId}/recording?action=download`,
        callInfo: {
          direction: callSession.direction,
          startedAt: callSession.startedAt,
          endedAt: callSession.endedAt,
          durationSeconds: callSession.durationSeconds,
          agentName: `${callSession.agent.firstName} ${callSession.agent.lastName}`
        }
      },
      message: 'Recording available for playback and download'
    });

  } catch (error: any) {
    console.error('Recording API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
} 
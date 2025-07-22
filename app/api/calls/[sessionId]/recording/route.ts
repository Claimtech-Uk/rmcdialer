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

    if (action === 'download') {
      // Proxy the recording download with Twilio authentication
      try {
        const authHeader = `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`;
        
        const recordingResponse = await fetch(callSession.recordingUrl, {
          headers: {
            'Authorization': authHeader,
            'Accept': 'audio/wav,audio/mpeg,audio/*,*/*'
          }
        });

        if (!recordingResponse.ok) {
          throw new Error(`Failed to fetch recording: ${recordingResponse.status}`);
        }

        // Get the audio data
        const audioBuffer = await recordingResponse.arrayBuffer();
        const contentType = recordingResponse.headers.get('content-type') || 'audio/wav';
        
        // Generate filename with call info
        const fileName = `call-recording-${sessionId}-${callSession.twilioCallSid}.wav`;

        // Return the audio file as a download
        return new NextResponse(audioBuffer, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Content-Disposition': `attachment; filename="${fileName}"`,
            'Content-Length': audioBuffer.byteLength.toString(),
            'Cache-Control': 'private, max-age=3600', // Cache for 1 hour
          }
        });

      } catch (error: any) {
        console.error('Failed to proxy recording download:', error);
        return NextResponse.json(
          { error: 'Failed to download recording', details: error.message },
          { status: 500 }
        );
      }
    }

    if (action === 'stream') {
      // Proxy the recording for streaming/playback
      try {
        const authHeader = `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`;
        
        const recordingResponse = await fetch(callSession.recordingUrl, {
          headers: {
            'Authorization': authHeader,
            'Accept': 'audio/wav,audio/mpeg,audio/*,*/*',
            'Range': request.headers.get('range') || ''
          }
        });

        if (!recordingResponse.ok) {
          throw new Error(`Failed to fetch recording: ${recordingResponse.status}`);
        }

        // Forward the audio stream with proper headers for browser playback
        const audioBuffer = await recordingResponse.arrayBuffer();
        const contentType = recordingResponse.headers.get('content-type') || 'audio/wav';

        return new NextResponse(audioBuffer, {
          status: recordingResponse.status,
          headers: {
            'Content-Type': contentType,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'private, max-age=3600',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': 'Range, Content-Range, Content-Length',
          }
        });

      } catch (error: any) {
        console.error('Failed to proxy recording stream:', error);
        return NextResponse.json(
          { error: 'Failed to stream recording', details: error.message },
          { status: 500 }
        );
      }
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
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

    // Check if recording exists
    if (!callSession.recordingUrl || callSession.recordingStatus !== 'completed') {
      return NextResponse.json({
        hasRecording: false,
        status: callSession.recordingStatus || 'no_recording',
        message: callSession.recordingStatus === 'failed' 
          ? 'Recording failed' 
          : 'Recording not available'
      });
    }

    // Return recording information
    return NextResponse.json({
      hasRecording: true,
      recording: {
        url: callSession.recordingUrl,
        sid: callSession.recordingSid,
        status: callSession.recordingStatus,
        durationSeconds: callSession.recordingDurationSeconds,
        callInfo: {
          sessionId: callSession.id,
          twilioCallSid: callSession.twilioCallSid,
          direction: callSession.direction,
          startedAt: callSession.startedAt,
          endedAt: callSession.endedAt,
          durationSeconds: callSession.durationSeconds,
          agentName: `${callSession.agent.firstName} ${callSession.agent.lastName}`
        }
      }
    });

  } catch (error) {
    console.error('Error fetching recording:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recording' },
      { status: 500 }
    );
  }
} 
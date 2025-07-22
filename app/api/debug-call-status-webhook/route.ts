import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { callSid, testStatus, isDialEvent } = await request.json();
    
    if (!callSid) {
      return NextResponse.json({ 
        error: 'callSid required' 
      }, { status: 400 });
    }

    console.log(`🧪 Testing call status webhook processing for CallSid: ${callSid}`);

    // Find the call session
    const callSession = await prisma.callSession.findFirst({
      where: { twilioCallSid: callSid },
      include: {
        agent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    if (!callSession) {
      return NextResponse.json({
        success: false,
        error: 'Call session not found',
        callSid: callSid
      }, { status: 404 });
    }

    // Mock webhook data for testing
    const mockFormData = new FormData();
    mockFormData.append('CallSid', callSid);
    mockFormData.append('CallStatus', isDialEvent ? 'in-progress' : testStatus);
    mockFormData.append('Direction', callSession.direction);
    mockFormData.append('From', '+447738585850');
    mockFormData.append('To', '+447488879172');
    
    if (isDialEvent) {
      mockFormData.append('DialCallStatus', testStatus);
      mockFormData.append('DialCallSid', `CA${Math.random().toString(36).substr(2, 32)}`);
    }

    if (testStatus === 'completed') {
      mockFormData.append('Duration', '120'); // 2 minutes
    }

    // Call the actual webhook handler
    const webhookUrl = 'https://rmcdialer.vercel.app/api/webhooks/twilio/call-status';
    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      body: mockFormData
    });

    const webhookResult = await webhookResponse.json();

    // Get updated call session
    const updatedCallSession = await prisma.callSession.findUnique({
      where: { id: callSession.id }
    });

    return NextResponse.json({
      success: true,
      message: 'Webhook test completed',
      testData: {
        callSid,
        testStatus,
        isDialEvent
      },
      webhookResponse: {
        status: webhookResponse.status,
        result: webhookResult
      },
      beforeUpdate: {
        status: callSession.status,
        connectedAt: callSession.connectedAt,
        endedAt: callSession.endedAt
      },
      afterUpdate: {
        status: updatedCallSession?.status,
        connectedAt: updatedCallSession?.connectedAt,
        endedAt: updatedCallSession?.endedAt
      }
    });

  } catch (error: any) {
    console.error('❌ Debug call status webhook error:', error);
    
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to test call status webhook'
    }, { status: 500 });
  }
} 
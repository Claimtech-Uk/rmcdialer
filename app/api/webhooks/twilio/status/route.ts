import { NextRequest, NextResponse } from 'next/server';

// This endpoint exists because Twilio might be configured to call /api/webhooks/twilio/status
// We redirect to the correct /api/webhooks/twilio/call-status endpoint

export async function POST(request: NextRequest) {
  try {
    console.log('📞 Twilio status webhook received (redirecting to call-status)');
    
    // Get the request body to forward it
    const body = await request.formData();
    
    // Create the correct URL for call-status
    const baseUrl = new URL(request.url).origin;
    const callStatusUrl = `${baseUrl}/api/webhooks/twilio/call-status`;
    
    // Forward the request to the correct endpoint
    const response = await fetch(callStatusUrl, {
      method: 'POST',
      body: body
    });
    
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'text/plain',
      },
    });
  } catch (error) {
    console.error('❌ Status webhook error:', error);
    return new NextResponse('OK', { status: 200 });
  }
}

// Handle GET requests too
export async function GET() {
  return new NextResponse('Twilio Status Webhook Endpoint', { status: 200 });
} 
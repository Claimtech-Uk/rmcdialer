import { NextRequest, NextResponse } from 'next/server';

/**
 * Twilio Webhook: Queue Handler
 * DISABLED: Inbound call queue system removed - using simplified missed calls system
 */

export async function POST(request: NextRequest) {
  console.log('⚠️ Queue handler webhook disabled - using simplified missed calls system');
  
  // Simple response to end the call gracefully
  const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="woman">Thank you for calling. All agents are currently busy. We have noted your call and will call you back shortly.</Say>
  <Hangup/>
</Response>`;

  return new NextResponse(twimlResponse, {
    status: 200,
    headers: { 'Content-Type': 'application/xml' }
  });
}

export async function GET() {
  return NextResponse.json({
    endpoint: 'queue-handler',
    status: 'disabled',
    message: 'Queue handler disabled - using simplified missed calls system'
  });
}
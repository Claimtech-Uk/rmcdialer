import { NextRequest, NextResponse } from 'next/server';

/**
 * Twilio Webhook: Queue Hold Music
 * DISABLED: Inbound call queue system removed - using simplified missed calls system
 */

export async function POST(request: NextRequest) {
  console.log('⚠️ Queue hold music webhook disabled - using simplified missed calls system');
  
  // Simple response to play a brief message and hang up
  const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="woman">Thank you for holding. We have noted your call and will call you back shortly. Please hang up now.</Say>
  <Hangup/>
</Response>`;

  return new NextResponse(twimlResponse, {
    status: 200,
    headers: { 'Content-Type': 'application/xml' }
  });
}

export async function GET() {
  return NextResponse.json({
    endpoint: 'queue-hold-music',
    status: 'disabled',
    message: 'Queue hold music disabled - using simplified missed calls system'
  });
}
import { NextRequest, NextResponse } from 'next/server';

/**
 * Twilio Webhook: Callback Response Handler
 * DISABLED: Inbound call queue system removed - using simplified missed calls system
 */

export async function POST(request: NextRequest) {
  console.log('⚠️ Callback response webhook disabled - using simplified missed calls system');
  
  const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="woman">Thank you for calling. We have received your request and will call you back shortly. Please hang up now.</Say>
  <Hangup/>
</Response>`;

  return new NextResponse(twimlResponse, {
    status: 200,
    headers: { 'Content-Type': 'application/xml' }
  });
}

export async function GET() {
  return NextResponse.json({
    endpoint: 'callback-response',
    status: 'disabled',
    message: 'Callback system disabled - using simplified missed calls system'
  });
}
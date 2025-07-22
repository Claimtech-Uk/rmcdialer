import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🔵 Public webhook test called successfully');
    
    const body = await request.text();
    console.log('📝 Webhook body:', body);
    
    const headers = Object.fromEntries(request.headers.entries());
    console.log('📋 Webhook headers:', headers);
    
    return NextResponse.json({
      success: true,
      message: 'Public webhook test successful',
      timestamp: new Date().toISOString(),
      bodyLength: body.length,
      userAgent: request.headers.get('user-agent')
    });
    
  } catch (error) {
    console.error('❌ Public webhook test failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Webhook test failed',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Public webhook test endpoint',
    status: 'ready',
    timestamp: new Date().toISOString()
  });
} 
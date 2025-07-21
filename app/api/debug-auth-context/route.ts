import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Debugging authentication context...');
    
    // Check cookies
    const cookies = request.cookies;
    const authToken = cookies.get('auth-token')?.value;
    const sessionCookie = cookies.get('next-auth.session-token')?.value;
    
    console.log('🍪 Cookies found:', {
      authToken: authToken ? 'Present' : 'Missing',
      sessionCookie: sessionCookie ? 'Present' : 'Missing',
      cookieNames: cookies.getAll().map(cookie => cookie.name)
    });
    
    // Check headers
    const authorization = request.headers.get('authorization');
    const userAgent = request.headers.get('user-agent');
    
    console.log('📋 Headers:', {
      authorization: authorization ? 'Present' : 'Missing',
      userAgent: userAgent?.substring(0, 50) + '...'
    });
    
    // Try to decode auth token if present
    let decodedToken = null;
    if (authToken) {
      try {
        // Basic JWT decode (without verification for debugging)
        const parts = authToken.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          decodedToken = payload;
          console.log('🔓 Token payload:', payload);
        }
      } catch (decodeError) {
        console.error('❌ Failed to decode token:', decodeError);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Authentication context debug',
      context: {
        cookies: {
          authToken: authToken ? 'Present (' + authToken.substring(0, 20) + '...)' : 'Missing',
          sessionCookie: sessionCookie ? 'Present' : 'Missing',
          totalCookies: cookies.getAll().length
        },
        headers: {
          authorization: authorization ? 'Present' : 'Missing',
          userAgent: userAgent?.substring(0, 50) + '...'
        },
        decodedToken,
        recommendation: !authToken ? 
          'No auth token found - user may not be logged in' : 
          'Auth token present - check tRPC context middleware'
      }
    });
    
  } catch (error: any) {
    console.error('❌ Auth debug failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date()
    }, { status: 500 });
  }
} 
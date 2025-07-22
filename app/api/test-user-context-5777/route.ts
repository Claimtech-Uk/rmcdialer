import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('🔧 Testing getUserContext for user 5777...');
    
    const startTime = Date.now();
    
    // Import and test getUserContext with timeout
    const { UserService } = await import('@/modules/users/services/user.service');
    const userService = new UserService();
    
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('getUserContext timeout after 15 seconds')), 15000)
    );

    const getUserContextPromise = userService.getUserCallContext(5777);

    const userContext = await Promise.race([getUserContextPromise, timeoutPromise]);
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ getUserContext completed in ${duration}ms`);
    
    return NextResponse.json({
      success: true,
      duration,
      userContext: userContext ? {
        userId: (userContext as any).user.id,
        name: `${(userContext as any).user.firstName} ${(userContext as any).user.lastName}`,
        phone: (userContext as any).user.phoneNumber,
        claimsCount: (userContext as any).claims.length,
        requirementsCount: (userContext as any).claims.reduce((acc: number, c: any) => acc + c.requirements.length, 0),
        callScore: (userContext as any).callScore
      } : null
    });

  } catch (error: any) {
    console.error('❌ getUserContext failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
} 
import { NextResponse } from 'next/server';
import { UserService } from '@/modules/users/services/user.service';

export async function GET() {
  try {
    console.log('🔧 [DEBUG] Testing getUserContext call that hangs on call session page...');
    
    const startTime = Date.now();
    const userId = 5777; // The user from the URL parameters
    
    console.log(`🔧 [DEBUG] Testing getUserCallContext for user ${userId}...`);
    
    // Test the exact call that the tRPC endpoint makes
    const userService = new UserService();
    
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('getUserCallContext timeout after 30 seconds')), 30000)
    );

    const getUserContextPromise = userService.getUserCallContext(userId);

    const userContext = await Promise.race([getUserContextPromise, timeoutPromise]);
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ [DEBUG] getUserCallContext completed in ${duration}ms`);

    return NextResponse.json({
      success: true,
      duration,
      userContext: userContext ? {
        userId: (userContext as any).user.id,
        name: `${(userContext as any).user.firstName} ${(userContext as any).user.lastName}`,
        phone: (userContext as any).user.phoneNumber,
        claimsCount: (userContext as any).claims.length,
        requirementsCount: (userContext as any).claims.reduce((acc: number, c: any) => acc + c.requirements.length, 0)
      } : null,
      message: `getUserCallContext completed successfully in ${duration}ms`
    });

  } catch (error: any) {
    const duration = Date.now() - Date.now();
    console.error('❌ [DEBUG] getUserCallContext failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
      duration,
      message: 'getUserCallContext failed or timed out'
    }, { status: 500 });
  }
} 
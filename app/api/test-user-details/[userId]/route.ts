import { NextResponse } from 'next/server';
import { UserService } from '@/modules/users';

export async function GET(
  request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const userId = parseInt(params.userId);
    
    if (isNaN(userId) || userId <= 0) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      );
    }

    console.log(`🧪 Testing complete user details for user ${userId}...`);

    const userService = new UserService();
    const details = await userService.getCompleteUserDetails(userId);

    if (!details) {
      return NextResponse.json(
        { error: `User ${userId} not found` },
        { status: 404 }
      );
    }

    // Log summary for debugging
    console.log(`✅ Complete user details loaded:`);
    console.log(`   📱 Phone: ${details.user.phoneNumber}`);
    console.log(`   📧 Email: ${details.user.email}`);
    console.log(`   🏢 Claims: ${details.claims.length}`);
    console.log(`   📄 Requirements: ${details.summary.pendingRequirements}`);
    console.log(`   📞 Call History: ${details.callHistory.length}`);
    console.log(`   🔗 Magic Links: ${details.magicLinks.length}`);
    console.log(`   📅 Callbacks: ${details.callbacks.length}`);
    console.log(`   📝 Activity Logs: ${details.activityLogs.length}`);

    return NextResponse.json({
      success: true,
      data: details,
      debug: {
        userId,
        totalClaims: details.claims.length,
        pendingRequirements: details.summary.pendingRequirements,
        callHistory: details.callHistory.length,
        magicLinks: details.magicLinks.length,
        callbacks: details.callbacks.length,
        activityLogs: details.activityLogs.length,
        lastContactDate: details.summary.lastContactDate,
        totalCallDuration: details.summary.totalCallDuration
      },
      timestamp: new Date()
    });

  } catch (error: any) {
    console.error(`❌ Failed to get user details:`, error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      details: error.stack,
      timestamp: new Date()
    }, { status: 500 });
  }
} 
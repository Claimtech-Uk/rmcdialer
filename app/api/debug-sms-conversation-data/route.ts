import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { UserService } from '@/modules/users';
import { SMSService } from '@/modules/communications';
import { AuthService } from '@/modules/auth';
import { logger } from '@/modules/core/utils/logger.utils';

export async function GET(request: NextRequest) {
  try {
    logger.info('🔍 DEBUG: Testing SMS conversation data fetching');

    // Initialize services (same as in the communications router)
    const authService = new AuthService({ prisma, logger });
    const userService = new UserService();

    const authForComms = {
      getCurrentAgent: async () => ({ id: 1, role: 'system' }) // System agent for testing
    };

    // Create user service adapter to match SMS service interface
    const userServiceAdapter = {
      async getUserData(userId: number) {
        try {
          logger.info('🔍 Testing getUserData for userId:', { userId });
          
          const context = await userService.getUserCallContext(userId);
          if (!context) {
            throw new Error(`User ${userId} not found`);
          }
          
          const userData = {
            id: context.user.id,
            firstName: context.user.firstName || 'Unknown',
            lastName: context.user.lastName || 'User',
            email: context.user.email || '',
            phoneNumber: context.user.phoneNumber || ''
          };
          
          logger.info('✅ getUserData success:', { userId, userData });
          return userData;
        } catch (error) {
          logger.error('❌ getUserData failed:', { userId, error: String(error) });
          throw error;
        }
      }
    };

    const smsService = new SMSService({ 
      authService: authForComms,
      userService: userServiceAdapter
    });

    // Get the failing conversation
    const targetPhoneNumber = '+447738585850';

    // Test 1: Check raw conversation data from database
    const rawConversation = await prisma.smsConversation.findFirst({
      where: { phoneNumber: targetPhoneNumber },
      include: {
        assignedAgent: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        _count: {
          select: {
            messages: true
          }
        }
      }
    });

    const results = {
      phoneNumber: targetPhoneNumber,
      tests: [] as any[]
    };

    // Test 1: Raw database conversation
    results.tests.push({
      test: 'raw_database_conversation',
      success: !!rawConversation,
      data: rawConversation ? {
        id: rawConversation.id,
        phoneNumber: rawConversation.phoneNumber,
        userId: rawConversation.userId ? Number(rawConversation.userId) : null,
        status: rawConversation.status,
        messageCount: rawConversation._count.messages
      } : null
    });

    if (rawConversation && rawConversation.userId) {
      // Test 2: UserService getUserCallContext directly
      try {
        const userContext = await userService.getUserCallContext(Number(rawConversation.userId));
        results.tests.push({
          test: 'user_service_direct',
          success: !!userContext,
          data: userContext ? {
            id: userContext.user.id,
            firstName: userContext.user.firstName,
            lastName: userContext.user.lastName,
            phoneNumber: userContext.user.phoneNumber
          } : null
        });
      } catch (error) {
        results.tests.push({
          test: 'user_service_direct',
          success: false,
          error: String(error)
        });
      }

      // Test 3: UserServiceAdapter
      try {
        const userData = await userServiceAdapter.getUserData(Number(rawConversation.userId));
        results.tests.push({
          test: 'user_service_adapter',
          success: !!userData,
          data: userData
        });
      } catch (error) {
        results.tests.push({
          test: 'user_service_adapter',
          success: false,
          error: String(error)
        });
      }

      // Test 4: SMS Service getConversations method
      try {
        const conversationsResponse = await smsService.getConversations({
          phoneNumber: targetPhoneNumber,
          limit: 1
        });
        
        const conversation = conversationsResponse.data[0];
        results.tests.push({
          test: 'sms_service_get_conversations',
          success: !!conversation,
          data: conversation ? {
            id: conversation.id,
            phoneNumber: conversation.phoneNumber,
            userId: conversation.userId,
            hasUser: !!conversation.user,
            user: conversation.user
          } : null
        });
      } catch (error) {
        results.tests.push({
          test: 'sms_service_get_conversations',
          success: false,
          error: String(error)
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
      summary: {
        totalTests: results.tests.length,
        passedTests: results.tests.filter(t => t.success).length,
        failedTests: results.tests.filter(t => !t.success).length
      }
    });

  } catch (error) {
    logger.error('Failed to debug SMS conversation data:', error);
    return NextResponse.json({
      success: false,
      error: String(error)
    }, { status: 500 });
  }
} 
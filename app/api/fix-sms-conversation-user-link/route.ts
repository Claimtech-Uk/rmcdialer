import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { replicaDb } from '@/lib/mysql';
import { logger } from '@/modules/core/utils/logger.utils';

export async function POST(request: NextRequest) {
  try {
    const targetPhoneNumber = '+447738585850';
    
    logger.info('🔧 Fixing SMS conversation user link', { phoneNumber: targetPhoneNumber });

    // Step 1: Find the conversation
    const conversation = await prisma.smsConversation.findFirst({
      where: { phoneNumber: targetPhoneNumber }
    });

    if (!conversation) {
      return NextResponse.json({
        success: false,
        error: 'Conversation not found'
      });
    }

    // Step 2: Find the user by phone number (using the same logic as SMS service)
    const cleanPhoneNumber = targetPhoneNumber.replace(/[\s\-\(\)]/g, '');
    
    // Try exact match first
    let user = await replicaDb.user.findFirst({
      where: { phone_number: targetPhoneNumber },
      select: { id: true, first_name: true, last_name: true, phone_number: true }
    });

    // If not found, try last 10 digits
    if (!user) {
      const last10Digits = cleanPhoneNumber.slice(-10);
      user = await replicaDb.user.findFirst({
        where: { phone_number: { contains: last10Digits } },
        select: { id: true, first_name: true, last_name: true, phone_number: true }
      });
    }

    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'User not found for phone number'
      });
    }

    // Step 3: Update the conversation to link it to the user
    const updatedConversation = await prisma.smsConversation.update({
      where: { id: conversation.id },
      data: { userId: Number(user.id) }
    });

    logger.info('✅ SMS conversation linked to user', {
      conversationId: conversation.id,
      phoneNumber: targetPhoneNumber,
      userId: Number(user.id),
      userName: `${user.first_name} ${user.last_name}`
    });

    return NextResponse.json({
      success: true,
      message: 'Conversation successfully linked to user',
      data: {
        conversationId: conversation.id,
        phoneNumber: targetPhoneNumber,
        userId: Number(user.id),
        userName: `${user.first_name} ${user.last_name}`,
        beforeUpdate: {
          userId: conversation.userId
        },
        afterUpdate: {
          userId: Number(user.id)
        }
      }
    });

  } catch (error) {
    logger.error('Failed to fix SMS conversation user link:', error);
    return NextResponse.json({
      success: false,
      error: String(error)
    }, { status: 500 });
  }
} 
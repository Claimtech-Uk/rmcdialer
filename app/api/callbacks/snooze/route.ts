import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Snooze a callback for a specified number of minutes
 * This temporarily delays the callback notification
 */
export async function POST(request: NextRequest) {
  try {
    const { callbackId, snoozeMinutes = 5 } = await request.json();

    if (!callbackId) {
      return NextResponse.json({
        success: false,
        error: 'Callback ID is required'
      }, { status: 400 });
    }

    if (snoozeMinutes < 1 || snoozeMinutes > 60) {
      return NextResponse.json({
        success: false,
        error: 'Snooze minutes must be between 1 and 60'
      }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Get the callback
      const callback = await tx.callback.findUnique({
        where: { id: callbackId }
      });

      if (!callback) {
        throw new Error('Callback not found');
      }

      if (callback.status !== 'pending') {
        throw new Error('Only pending callbacks can be snoozed');
      }

      // Calculate new scheduled time
      const newScheduledTime = new Date(Date.now() + snoozeMinutes * 60 * 1000);

      // Update the callback's scheduled time
      const updatedCallback = await tx.callback.update({
        where: { id: callbackId },
        data: {
          scheduledFor: newScheduledTime,
          callbackReason: callback.callbackReason 
            ? `${callback.callbackReason} (snoozed ${snoozeMinutes}m)`
            : `Callback snoozed for ${snoozeMinutes} minutes`
        }
      });

      // Remove any immediate queue entries for this callback
      await tx.callQueue.deleteMany({
        where: {
          callbackId: callbackId,
          status: { in: ['pending', 'assigned'] }
        }
      });

      return {
        callback: updatedCallback,
        snoozeMinutes,
        newScheduledTime
      };
    });

    console.log(`⏰ Callback ${callbackId} snoozed for ${snoozeMinutes} minutes until ${result.newScheduledTime}`);

    return NextResponse.json({
      success: true,
      message: `Callback snoozed for ${snoozeMinutes} minutes`,
      data: {
        callbackId: result.callback.id,
        newScheduledTime: result.newScheduledTime,
        snoozeMinutes: result.snoozeMinutes
      }
    });

  } catch (error) {
    console.error('Error snoozing callback:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to snooze callback'
    }, { status: 500 });
  }
} 
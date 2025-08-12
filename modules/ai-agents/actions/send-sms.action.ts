import { SMSService } from '@/modules/communications'

export async function sendSmsAction(smsService: SMSService, args: { phoneNumber: string; text: string; fromE164?: string; userId?: number }) {
  return await smsService.sendSMS({
    phoneNumber: args.phoneNumber,
    message: args.text,
    messageType: 'auto_response',
    userId: args.userId
    // Note: SMS service automatically uses test number for auto_response messages
  })
}



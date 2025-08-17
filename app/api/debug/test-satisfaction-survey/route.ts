import { NextResponse } from 'next/server'
import { SMSService } from '@/modules/communications/services/sms.service'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // Safely extract search params with validation
    let phone = '+447738585850' // Default to James's number
    let userName = 'James'
    let customMessage = null
    
    try {
      // Safely construct URL with fallback
      const url = new URL(request.url || 'http://localhost:3000')
      const searchParams = url.searchParams
      phone = searchParams.get('phone') || phone
      userName = searchParams.get('name') || userName
      customMessage = searchParams.get('message')
    } catch (urlError) {
      console.warn(`⚠️ [API] URL parsing failed, using defaults:`, urlError)
      // Variables already have default values
    }
    
    console.log('😊 [DEBUG] Manually triggering satisfaction survey for', phone)
    
    // Personal message from Sophie
    const satisfactionMessage = customMessage || 
      `Hi ${userName}! 😊

It's Sophie from RMC here. I just wanted to check how you found the onboarding? 

I know these things can feel a bit overwhelming at times, so please don't hesitate to message me if you have any questions at all - I'm here to help! 

How are you finding the whole process so far? I'd love to hear your thoughts! 💭`
    
    // Initialize SMS service (following existing pattern)
    const smsService = new SMSService({ 
      authService: undefined as any, 
      userService: undefined as any 
    })
    
    // Send the satisfaction SMS
    const result = await smsService.sendSMS({
      phoneNumber: phone.startsWith('+') ? phone : `+${phone}`,
      message: satisfactionMessage,
      messageType: 'manual' // Debug messages are manual
    })
    
    console.log('😊 [DEBUG] Personal satisfaction check sent successfully', {
      phone,
      userName,
      messageLength: satisfactionMessage.length,
      result
    })
    
    return NextResponse.json({
      success: true,
      message: 'Personal satisfaction check sent successfully',
      phone,
      userName,
      sentMessage: satisfactionMessage,
      result
    })
    
  } catch (error) {
    console.error('😊 [DEBUG] Failed to send satisfaction survey:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

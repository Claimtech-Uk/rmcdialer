import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // Check feature flag and auth (same pattern as lookup-user)
    const authHeader = request.headers.get('authorization')
    const apiToken = process.env.AI_VOICE_API_TOKEN
    const isAuthorized = (authHeader === `Bearer ${apiToken}`) || 
                        (process.env.ENVIRONMENT_NAME === 'staging-development')
    const isAIVoiceEnabled = process.env.ENABLE_AI_VOICE_AGENT === 'true'
    const environmentName = process.env.ENVIRONMENT_NAME || 'unknown'
    
    if (!isAIVoiceEnabled && environmentName !== 'staging-development' && !isAuthorized) {
      return NextResponse.json(
        { error: 'AI Voice agent disabled or unauthorized', environment: environmentName },
        { status: 403 }
      )
    }

    const { phoneNumber, portalUrl, linkType } = await request.json()
    
    if (!phoneNumber || !portalUrl) {
      return NextResponse.json(
        { error: 'Phone number and portal URL required' },
        { status: 400 }
      )
    }

    console.log(`📱 [AI-VOICE-SMS] Sending portal link to: ${phoneNumber}`)
    console.log(`🔗 [AI-VOICE-SMS] Portal URL: ${portalUrl.substring(0, 60)}...`)
    console.log(`📝 [AI-VOICE-SMS] Link Type: ${linkType}`)
    
    // Use the same Twilio approach as PartyKit
    const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
    const authToken = process.env.TWILIO_AUTH_TOKEN?.trim() 
    const fromNumber = process.env.TWILIO_PHONE_NUMBER?.trim()  // Use same variable as working SMS service
    
    if (!accountSid || !authToken || !fromNumber) {
      console.error('❌ [AI-VOICE-SMS] Missing Twilio credentials')
      return NextResponse.json({
        success: false,
        error: 'Twilio credentials not configured'
      })
    }
    
    console.log(`📱 [AI-VOICE-SMS] Using Twilio from: ${fromNumber}`)
    
    // Create the exact message format that PartyKit uses
    const messageText = `Access your portal here: ${portalUrl}`
    console.log(`💬 [AI-VOICE-SMS] Message: ${messageText.substring(0, 50)}...`)
    
    // Prepare Twilio API call (same as PartyKit)
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
    const twilioAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
    
    const smsData = new URLSearchParams({
      'From': fromNumber,
      'To': phoneNumber,
      'Body': messageText
    })
    
    console.log(`📡 [AI-VOICE-SMS] Calling Twilio API...`)
    
    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${twilioAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: smsData.toString()
    })
    
    console.log(`📨 [AI-VOICE-SMS] Twilio Response: ${twilioResponse.status} ${twilioResponse.statusText}`)
    
    if (!twilioResponse.ok) {
      const errorText = await twilioResponse.text()
      console.error(`❌ [AI-VOICE-SMS] Twilio API error: ${errorText}`)
      
      return NextResponse.json({
        success: false,
        error: 'Failed to send SMS',
        twilioError: errorText,
        status: twilioResponse.status
      })
    }
    
    const twilioResult = await twilioResponse.json()
    console.log(`✅ [AI-VOICE-SMS] SMS sent successfully:`, {
      messageSid: twilioResult.sid,
      status: twilioResult.status,
      to: twilioResult.to
    })
    
    return NextResponse.json({
      success: true,
      message: 'Portal SMS sent successfully',
      messageSid: twilioResult.sid,
      to: twilioResult.to,
      linkType: linkType,
      portalUrl: portalUrl.substring(0, 60) + '...' // Truncated for logs
    })
    
  } catch (error: any) {
    console.error('❌ [AI-VOICE-SMS] SMS portal send error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to send portal SMS',
        details: error?.message || 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// GET method for testing
export async function GET() {
  return NextResponse.json({
    status: 'AI Voice SMS Portal Endpoint',
    method: 'POST',
    required: { phoneNumber: 'string', portalUrl: 'string', linkType: 'string' },
    description: 'Sends portal link via SMS exactly as PartyKit would'
  })
}

/**
 * Test endpoint for AI Voice tools
 * Tests both caller lookup and portal link sending
 * FOR DEVELOPMENT TESTING ONLY
 */

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // Check if in development mode
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_AI_VOICE_AGENT !== 'true') {
    return NextResponse.json({ 
      error: 'Test endpoint disabled in production' 
    }, { status: 403 })
  }

  const testPhone = '+447738585850' // James Campbell's number
  const results: any = {
    timestamp: new Date().toISOString(),
    testPhone,
    lookupResult: null,
    portalLinkResult: null,
    errors: []
  }

  console.log('🧪 [TEST] Starting AI Voice tools test')
  console.log('🧪 [TEST] Test phone:', testPhone)

  // Test 1: AI Caller Lookup
  try {
    console.log('\n📊 TEST 1: AI Caller Lookup')
    console.log('================================')
    
    const { performAICallerLookup } = await import('@/modules/ai-voice-agent/services/ai-caller-lookup.service')
    const callerInfo = await performAICallerLookup(testPhone)
    
    if (callerInfo && callerInfo.user) {
      results.lookupResult = {
        success: true,
        found: true,
        userData: {
          id: callerInfo.user.id,
          name: `${callerInfo.user.first_name} ${callerInfo.user.last_name}`,
          phone: callerInfo.user.phone_number,
          email: callerInfo.user.email_address,
          status: callerInfo.user.status,
          hasIdOnFile: !!callerInfo.user.current_user_id_document_id,
          lastLogin: callerInfo.user.last_login
        },
        claimsData: {
          count: callerInfo.claims.length,
          claims: callerInfo.claims.map(claim => ({
            id: claim.id,
            lender: claim.lender,
            status: claim.status,
            vehicleCount: claim.vehiclePackages?.length || 0,
            vehicles: claim.vehiclePackages?.map(vp => ({
              registration: vp.vehicle_registration,
              make: vp.vehicle_make,
              model: vp.vehicle_model,
              dealership: vp.dealership_name,
              monthlyPayment: vp.monthly_payment
            }))
          })),
          totalVehicles: callerInfo.claims.reduce((sum, c) => sum + (c.vehiclePackages?.length || 0), 0)
        },
        callHistory: {
          recentCalls: callerInfo.callHistory.length,
          lastCall: callerInfo.callHistory[0]?.startedAt
        },
        priorityScore: callerInfo.priorityScore
      }
      
      console.log('✅ Lookup successful!')
      console.log('👤 User:', results.lookupResult.userData.name)
      console.log('📞 Phone:', results.lookupResult.userData.phone)
      console.log('🆔 Has ID on file:', results.lookupResult.userData.hasIdOnFile)
      console.log('📋 Claims:', results.lookupResult.claimsData.count)
      console.log('🚗 Total vehicles:', results.lookupResult.claimsData.totalVehicles)
      
      // Show detailed claim info
      results.lookupResult.claimsData.claims.forEach((claim: any, index: number) => {
        console.log(`\n  Claim ${index + 1}:`)
        console.log(`    - Lender: ${claim.lender || 'Unknown'}`)
        console.log(`    - Status: ${claim.status}`)
        console.log(`    - Vehicles: ${claim.vehicleCount}`)
        if (claim.vehicles && claim.vehicles.length > 0) {
          claim.vehicles.forEach((vehicle: any, vIndex: number) => {
            console.log(`      Vehicle ${vIndex + 1}: ${vehicle.make} ${vehicle.model} (${vehicle.registration})`)
          })
        }
      })
      
    } else {
      results.lookupResult = {
        success: true,
        found: false,
        message: 'User not found in system'
      }
      console.log('❌ User not found')
    }
    
  } catch (error) {
    console.error('❌ Lookup error:', error)
    results.lookupResult = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
    results.errors.push(`Lookup: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  // Test 2: Portal Link SMS (only if user was found)
  if (results.lookupResult?.found && request.nextUrl.searchParams.get('sendSms') === 'true') {
    try {
      console.log('\n📱 TEST 2: Portal Link SMS')
      console.log('================================')
      
      // We'll simulate what PartyKit does directly here
      const userId = results.lookupResult.userData.id
      const linkType = 'claims'
      
      // Generate token (same as PartyKit)
      const timestamp = Date.now()
      const randomBytes = Math.random().toString(36).substring(2, 15)
      const token = Buffer.from(`${userId}_${linkType}_${timestamp}_${randomBytes}`).toString('base64url')
      
      // Build portal URL
      const baseUrl = process.env.MAIN_APP_URL || 'https://claim.resolvemyclaim.co.uk'
      const portalUrl = `${baseUrl}/claims?token=${token}&user=${userId}`
      
      // AI Voice specific message format
      const message = `Access your portal here: ${portalUrl}`
      
      console.log('📝 Message format: "Access your portal here: [link]"')
      console.log('🔗 Portal URL:', portalUrl.substring(0, 50) + '...')
      console.log('📱 Sending to:', testPhone)
      
      // Send via Twilio
      const accountSid = process.env.TWILIO_ACCOUNT_SID
      const authToken = process.env.TWILIO_AUTH_TOKEN
      const fromNumber = process.env.TWILIO_FROM_NUMBER
      
      if (!accountSid || !authToken || !fromNumber) {
        throw new Error('Twilio credentials not configured')
      }
      
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            From: fromNumber,
            To: testPhone,
            Body: message
          })
        }
      )
      
      if (response.ok) {
        const smsData = await response.json()
        results.portalLinkResult = {
          success: true,
          sent: true,
          messageId: smsData.sid,
          to: testPhone,
          messageFormat: 'AI Voice clean format',
          messagePreview: message.substring(0, 50) + '...',
          timestamp: new Date().toISOString()
        }
        console.log('✅ SMS sent successfully!')
        console.log('📨 Message ID:', smsData.sid)
        console.log('📱 Delivered to:', testPhone)
      } else {
        const errorText = await response.text()
        throw new Error(`Twilio error: ${errorText}`)
      }
      
    } catch (error) {
      console.error('❌ SMS error:', error)
      results.portalLinkResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      results.errors.push(`SMS: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  } else if (!results.lookupResult?.found) {
    results.portalLinkResult = {
      success: false,
      error: 'Cannot send portal link - user not found'
    }
  } else {
    results.portalLinkResult = {
      success: false,
      message: 'Add ?sendSms=true to actually send the SMS'
    }
  }

  // Summary
  console.log('\n📊 TEST SUMMARY')
  console.log('================================')
  console.log('✅ Lookup:', results.lookupResult?.success ? 'SUCCESS' : 'FAILED')
  console.log('✅ Portal SMS:', results.portalLinkResult?.success ? 'SUCCESS' : 'SKIPPED/FAILED')
  console.log('⚠️ Errors:', results.errors.length || 'None')
  
  return NextResponse.json(results, { 
    status: results.errors.length > 0 ? 500 : 200 
  })
}

// Handle POST for sending SMS
export async function POST(request: NextRequest) {
  // This could be used to send a test SMS with custom parameters
  const body = await request.json()
  const { phoneNumber, linkType = 'claims' } = body
  
  // Similar implementation to GET but with custom parameters
  return NextResponse.json({ 
    message: 'Use GET request with ?sendSms=true for testing' 
  })
}

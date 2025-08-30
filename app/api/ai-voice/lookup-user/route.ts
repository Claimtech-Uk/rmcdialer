import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // Check for API token (bypass auth for PartyKit)
    const authHeader = request.headers.get('authorization')
    const apiToken = process.env.AI_VOICE_API_TOKEN
    
    // Allow requests with valid token OR from staging-development
    const isAuthorized = (authHeader === `Bearer ${apiToken}`) || 
                        (process.env.ENVIRONMENT_NAME === 'staging-development')
    
    // Check feature flag directly from environment
    const isAIVoiceEnabled = process.env.ENABLE_AI_VOICE_AGENT === 'true'
    const environmentName = process.env.ENVIRONMENT_NAME || 'unknown'
    
    // Allow in dev/staging environments or when explicitly enabled
    if (!isAIVoiceEnabled && environmentName !== 'staging-development' && !isAuthorized) {
      return NextResponse.json(
        { error: 'AI Voice agent disabled or unauthorized', environment: environmentName },
        { status: 403 }
      )
    }

    const { phone } = await request.json()
    
    if (!phone) {
      return NextResponse.json(
        { error: 'Phone number required' },
        { status: 400 }
      )
    }

    console.log(`🔍 [AI-VOICE-LOOKUP] Looking up user with phone: ${phone}`)
    
    // Dynamically import the AI caller lookup service
    const { performAICallerLookup } = await import('@/modules/ai-voice-agent/services/ai-caller-lookup.service')
    
    // Use the existing AI caller lookup service
    const callerInfo = await performAICallerLookup(phone)
    
    if (callerInfo && callerInfo.user && callerInfo.lookupSuccess) {
      const response = {
        found: true,
        fullName: `${callerInfo.user.first_name} ${callerInfo.user.last_name}`,
        status: callerInfo.user.status,
        hasIdOnFile: !!callerInfo.user.current_user_id_document_id,
        claimsCount: callerInfo.claims?.length || 0,
        claims: callerInfo.claims?.map(claim => ({
          lender: claim.lender,
          status: claim.status,
          vehiclePackagesCount: claim.vehiclePackages?.length || 0,
          vehicleStatuses: claim.vehiclePackages?.map((vp: any) => vp.status) || []
        })) || []
      }
      
      console.log(`✅ [AI-VOICE-LOOKUP] User found:`, {
        name: response.fullName,
        claimsCount: response.claimsCount
      })
      
      return NextResponse.json(response)
    } else {
      console.log(`❌ [AI-VOICE-LOOKUP] User not found for phone: ${phone}`)
      
      // Check if there was an error vs user simply not found
      if (callerInfo && callerInfo.error) {
        console.error(`🚨 [AI-VOICE-LOOKUP] Database error: ${callerInfo.error}`)
        return NextResponse.json({
          found: false,
          phone: phone,
          error: callerInfo.error,
          debug: 'Database query failed'
        })
      }
      
      return NextResponse.json({
        found: false,
        phone: phone,
        debug: 'User genuinely not found'
      })
    }
  } catch (error) {
    console.error('❌ [AI-VOICE-LOOKUP] User lookup error:', error)
    return NextResponse.json(
      { error: 'Failed to lookup user' },
      { status: 500 }
    )
  }
}

// GET method for testing
export async function GET(request: NextRequest) {
  const isAIVoiceEnabled = process.env.ENABLE_AI_VOICE_AGENT === 'true'
  const environmentName = process.env.ENVIRONMENT_NAME || 'unknown'
  
  // Check for test parameter
  const url = new URL(request.url)
  const testType = url.searchParams.get('test')
  
  if (testType === 'basic') {
    try {
      console.log('🧪 [TEST-BASIC] Testing replica DB connection...')
      const { replicaDb } = await import('@/lib/mysql')
      const userCount = await replicaDb.user.count()
      console.log(`✅ [TEST-BASIC] Connected! Total users: ${userCount}`)
      
      return NextResponse.json({
        success: true,
        test: 'basic_connection',
        userCount: userCount,
        environment: environmentName
      })
    } catch (error: any) {
      console.error('❌ [TEST-BASIC] Connection failed:', error)
      return NextResponse.json({
        success: false,
        test: 'basic_connection',
        error: error?.message || 'Unknown error'
      })
    }
  }
  
  if (testType === 'any-data') {
    try {
      console.log('🧪 [TEST-DATA] Getting any user data...')
      const { replicaDb } = await import('@/lib/mysql')
      const users = await replicaDb.user.findMany({
        select: {
          id: true,
          first_name: true,
          last_name: true,
          phone_number: true
        },
        take: 5
      })
      
      console.log(`✅ [TEST-DATA] Retrieved ${users.length} users`)
      
      return NextResponse.json({
        success: true,
        test: 'get_any_data',
        userCount: users.length,
        sampleUsers: users.map(u => ({
          id: Number(u.id),
          name: `${u.first_name || ''} ${u.last_name || ''}`.trim(),
          phone: u.phone_number
        }))
      })
    } catch (error: any) {
      console.error('❌ [TEST-DATA] Get data failed:', error)
      return NextResponse.json({
        success: false,
        test: 'get_any_data',
        error: error?.message || 'Unknown error'
      })
    }
  }
  
  if (testType === 'phone') {
    try {
      const phoneToTest = '+447738585850'
      console.log(`🧪 [TEST-PHONE] Testing specific phone: ${phoneToTest}`)
      
      const { replicaDb } = await import('@/lib/mysql')
      
      // Use EXACT working patterns from Voice DB service
      const cleanPhone = phoneToTest.replace(/\D/g, '')
      const searchPatterns = [
        phoneToTest,                    // '+447738585850'
        cleanPhone,                     // '447738585850'
        `+44${cleanPhone.substring(1)}`, // '+447738585850' 
        `0${cleanPhone.substring(2)}`,   // '07738585850'
        `44${cleanPhone.substring(1)}`,  // '447738585850'
      ]
      
      console.log(`🧪 [TEST-PHONE] Using patterns: ${searchPatterns.join(', ')}`)
      
      // Test the combined query (same as our AI lookup)
      const userCombined = await replicaDb.user.findFirst({
        where: {
          phone_number: {
            in: searchPatterns
          }
        },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          phone_number: true,
          status: true,
          is_enabled: true
        }
      })
      
      // Also test individual patterns
      const individualResults = []
      for (const pattern of searchPatterns) {
        try {
          const user = await replicaDb.user.findFirst({
            where: { phone_number: pattern },
            select: {
              id: true,
              first_name: true,
              last_name: true,
              phone_number: true,
              is_enabled: true
            }
          })
          individualResults.push({
            pattern: pattern,
            found: !!user,
            user: user ? {
              id: Number(user.id),
              name: `${user.first_name} ${user.last_name}`,
              phone: user.phone_number,
              isEnabled: user.is_enabled
            } : null
          })
        } catch (err: any) {
          individualResults.push({
            pattern: pattern,
            found: false,
            error: err?.message
          })
        }
      }
      
      return NextResponse.json({
        success: true,
        test: 'phone_number_search',
        targetPhone: phoneToTest,
        patterns: searchPatterns,
        combinedQuery: {
          found: !!userCombined,
          user: userCombined ? {
            id: Number(userCombined.id),
            name: `${userCombined.first_name} ${userCombined.last_name}`,
            phone: userCombined.phone_number,
            status: userCombined.status,
            isEnabled: userCombined.is_enabled
          } : null
        },
        individualResults: individualResults,
        foundAny: individualResults.some(r => r.found)
      })
      
    } catch (error: any) {
      console.error('❌ [TEST-PHONE] Phone search failed:', error)
      return NextResponse.json({
        success: false,
        test: 'phone_number_search',
        error: error?.message || 'Unknown error'
      })
    }
  }
  
  return NextResponse.json({
    status: 'AI Voice User Lookup Endpoint',
    enabled: isAIVoiceEnabled || environmentName === 'staging-development',
    environment: environmentName,
    method: 'POST',
    required: { phone: 'string' },
    testOptions: {
      basicConnection: '?test=basic',
      anyData: '?test=any-data',
      phoneSearch: '?test=phone'
    }
  })
}

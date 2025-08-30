import { NextRequest, NextResponse } from 'next/server'
import { replicaDb } from '@/lib/mysql'

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 [TEST-3] Searching for James Campbell specifically...')
    
    // Test 3: Look for James Campbell by name first
    const jamesByName = await replicaDb.user.findMany({
      where: {
        first_name: {
          contains: 'James'
        },
        last_name: {
          contains: 'Campbell'
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
    
    console.log(`✅ [TEST-3] Found ${jamesByName.length} James Campbell(s)`)
    
    return NextResponse.json({
      success: true,
      test: 'find_james_campbell_by_name',
      foundCount: jamesByName.length,
      results: jamesByName.map(u => ({
        id: Number(u.id),
        name: `${u.first_name} ${u.last_name}`,
        phone: u.phone_number,
        status: u.status,
        isEnabled: u.is_enabled
      })),
      timestamp: new Date().toISOString()
    })
    
  } catch (error: any) {
    console.error('❌ [TEST-3] James Campbell search failed:', error)
    return NextResponse.json({
      success: false,
      test: 'find_james_campbell_by_name',
      error: error?.message || 'Unknown error',
      timestamp: new Date().toISOString()
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json()
    const phoneToTest = phone || '+447738585850'
    
    console.log(`🧪 [TEST-4] Searching for phone: ${phoneToTest}`)
    
    // Test 4: Use exact working phone patterns
    const cleanPhone = phoneToTest.replace(/\D/g, '')
    const searchPatterns = [
      phoneToTest,                    // Original: '+447738585850'
      cleanPhone,                     // Digits only: '447738585850'
      `+44${cleanPhone.substring(1)}`, // UK international: '+447738585850' 
      `0${cleanPhone.substring(2)}`,   // Remove +44, add 0: '07738585850'
      `44${cleanPhone.substring(1)}`,  // Without + prefix: '447738585850'
    ]
    
    console.log(`🧪 [TEST-4] Using patterns: ${searchPatterns.join(', ')}`)
    
    // Test each pattern individually
    const results = []
    for (const pattern of searchPatterns) {
      try {
        const user = await replicaDb.user.findFirst({
          where: {
            phone_number: pattern
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
        
        results.push({
          pattern: pattern,
          found: !!user,
          user: user ? {
            id: Number(user.id),
            name: `${user.first_name} ${user.last_name}`,
            phone: user.phone_number,
            status: user.status,
            isEnabled: user.is_enabled
          } : null
        })
        
        if (user) {
          console.log(`✅ [TEST-4] FOUND with pattern "${pattern}": ${user.first_name} ${user.last_name}`)
        }
        
      } catch (patternError: any) {
        console.error(`❌ [TEST-4] Pattern "${pattern}" failed:`, patternError)
        results.push({
          pattern: pattern,
          found: false,
          error: patternError?.message || 'Unknown error'
        })
      }
    }
    
    return NextResponse.json({
      success: true,
      test: 'phone_pattern_search',
      phone: phoneToTest,
      patterns: searchPatterns,
      results: results,
      foundAny: results.some(r => r.found),
      timestamp: new Date().toISOString()
    })
    
  } catch (error: any) {
    console.error('❌ [TEST-4] Phone search failed:', error)
    return NextResponse.json({
      success: false,
      test: 'phone_pattern_search',
      error: error?.message || 'Unknown error',
      timestamp: new Date().toISOString()
    })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { replicaDb } from '@/lib/mysql'

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 [TEST-1] Testing basic replica DB connection...')
    
    // Test 1: Basic connection
    const userCount = await replicaDb.user.count()
    console.log(`✅ [TEST-1] Connected! Total users: ${userCount}`)
    
    return NextResponse.json({
      success: true,
      test: 'basic_connection',
      userCount: userCount,
      timestamp: new Date().toISOString()
    })
    
  } catch (error: any) {
    console.error('❌ [TEST-1] Connection failed:', error)
    return NextResponse.json({
      success: false,
      test: 'basic_connection', 
      error: error?.message || 'Unknown error',
      timestamp: new Date().toISOString()
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 [TEST-2] Testing replica DB - get any data...')
    
    // Test 2: Get any user data (first 3 users)
    const users = await replicaDb.user.findMany({
      select: {
        id: true,
        first_name: true,
        last_name: true,
        phone_number: true,
        status: true
      },
      take: 3
    })
    
    console.log(`✅ [TEST-2] Retrieved ${users.length} users`)
    
    return NextResponse.json({
      success: true,
      test: 'get_any_data',
      userCount: users.length,
      sampleUsers: users.map(u => ({
        id: Number(u.id),
        name: `${u.first_name || ''} ${u.last_name || ''}`.trim(),
        phone: u.phone_number ? u.phone_number.substring(0, 7) + '***' : null,
        status: u.status
      })),
      timestamp: new Date().toISOString()
    })
    
  } catch (error: any) {
    console.error('❌ [TEST-2] Get data failed:', error)
    return NextResponse.json({
      success: false,
      test: 'get_any_data',
      error: error?.message || 'Unknown error',
      timestamp: new Date().toISOString()
    })
  }
}

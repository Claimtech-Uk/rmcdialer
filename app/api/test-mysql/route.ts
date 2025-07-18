import { NextResponse } from 'next/server'
import { testReplicaConnection, getReplicaStats } from '@/lib/mysql'

export async function GET() {
  try {
    console.log('🔗 Testing MySQL replica connection via API...')
    
    // Test basic connection
    const connectionSuccess = await testReplicaConnection()
    
    if (!connectionSuccess) {
      return NextResponse.json(
        { error: 'MySQL connection failed' },
        { status: 500 }
      )
    }
    
    // Get database stats
    const stats = await getReplicaStats()
    
    return NextResponse.json({
      success: true,
      message: '🎉 Successfully connected to MySQL replica!',
      stats,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ MySQL test error:', error)
    
    return NextResponse.json(
      { 
        error: 'MySQL test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 
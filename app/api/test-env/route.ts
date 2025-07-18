import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const envVars = {
      REPLICA_DATABASE_URL_exists: !!process.env.REPLICA_DATABASE_URL,
      REPLICA_DATABASE_URL_length: process.env.REPLICA_DATABASE_URL?.length || 0,
      NODE_ENV: process.env.NODE_ENV,
      // Don't log the actual URL for security
      REPLICA_DATABASE_URL_preview: process.env.REPLICA_DATABASE_URL?.slice(0, 20) + '...' || 'NOT_SET'
    }
    
    return NextResponse.json({
      success: true,
      environment: envVars
    })
    
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Environment check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 
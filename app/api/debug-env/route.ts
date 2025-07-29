import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  // Only allow in production with debug token
  if (process.env.NODE_ENV === 'production') {
    const debugToken = request.headers.get('x-debug-token')
    if (!debugToken || debugToken !== process.env.DEBUG_ACCESS_TOKEN) {
      return NextResponse.json({ error: 'Debug access denied' }, { status: 403 })
    }
  }

  try {
    // Check environment variables
    const envCheck = {
      NODE_ENV: process.env.NODE_ENV || 'undefined',
      DATABASE_URL: process.env.DATABASE_URL ? 'present' : 'missing',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? 'present' : 'missing',
      JWT_SECRET: process.env.JWT_SECRET ? 'present' : 'missing',
      REPLICA_DATABASE_URL: process.env.REPLICA_DATABASE_URL ? 'present' : 'missing',
      DEBUG_ACCESS_TOKEN: process.env.DEBUG_ACCESS_TOKEN ? 'present' : 'missing'
    }

    // Test database connectivity
    let dbTest = null
    try {
      const agentCount = await prisma.agent.count()
      const tableCheck = await prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('agents', 'call_sessions', 'call_outcomes', 'agent_sessions', 'magic_link_activities')
      `
      
      dbTest = {
        connected: true,
        agentCount,
        tables: tableCheck
      }
    } catch (error) {
      dbTest = {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Test JWT secret availability
    let jwtTest = null
    try {
      const jwt = require('jsonwebtoken')
      const testPayload = { test: true }
      const jwtSecret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || 'fallback-secret-for-build'
      const token = jwt.sign(testPayload, jwtSecret)
      const decoded = jwt.verify(token, jwtSecret)
      jwtTest = { working: true, usingFallback: jwtSecret === 'fallback-secret-for-build' }
    } catch (error) {
      jwtTest = { working: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      environment: envCheck,
      database: dbTest,
      jwt: jwtTest
    })
  } catch (error) {
    return NextResponse.json({
      error: 'Debug check failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 
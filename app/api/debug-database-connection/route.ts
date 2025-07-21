import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { replicaDb } from '@/lib/mysql'

export async function GET() {
  console.log('🔍 Database Connection Diagnostic Starting...')
  
  const results = {
    postgresql: { connected: false, error: null as string | null, details: null as any },
    mysql: { connected: false, error: null as string | null, details: null as any },
    environment: {
      DATABASE_URL: !!process.env.DATABASE_URL,
      REPLICA_DATABASE_URL: !!process.env.REPLICA_DATABASE_URL
    }
  }
  
  // Test PostgreSQL
  console.log('🐘 Testing PostgreSQL connection...')
  try {
    await prisma.$connect()
    const sessionCount = await prisma.callSession.count()
    results.postgresql = {
      connected: true,
      error: null,
      details: {
        callSessions: sessionCount,
        message: 'PostgreSQL connection successful'
      }
    }
    console.log(`✅ PostgreSQL: Connected (${sessionCount} call sessions)`)
  } catch (pgError: any) {
    console.error('❌ PostgreSQL failed:', pgError.message)
    results.postgresql = {
      connected: false,
      error: pgError.message,
      details: {
        code: pgError.code,
        meta: pgError.meta
      }
    }
  }
  
  // Test MySQL
  console.log('🐬 Testing MySQL replica connection...')
  try {
    const userCount = await replicaDb.user.count()
    results.mysql = {
      connected: true,
      error: null,
      details: {
        users: userCount,
        message: 'MySQL replica connection successful'
      }
    }
    console.log(`✅ MySQL: Connected (${userCount} users)`)
  } catch (mysqlError: any) {
    console.error('❌ MySQL failed:', mysqlError.message)
    results.mysql = {
      connected: false,
      error: mysqlError.message,
      details: {
        code: mysqlError.code
      }
    }
  }
  
  const allConnected = results.postgresql.connected && results.mysql.connected
  
  return NextResponse.json({
    success: allConnected,
    message: allConnected ? 'All database connections successful' : 'One or more database connections failed',
    results,
    timestamp: new Date().toISOString()
  }, { 
    status: allConnected ? 200 : 500 
  })
} 
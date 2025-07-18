import { NextResponse } from 'next/server'
import { PrismaClient } from '@/prisma/generated/mysql-client'

export async function GET() {
  console.log('🔍 MySQL Connection Diagnostic Starting...')
  
  try {
    // Step 1: Check environment variable
    const replicaUrl = process.env.REPLICA_DATABASE_URL
    if (!replicaUrl) {
      return NextResponse.json({
        error: 'REPLICA_DATABASE_URL environment variable not found',
        step: 'Environment Check',
        success: false
      }, { status: 500 })
    }
    
    console.log('✅ Environment variable exists')
    
    // Parse URL to show connection details (without password)
    let connectionInfo = 'Hidden for security'
    try {
      const url = new URL(replicaUrl)
      connectionInfo = {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        database: url.pathname.substring(1),
        username: url.username,
        hasPassword: !!url.password
      }
      console.log('📋 Connection details:', { ...connectionInfo, password: '[HIDDEN]' })
    } catch (urlError) {
      console.warn('⚠️ Could not parse URL for debugging')
    }
    
    // Step 2: Try to create Prisma client
    let client: PrismaClient
    try {
      client = new PrismaClient({
        datasources: {
          db: {
            url: replicaUrl
          }
        },
        log: ['error', 'warn'],
        errorFormat: 'pretty'
      })
      console.log('✅ Prisma client created')
    } catch (clientError) {
      console.error('❌ Failed to create Prisma client:', clientError)
      return NextResponse.json({
        error: 'Failed to create Prisma client',
        details: clientError instanceof Error ? clientError.message : String(clientError),
        step: 'Client Creation',
        success: false
      }, { status: 500 })
    }
    
    // Step 3: Test basic connection
    console.log('🔗 Attempting database connection...')
    const connectionStart = Date.now()
    
    try {
      // Simple connection test
      await client.$connect()
      console.log('✅ Connection established')
      
      // Step 4: Test simple query
      console.log('📊 Testing simple query...')
      const userCount = await client.user.count()
      const connectionTime = Date.now() - connectionStart
      
      console.log(`✅ Query successful: ${userCount} users found in ${connectionTime}ms`)
      
      // Step 5: Test more complex query
      console.log('🧪 Testing complex query...')
      const sampleUser = await client.user.findFirst({
        where: {
          is_enabled: true,
          phone_number: { not: null }
        },
        include: {
          claims: {
            take: 1,
            include: {
              requirements: { take: 1 }
            }
          }
        }
      })
      
      await client.$disconnect()
      
      return NextResponse.json({
        success: true,
        message: '🎉 MySQL replica connection working perfectly!',
        data: {
          connectionInfo,
          statistics: {
            userCount,
            connectionTimeMs: connectionTime,
            hasSampleUser: !!sampleUser,
            sampleUserHasClaims: sampleUser?.claims?.length > 0
          },
          tests: {
            environmentVariable: '✅ Found',
            clientCreation: '✅ Success',
            databaseConnection: '✅ Connected',
            basicQuery: '✅ Working',
            complexQuery: '✅ Working'
          }
        },
        timestamp: new Date().toISOString()
      })
      
    } catch (queryError: any) {
      await client.$disconnect().catch(() => {})
      
      console.error('❌ Database query failed:', queryError)
      
      // Analyze the error type
      let errorType = 'Unknown'
      let suggestion = 'Check logs for details'
      
      const errorMessage = queryError.message || String(queryError)
      
      if (errorMessage.includes('ECONNREFUSED')) {
        errorType = 'Connection Refused'
        suggestion = 'Database server is not accepting connections. Check if RDS instance is running and security groups allow Vercel IPs.'
      } else if (errorMessage.includes('ETIMEDOUT')) {
        errorType = 'Connection Timeout'
        suggestion = 'Network timeout. Check security groups and VPC configuration.'
      } else if (errorMessage.includes('Access denied')) {
        errorType = 'Authentication Failed'
        suggestion = 'Username/password incorrect or user does not have required permissions.'
      } else if (errorMessage.includes('Unknown database')) {
        errorType = 'Database Not Found'
        suggestion = 'Database name in connection string is incorrect.'
      } else if (errorMessage.includes('SSL')) {
        errorType = 'SSL Configuration'
        suggestion = 'SSL/TLS configuration mismatch. Try adding ?sslmode=require or ?ssl=true to connection string.'
      }
      
      return NextResponse.json({
        success: false,
        error: 'Database query failed',
        errorType,
        suggestion,
        details: errorMessage,
        data: {
          connectionInfo,
          connectionTimeMs: Date.now() - connectionStart
        },
        tests: {
          environmentVariable: '✅ Found',
          clientCreation: '✅ Success',
          databaseConnection: '❌ Failed',
          basicQuery: '❌ Failed',
          complexQuery: '❌ Not Tested'
        },
        timestamp: new Date().toISOString()
      }, { status: 500 })
    }
    
  } catch (error: any) {
    console.error('❌ Unexpected error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Unexpected error in MySQL diagnostic',
      details: error.message || String(error),
      step: 'Unknown',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
} 
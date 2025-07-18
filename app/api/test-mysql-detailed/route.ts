import { NextResponse } from 'next/server'

export async function GET() {
  try {
    console.log('🔗 Starting detailed MySQL test...')
    
    // Check environment
    if (!process.env.REPLICA_DATABASE_URL) {
      return NextResponse.json({ error: 'REPLICA_DATABASE_URL not found' }, { status: 500 })
    }
    
    console.log('✅ Environment variable loaded')
    
    // Try to import PrismaClient
    let PrismaClient
    try {
      const prismaModule = await import('@/prisma/generated/mysql-client')
      PrismaClient = prismaModule.PrismaClient
      console.log('✅ PrismaClient imported successfully')
    } catch (importError) {
      console.error('❌ Failed to import PrismaClient:', importError)
      return NextResponse.json({ 
        error: 'Failed to import PrismaClient',
        details: importError instanceof Error ? importError.message : String(importError)
      }, { status: 500 })
    }
    
    // Try to create client
    let client
    try {
      client = new PrismaClient({
        datasources: {
          db: {
            url: process.env.REPLICA_DATABASE_URL
          }
        }
      })
      console.log('✅ PrismaClient created successfully')
    } catch (clientError) {
      console.error('❌ Failed to create PrismaClient:', clientError)
      return NextResponse.json({ 
        error: 'Failed to create PrismaClient',
        details: clientError instanceof Error ? clientError.message : String(clientError)
      }, { status: 500 })
    }
    
    // Try to connect and query
    try {
      console.log('🔗 Attempting to connect to database...')
      const userCount = await client.user.count()
      console.log(`✅ Connected! Found ${userCount} users`)
      
      await client.$disconnect()
      
      return NextResponse.json({
        success: true,
        message: `Successfully connected to MySQL replica! Found ${userCount} users.`,
        userCount
      })
      
    } catch (queryError) {
      console.error('❌ Failed to query database:', queryError)
      await client.$disconnect().catch(() => {})
      
      return NextResponse.json({ 
        error: 'Failed to query database',
        details: queryError instanceof Error ? queryError.message : String(queryError)
      }, { status: 500 })
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error)
    return NextResponse.json(
      { 
        error: 'Unexpected error in MySQL test',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
} 
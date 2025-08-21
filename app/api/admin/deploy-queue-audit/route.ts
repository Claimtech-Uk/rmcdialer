import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import fs from 'fs'
import path from 'path'

// Force dynamic rendering to prevent build-time database calls
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    // Auth check (same pattern as SMS migration)
    const authHeader = req.headers.get('authorization')
    const expectedToken = process.env.ADMIN_API_SECRET || 'your-secret-token'
    
    if (authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🚀 Starting Queue Transition Audit deployment...')
    
    // Check if table already exists
    const tableCheck = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'queue_transition_audit'
      ) as exists
    ` as any[]
    
    if (tableCheck[0]?.exists) {
      // Count existing records
      const recordCount = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM queue_transition_audit
      ` as any[]
      
      return NextResponse.json({
        status: 'already_exists',
        message: '✅ Queue transition audit table already exists',
        existingRecords: recordCount[0]?.count || 0,
        timestamp: new Date().toISOString(),
        recommendation: 'Table is ready - queue transitions should work'
      })
    }

    console.log('📋 Table does not exist - proceeding with deployment...')

    // Read the SQL migration file
    const sqlPath = path.join(process.cwd(), 'scripts', 'add-queue-transition-audit.sql')
    
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`Migration file not found: ${sqlPath}`)
    }
    
    const sqlContent = fs.readFileSync(sqlPath, 'utf8')
    console.log(`📄 Loaded SQL file: ${sqlPath} (${sqlContent.length} characters)`)
    
    // Track deployment steps
    const deploymentSteps = {
      tableCreated: false,
      indexesCreated: false,
      triggersCreated: false,
      viewsCreated: false,
      statementsExecuted: 0
    }

    // Execute in transaction for safety
    await prisma.$transaction(async (tx) => {
      console.log('🔒 Starting transaction...')
      
      // Split SQL into statements, filtering out comments and empty lines
      const statements = sqlContent
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'))
      
      console.log(`📊 Found ${statements.length} SQL statements to execute`)

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i].trim()
        if (statement) {
          try {
            console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`)
            await tx.$executeRawUnsafe(statement)
            deploymentSteps.statementsExecuted++
            
            // Track what we've created
            if (statement.toLowerCase().includes('create table')) {
              deploymentSteps.tableCreated = true
            } else if (statement.toLowerCase().includes('create index')) {
              deploymentSteps.indexesCreated = true
            } else if (statement.toLowerCase().includes('create trigger') || statement.toLowerCase().includes('create function')) {
              deploymentSteps.triggersCreated = true
            } else if (statement.toLowerCase().includes('create view')) {
              deploymentSteps.viewsCreated = true
            }
          } catch (error) {
            console.error(`❌ Failed on statement ${i + 1}:`, statement.substring(0, 100), error)
            throw error
          }
        }
      }
      
      console.log('✅ All statements executed successfully')
    })

    // Verify table creation and basic functionality
    const verificationResults = {
      tableExists: false,
      recordCount: 0,
      indexCount: 0,
      viewCount: 0
    }

    // Check table exists
    const tableVerify = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'queue_transition_audit'
      ) as exists
    ` as any[]
    
    verificationResults.tableExists = tableVerify[0]?.exists || false

    if (verificationResults.tableExists) {
      // Count records (should be 0 for new table)
      const countResult = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM queue_transition_audit
      ` as any[]
      verificationResults.recordCount = countResult[0]?.count || 0

      // Check indexes
      const indexResult = await prisma.$queryRaw`
        SELECT COUNT(*) as count 
        FROM pg_indexes 
        WHERE tablename = 'queue_transition_audit'
      ` as any[]
      verificationResults.indexCount = indexResult[0]?.count || 0

      // Check views
      const viewResult = await prisma.$queryRaw`
        SELECT COUNT(*) as count 
        FROM information_schema.views 
        WHERE table_schema = 'public' 
        AND table_name LIKE '%queue%transition%' OR table_name LIKE '%conversion%'
      ` as any[]
      verificationResults.viewCount = viewResult[0]?.count || 0
    }

    console.log('🎉 Queue Transition Audit system deployed successfully!')
    console.log('📊 Verification:', verificationResults)

    return NextResponse.json({
      status: 'success',
      message: '🎉 Queue transition audit table deployed successfully!',
      deployment: deploymentSteps,
      verification: verificationResults,
      timestamp: new Date().toISOString(),
      nextSteps: [
        'Test queue transitions with: curl -X POST your-domain/api/cron/discover-new-requirements',
        'Monitor audit records: SELECT * FROM queue_transition_audit ORDER BY timestamp DESC',
        'Check conversion tracking: SELECT * FROM recent_queue_transitions'
      ]
    })

  } catch (error) {
    console.error('❌ Queue audit deployment failed:', error)
    
    // Get current database state for debugging
    const debugInfo = {
      error: error instanceof Error ? error.message : 'Unknown error',
      tableExists: false
    }
    
    try {
      const tableCheck = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'queue_transition_audit'
        ) as exists
      ` as any[]
      debugInfo.tableExists = tableCheck[0]?.exists || false
    } catch {
      // Ignore secondary errors
    }

    return NextResponse.json({
      status: 'error',
      error: debugInfo.error,
      debug: debugInfo,
      recommendation: 'Check database permissions and connection. Review SQL file syntax.',
      fallbackOptions: [
        'Try direct database connection with psql',
        'Run: tsx scripts/deploy-conversion-tracking-system.ts',
        'Check database connection and permissions'
      ]
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    // Status check endpoint
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'queue_transition_audit'
      ) as exists
    ` as any[]

    if (tableExists[0]?.exists) {
      const stats = await prisma.$queryRaw`
        SELECT 
          COUNT(*) as total_records,
          COUNT(*) FILTER (WHERE conversion_logged = true) as with_conversions,
          COUNT(DISTINCT user_id) as unique_users,
          MAX(timestamp) as latest_record
        FROM queue_transition_audit
      ` as any[]

      return NextResponse.json({
        status: 'deployed',
        message: '✅ Queue transition audit table is active',
        stats: stats[0] || {},
        usage: 'POST with Authorization: Bearer [ADMIN_API_SECRET] to deploy'
      })
    } else {
      return NextResponse.json({
        status: 'not_deployed',
        message: '⚠️ Queue transition audit table does not exist',
        usage: 'POST with Authorization: Bearer [ADMIN_API_SECRET] to deploy'
      })
    }
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

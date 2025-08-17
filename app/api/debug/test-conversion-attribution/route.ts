import { NextRequest, NextResponse } from 'next/server'
import { ConversionAgentAttributionService } from '@/modules/discovery/services/conversion-agent-attribution.service'

/**
 * Manual Conversion Attribution Test Endpoint
 * 
 * This endpoint manually triggers the conversion attribution logic
 * for testing and debugging purposes.
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    console.log('🧪 [DEBUG] Manual conversion attribution test starting...')
    
    // Get query parameters for configuration with safe parsing
    let dryRun = false;
    let hoursBack = 1;
    
    try {
      const url = new URL(request.url || 'http://localhost:3000');
      dryRun = url.searchParams.get('dryRun') === 'true';
      hoursBack = parseInt(url.searchParams.get('hoursBack') || '1');
    } catch (urlError) {
      console.warn('Failed to parse URL parameters, using defaults:', urlError);
    }
    const batchSize = parseInt(url.searchParams.get('batchSize') || '50')
    
    console.log(`🔧 [DEBUG] Configuration: dryRun=${dryRun}, hoursBack=${hoursBack}, batchSize=${batchSize}`)
    
    // Initialize the attribution service
    const attributionService = new ConversionAgentAttributionService()
    
    // Run the attribution
    const result = await attributionService.attributeAgentsToConversions({
      dryRun,
      hoursBack,
      batchSize
    })
    
    const duration = Date.now() - startTime
    
    console.log('✅ [DEBUG] Manual conversion attribution completed:', {
      executionTime: `${duration}ms`,
      ...result
    })
    
    // Return detailed results
    return NextResponse.json({
      success: true,
      message: 'Manual conversion attribution completed',
      executionTime: `${duration}ms`,
      configuration: {
        dryRun,
        hoursBack,
        batchSize
      },
      results: result,
      timestamp: new Date().toISOString()
    }, { status: 200 })
    
  } catch (error: any) {
    const duration = Date.now() - startTime
    
    console.error('❌ [DEBUG] Manual conversion attribution failed:', {
      error: error.message,
      stack: error.stack,
      executionTime: `${duration}ms`
    })
    
    return NextResponse.json({
      success: false,
      error: error.message,
      executionTime: `${duration}ms`,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

/**
 * POST method for manual trigger with request body configuration
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    console.log('🧪 [DEBUG] Manual conversion attribution test (POST) starting...')
    
    // Get configuration from request body
    const body = await request.json()
    const {
      dryRun = false,
      hoursBack = 1,
      batchSize = 50
    } = body
    
    console.log(`🔧 [DEBUG] Configuration: dryRun=${dryRun}, hoursBack=${hoursBack}, batchSize=${batchSize}`)
    
    // Initialize the attribution service
    const attributionService = new ConversionAgentAttributionService()
    
    // Run the attribution
    const result = await attributionService.attributeAgentsToConversions({
      dryRun,
      hoursBack,
      batchSize
    })
    
    const duration = Date.now() - startTime
    
    console.log('✅ [DEBUG] Manual conversion attribution completed:', {
      executionTime: `${duration}ms`,
      ...result
    })
    
    // Return detailed results
    return NextResponse.json({
      success: true,
      message: 'Manual conversion attribution completed',
      executionTime: `${duration}ms`,
      configuration: {
        dryRun,
        hoursBack,
        batchSize
      },
      results: result,
      timestamp: new Date().toISOString()
    }, { status: 200 })
    
  } catch (error: any) {
    const duration = Date.now() - startTime
    
    console.error('❌ [DEBUG] Manual conversion attribution failed:', {
      error: error.message,
      stack: error.stack,
      executionTime: `${duration}ms`
    })
    
    return NextResponse.json({
      success: false,
      error: error.message,
      executionTime: `${duration}ms`,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
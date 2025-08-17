import { NextRequest, NextResponse } from 'next/server'
import { cacheService } from '@/lib/redis'

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing cacheService...')
    
    // Test if cacheService exists
    if (!cacheService) {
      return NextResponse.json({ 
        error: 'cacheService is undefined' 
      }, { status: 500 })
    }
    
    // Test basic operations
    const results = {
      cacheServiceExists: !!cacheService,
      methods: {
        get: typeof cacheService.get,
        set: typeof cacheService.set, 
        del: typeof cacheService.del,
        delPattern: typeof cacheService.delPattern
      },
      tests: {}
    }
    
    // Test set
    try {
      await cacheService.set('debug:test', 'hello', 60)
      results.tests.set = 'success'
    } catch (error) {
      results.tests.set = `failed: ${error.message}`
    }
    
    // Test get
    try {
      const value = await cacheService.get('debug:test')
      results.tests.get = value === 'hello' ? 'success' : `unexpected value: ${value}`
    } catch (error) {
      results.tests.get = `failed: ${error.message}`
    }
    
    // Test del
    try {
      await cacheService.del('debug:test')
      results.tests.del = 'success'
    } catch (error) {
      results.tests.del = `failed: ${error.message}`
    }
    
    // Test stats
    try {
      const stats = await cacheService.getStats()
      results.tests.stats = { success: true, stats }
    } catch (error) {
      results.tests.stats = `failed: ${error.message}`
    }
    
    return NextResponse.json({ 
      success: true,
      results 
    })
    
  } catch (error) {
    console.error('Cache debug failed:', error)
    return NextResponse.json({ 
      error: 'Debug failed', 
      details: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}


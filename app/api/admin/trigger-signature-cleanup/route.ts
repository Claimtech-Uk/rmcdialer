import { NextRequest, NextResponse } from 'next/server'
import { SignatureConversionCleanupService } from '@/modules/discovery/services/signature-conversion-cleanup.service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    console.log('🧹 [ADMIN TRIGGER] Manual signature conversion cleanup starting...')
    
    const cleanupService = new SignatureConversionCleanupService()
    const result = await cleanupService.cleanupSignatureConversions()
    
    const duration = Date.now() - startTime
    
    console.log(`✅ [ADMIN TRIGGER] Manual cleanup completed: ${result.summary} (${duration}ms)`)
    
    // Convert BigInt values to strings for JSON serialization
    const serializedConversions = result.conversions.map(conversion => ({
      ...conversion,
      userId: conversion.userId.toString()
    }))
    
    return NextResponse.json({
      success: result.success,
      duration,
      timestamp: result.timestamp,
      summary: result.summary,
      stats: {
        totalUnsignedUsers: result.totalUnsignedUsers,
        usersChecked: result.usersChecked,
        conversionsFound: result.conversionsFound,
        usersUpdated: result.usersUpdated,
        batchesProcessed: result.batchesProcessed,
        processingStrategy: result.processingStrategy,
        completed: result.completed
      },
      conversions: serializedConversions,
      errors: result.errors,
      triggeredBy: 'manual-admin',
      note: 'Check the conversions table in your database for new records'
    })

  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    console.error('❌ [ADMIN TRIGGER] Manual cleanup failed:', error)
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      duration,
      timestamp: new Date().toISOString(),
      triggeredBy: 'manual-admin'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Use POST to trigger signature conversion cleanup',
    endpoint: '/api/admin/trigger-signature-cleanup',
    method: 'POST'
  })
} 
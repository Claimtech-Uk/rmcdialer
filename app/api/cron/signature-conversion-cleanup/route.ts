import { NextRequest, NextResponse } from 'next/server'
import { SignatureConversionCleanupService } from '@/modules/discovery/services/signature-conversion-cleanup.service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function logCronExecution(jobName: string, status: 'running' | 'success' | 'failed', duration: number, details: any, error?: string) {
  try {
    // Skip logging in production serverless environment to avoid localhost connection errors
    // The main console.log statements provide sufficient logging in Vercel
    if (process.env.NODE_ENV === 'production') {
      return;
    }
    
    await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/cron/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobName,
        status, 
        duration,
        details,
        error
      })
    });
  } catch (logError) {
    console.error('Failed to log cron execution:', logError);
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    console.log('🧹 [CRON] Signature Conversion Cleanup starting...')
    
    // Log start
    await logCronExecution('signature-conversion-cleanup', 'running', 0, { 
      message: 'Signature conversion cleanup started',
      timestamp: new Date().toISOString()
    });
    
    const cleanupService = new SignatureConversionCleanupService()
    const result = await cleanupService.cleanupSignatureConversions()
    
    const duration = Date.now() - startTime
    
    console.log(`✅ [CRON] Signature Conversion Cleanup completed: ${result.summary} (${duration}ms)`)
    
    // Log success
    await logCronExecution('signature-conversion-cleanup', 'success', duration, {
      totalUnsignedUsers: result.totalUnsignedUsers,
      usersChecked: result.usersChecked,
      conversionsFound: result.conversionsFound,
      usersUpdated: result.usersUpdated,
      batchesProcessed: result.batchesProcessed,
      processingStrategy: result.processingStrategy,
      completed: result.completed,
      summary: result.summary
    });
    
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
      nextRun: getNextRunTime()
    })

  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    console.error('❌ [CRON] Signature Conversion Cleanup failed:', error)
    
    // Log failure
    await logCronExecution('signature-conversion-cleanup', 'failed', duration, {
      errorMessage,
      errorStack: error instanceof Error ? error.stack : undefined
    }, errorMessage);
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      duration,
      timestamp: new Date().toISOString(),
      nextRun: getNextRunTime()
    }, { status: 500 })
  }
}

// For manual testing
export async function POST(request: NextRequest) {
  return GET(request);
}

function getNextRunTime() {
  const now = new Date();
  const currentMinute = now.getMinutes();
  
  // Run every hour at minute 0
  const nextHour = new Date(now);
  nextHour.setHours(nextHour.getHours() + 1);
  nextHour.setMinutes(0);
  nextHour.setSeconds(0);
  
  const minutesUntil = Math.round((nextHour.getTime() - now.getTime()) / (1000 * 60));
  
  return `${minutesUntil} minutes`;
} 
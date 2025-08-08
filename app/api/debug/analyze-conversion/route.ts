import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userIdParam = searchParams.get('userId')
    const hoursBackParam = searchParams.get('hoursBack')

    if (!userIdParam) {
      return NextResponse.json({ success: false, error: 'Missing userId query param' }, { status: 400 })
    }

    const userId = BigInt(userIdParam)
    const HOURS_BACK_DEFAULT = 1
    const hoursBack = hoursBackParam ? Math.max(0, parseInt(hoursBackParam, 10)) : HOURS_BACK_DEFAULT

    // 1) Fetch the most recent conversion for this user
    const conversion = await prisma.conversion.findFirst({
      where: { userId },
      orderBy: { convertedAt: 'desc' }
    })

    if (!conversion) {
      return NextResponse.json({
        success: true,
        userId: userId.toString(),
        message: 'No conversions found for this user.'
      })
    }

    // 2) Determine whether the attribution cron would pick this up
    const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000)
    const inCronWindow = conversion.convertedAt >= cutoffTime

    // 3) Load call sessions for the last 30 days up to conversion date with talk time > 30
    const LOOKBACK_DAYS = 30
    const MIN_TALK_TIME_SECONDS = 30
    const lookbackDate = new Date(conversion.convertedAt.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)

    const callSessions = await prisma.callSession.findMany({
      where: {
        userId,
        startedAt: { gte: lookbackDate, lte: conversion.convertedAt },
        talkTimeSeconds: { gt: MIN_TALK_TIME_SECONDS }
      },
      select: { id: true, agentId: true, startedAt: true, talkTimeSeconds: true },
      orderBy: { startedAt: 'desc' }
    })

    const uniqueAgents: number[] = []
    const seen = new Set<number>()
    for (const s of callSessions) {
      if (s.agentId > 0 && !seen.has(s.agentId)) {
        uniqueAgents.push(s.agentId)
        seen.add(s.agentId)
      }
    }

    const primaryAgentCandidate = uniqueAgents[0] || null

    // 4) Build diagnostics
    const diagnostics: any = {
      userId: userId.toString(),
      conversion: {
        id: conversion.id,
        convertedAt: conversion.convertedAt,
        type: conversion.conversionType,
        primaryAgentId: conversion.primaryAgentId,
        sourceHint: conversion.conversionReason?.includes('pre-call') ? 'pre_call_validation' : undefined
      },
      attribution: {
        inCronWindow,
        hoursBack,
        cronCutoffTime: cutoffTime,
        candidatePrimaryAgentId: primaryAgentCandidate,
        totalQualifyingCalls: callSessions.length,
        mostRecentQualifyingCallAt: callSessions[0]?.startedAt || null
      }
    }

    // 5) Try to infer root cause
    let reason: string | null = null

    if (conversion.primaryAgentId !== null) {
      reason = 'Already attributed'
    } else if (!inCronWindow) {
      reason = 'Conversion outside attribution cron window (default 1 hour)'
    } else if (callSessions.length === 0) {
      reason = `No qualifying calls (talkTimeSeconds > ${MIN_TALK_TIME_SECONDS}) in last ${LOOKBACK_DAYS} days before conversion`
    } else {
      reason = 'Pending attribution run or temporary delay'
    }

    return NextResponse.json({ success: true, diagnostics, inferredReason: reason })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

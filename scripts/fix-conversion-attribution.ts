#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client'
import { ConversionAgentAttributionService } from '../modules/discovery/services/conversion-agent-attribution.service'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "postgres://neondb_owner:npg_G5Nva0ZuOWeR@ep-shy-silence-abdb9eor-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require"
    }
  }
})

async function fixConversionAttribution() {
  console.log('🔧 FIXING CONVERSION ATTRIBUTION')
  console.log('=' .repeat(50))

  try {
    // 1. Get all unattributed conversions
    const unattributedConversions = await prisma.conversion.findMany({
      where: { primaryAgentId: null },
      select: {
        id: true,
        userId: true,
        convertedAt: true,
        conversionType: true
      },
      orderBy: { convertedAt: 'desc' }
    })

    console.log(`📊 Found ${unattributedConversions.length} unattributed conversions`)

    let fixedCount = 0
    let skippedCount = 0

    // 2. Process each conversion
    for (const conversion of unattributedConversions) {
      // Check if there are call sessions with meaningful talk time
      const lookbackDate = new Date(conversion.convertedAt.getTime() - 30 * 24 * 60 * 60 * 1000)
      
      const callSessions = await prisma.callSession.findMany({
        where: {
          userId: conversion.userId,
          startedAt: {
            gte: lookbackDate,
            lte: conversion.convertedAt
          },
          talkTimeSeconds: { gt: 30 },
          status: 'completed'
        },
        select: {
          agentId: true,
          startedAt: true,
          talkTimeSeconds: true
        },
        orderBy: { startedAt: 'desc' }
      })

      if (callSessions.length > 0) {
        // Get unique agent IDs in order of most recent interaction
        const uniqueAgents: number[] = []
        const seenAgents = new Set<number>()
        
        for (const session of callSessions) {
          if (!seenAgents.has(session.agentId)) {
            uniqueAgents.push(session.agentId)
            seenAgents.add(session.agentId)
          }
        }

        const primaryAgentId = uniqueAgents[0]
        const contributingAgents = uniqueAgents.slice(1)

        // Update conversion with attribution
        await prisma.conversion.update({
          where: { id: conversion.id },
          data: {
            primaryAgentId,
            contributingAgents: contributingAgents.length > 0 ? contributingAgents : undefined
          }
        })

        console.log(`✅ Fixed ${conversion.id}: Primary=${primaryAgentId}, Contributing=[${contributingAgents.join(',')}]`)
        fixedCount++
      } else {
        console.log(`⏭️ Skipped ${conversion.id}: No call history (likely automated conversion)`)
        skippedCount++
      }
    }

    console.log('\n📋 SUMMARY:')
    console.log(`✅ Conversions fixed: ${fixedCount}`)
    console.log(`⏭️ Conversions skipped (automated): ${skippedCount}`)
    console.log(`📊 Total processed: ${unattributedConversions.length}`)

  } catch (error) {
    console.error('❌ Fix failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run if called directly
if (require.main === module) {
  fixConversionAttribution()
}

export { fixConversionAttribution } 
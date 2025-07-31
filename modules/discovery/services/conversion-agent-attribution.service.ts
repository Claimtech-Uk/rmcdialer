// =============================================================================
// Conversion Agent Attribution Service - Discovery Module
// =============================================================================
// Cron: Attribute agents to conversions based on call history every 15 minutes

import { prisma } from '@/lib/db'
import { logger } from '@/modules/core'
import type { 
  ConversionAgentAttributionResult,
  ConversionAgentAttributionData,
  DiscoveryOptions,
  DiscoveryServiceDependencies 
} from '../types/discovery.types'

/**
 * Conversion Agent Attribution Service
 * 
 * 🎯 CORE GOALS:
 * 1. Find conversions with primaryAgentId = null (created by automated cleanup)
 * 2. For each conversion, analyze call history with talkTimeSeconds > 30
 * 3. Set most recent agent as primaryAgentId
 * 4. Set other agents as contributingAgents JSON array
 * 
 * 🔍 SEARCH CRITERIA:
 * - Only calls with talkTimeSeconds > 30 (meaningful conversations)
 * - Look back 30 days from conversion date
 * - Most recent call determines primary agent
 * - Other agents become contributing agents
 * 
 * 🎯 PERFORMANCE:
 * - Process up to ~1,000 conversions in 28 seconds
 * - Batch processing (50 conversions per batch)
 * - Runs every 15 minutes to keep attribution current
 * - Only processes recent unattributed conversions
 */
export class ConversionAgentAttributionService {
  private readonly DEFAULT_BATCH_SIZE = 50
  private readonly MAX_EXECUTION_TIME = 28000 // 28 seconds
  private readonly MIN_TALK_TIME_SECONDS = 30
  private readonly LOOKBACK_DAYS = 30
  private startTime: number = 0

  constructor(private dependencies?: DiscoveryServiceDependencies) {}

  /**
   * Run agent attribution for unattributed conversions
   */
  async attributeAgentsToConversions(options: DiscoveryOptions = {}): Promise<ConversionAgentAttributionResult> {
    this.startTime = Date.now()
    const { 
      batchSize = this.DEFAULT_BATCH_SIZE,
      dryRun = false,
      hoursBack = 6 // Default to last 6 hours of conversions
    } = options

    const result: ConversionAgentAttributionResult = {
      timestamp: new Date(),
      duration: 0,
      success: false,
      errors: [],
      summary: '',
      totalUnattributedConversions: 0,
      conversionsChecked: 0,
      conversionsAttributed: 0,
      conversionsSkippedNoCallHistory: 0,
      batchesProcessed: 0,
      processingStrategy: '',
      completed: false,
      attributions: []
    }

    try {
      logger.info(`🏷️ [AGENT ATTRIBUTION] Starting conversion agent attribution`)
      
      // Step 1: Get unattributed conversions from recent hours
      const unattributedConversions = await this.getUnattributedConversions(hoursBack)
      result.totalUnattributedConversions = unattributedConversions.length
      
      if (unattributedConversions.length === 0) {
        result.success = true
        result.completed = true
        result.summary = `✅ No unattributed conversions found in last ${hoursBack} hours`
        logger.info(result.summary)
        return result
      }

      logger.info(`📊 Found ${unattributedConversions.length} unattributed conversions in last ${hoursBack} hours`)
      
      // Step 2: Determine processing strategy
      const maxProcessable = this.calculateMaxProcessable(batchSize)
      
      if (unattributedConversions.length <= maxProcessable) {
        // ✅ Can process all conversions this run
        result.processingStrategy = 'complete_processing'
        await this.processAllConversions(unattributedConversions, batchSize, dryRun, result)
        result.completed = true
        
      } else {
        // ⚡ Process most recent conversions first
        result.processingStrategy = 'priority_processing'
        const priorityConversions = unattributedConversions.slice(0, maxProcessable)
        await this.processAllConversions(priorityConversions, batchSize, dryRun, result)
        result.completed = false
        
        logger.warn(`⚠️ Volume too high: processed ${maxProcessable}/${unattributedConversions.length} conversions`)
      }

      result.success = true
      result.summary = dryRun 
        ? `🧪 DRY RUN: Would attribute ${result.conversionsAttributed} conversions (${result.processingStrategy})`
        : `✅ Agent Attribution: ${result.conversionsAttributed} conversions attributed, ${result.conversionsSkippedNoCallHistory} skipped (${result.processingStrategy})`

      logger.info(`🎉 [ATTRIBUTION COMPLETE] Agent Attribution Summary:`)
      logger.info(`   📊 Total unattributed: ${result.totalUnattributedConversions}`)
      logger.info(`   ✅ Conversions checked: ${result.conversionsChecked}`)
      logger.info(`   🏷️ Conversions attributed: ${result.conversionsAttributed}`)
      logger.info(`   ⏭️ Skipped (no call history): ${result.conversionsSkippedNoCallHistory}`)
      logger.info(`   📦 Batches processed: ${result.batchesProcessed}`)
      logger.info(`   🎯 Strategy: ${result.processingStrategy}`)
      logger.info(`   ✔️ Completed: ${result.completed ? 'YES' : 'PARTIAL'}`)

    } catch (error: any) {
      result.errors.push(`Attribution failed: ${error.message}`)
      result.summary = `❌ Attribution Failed: ${error.message}`
      logger.error(`❌ [ATTRIBUTION ERROR]`, error)
    }

    result.duration = Date.now() - this.startTime
    return result
  }

  /**
   * Get conversions with null primaryAgentId from recent hours
   */
  private async getUnattributedConversions(hoursBack: number): Promise<Array<{
    id: string
    userId: bigint
    convertedAt: Date
    conversionType: string
  }>> {
    try {
      const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000)
      
      return await prisma.conversion.findMany({
        where: {
          primaryAgentId: null,
          convertedAt: { gte: cutoffTime }
        },
        select: { 
          id: true,
          userId: true,
          convertedAt: true,
          conversionType: true
        },
        orderBy: [
          { convertedAt: 'desc' }  // Most recent conversions first
        ]
      })
    } catch (error: any) {
      logger.error(`❌ Error getting unattributed conversions:`, error)
      throw error
    }
  }

  /**
   * Calculate maximum processable conversions in 28 seconds
   */
  private calculateMaxProcessable(batchSize: number): number {
    const secondsPerBatch = 3.0 // Conservative estimate (database queries involved)
    const maxBatches = Math.floor(this.MAX_EXECUTION_TIME / 1000 / secondsPerBatch)
    return maxBatches * batchSize // ~466 conversions max
  }

  /**
   * Process all conversions in batches
   */
  private async processAllConversions(
    conversions: Array<{id: string, userId: bigint, convertedAt: Date, conversionType: string}>, 
    batchSize: number, 
    dryRun: boolean, 
    result: ConversionAgentAttributionResult
  ): Promise<void> {
    
    const totalBatches = Math.ceil(conversions.length / batchSize)
    let batchCount = 0

    for (let i = 0; i < conversions.length; i += batchSize) {
      if (this.isTimeoutApproaching()) {
        logger.warn(`⏰ Timeout approaching, stopping at batch ${batchCount + 1}`)
        break
      }

      const batch = conversions.slice(i, i + batchSize)
      batchCount++

      logger.info(`🔄 [BATCH ${batchCount}/${totalBatches}] Processing ${batch.length} conversions`)

      const batchResult = await this.processBatch(batch, dryRun)
      
      result.conversionsChecked += batchResult.checked
      result.conversionsAttributed += batchResult.attributed
      result.conversionsSkippedNoCallHistory += batchResult.skippedNoCallHistory
      result.attributions.push(...batchResult.attributions)
      
      const progress = Math.round((result.conversionsChecked / conversions.length) * 100)
      logger.info(`✅ [BATCH ${batchCount}] Complete: ${batchResult.attributed} attributed | Progress: ${progress}%`)

      // Small delay to prevent overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    result.batchesProcessed = batchCount
  }

  /**
   * Process a batch of conversions for agent attribution
   */
  private async processBatch(conversions: Array<{
    id: string
    userId: bigint
    convertedAt: Date
    conversionType: string
  }>, dryRun: boolean): Promise<{
    checked: number
    attributed: number
    skippedNoCallHistory: number
    attributions: ConversionAgentAttributionData[]
  }> {
    
    if (conversions.length === 0) {
      return { checked: 0, attributed: 0, skippedNoCallHistory: 0, attributions: [] }
    }

    const attributions: ConversionAgentAttributionData[] = []
    let attributed = 0
    let skippedNoCallHistory = 0

    for (const conversion of conversions) {
      try {
        // Get call history for this user with meaningful talk time
        const agentData = await this.getAgentAttributionData(conversion.userId, conversion.convertedAt)
        
        if (!agentData.primaryAgentId) {
          skippedNoCallHistory++
          logger.info(`⏭️ [SKIP] Conversion ${conversion.id}: No call history with >${this.MIN_TALK_TIME_SECONDS}s talk time`)
          continue
        }

        const attribution: ConversionAgentAttributionData = {
          conversionId: conversion.id,
          userId: conversion.userId,
          primaryAgentId: agentData.primaryAgentId,
          contributingAgents: agentData.contributingAgents,
          totalCallsAnalyzed: agentData.totalCallsAnalyzed,
          mostRecentCallDate: agentData.mostRecentCallDate,
          attributedAt: new Date()
        }

        attributions.push(attribution)

        // Update conversion record with agent data
        if (!dryRun) {
          await prisma.conversion.update({
            where: { id: conversion.id },
            data: {
              primaryAgentId: agentData.primaryAgentId,
              contributingAgents: agentData.contributingAgents
            }
          })

          attributed++
          logger.info(`🏷️ [ATTRIBUTED] Conversion ${conversion.id}: Primary=${agentData.primaryAgentId}, Contributing=[${agentData.contributingAgents.join(',')}]`)
        }
      } catch (error: any) {
        logger.error(`❌ Failed to process conversion ${conversion.id}:`, error)
      }
    }

    return {
      checked: conversions.length,
      attributed: attributed,
      skippedNoCallHistory: skippedNoCallHistory,
      attributions: attributions
    }
  }

  /**
   * Get agent attribution data for a user based on call history
   */
  private async getAgentAttributionData(userId: bigint, conversionDate: Date): Promise<{
    primaryAgentId: number | null
    contributingAgents: number[]
    totalCallsAnalyzed: number
    mostRecentCallDate: Date | null
  }> {
    
    // Look back 30 days from conversion date
    const lookbackDate = new Date(conversionDate.getTime() - this.LOOKBACK_DAYS * 24 * 60 * 60 * 1000)

    // Get all call sessions with meaningful talk time
    const callSessions = await prisma.callSession.findMany({
      where: {
        userId: userId,
        startedAt: {
          gte: lookbackDate,
          lte: conversionDate
        },
        talkTimeSeconds: {
          gt: this.MIN_TALK_TIME_SECONDS
        },
        status: 'completed' // Only completed calls
      },
      select: {
        agentId: true,
        startedAt: true,
        talkTimeSeconds: true
      },
      orderBy: [
        { startedAt: 'desc' }  // Most recent first
      ]
    })

    if (callSessions.length === 0) {
      return {
        primaryAgentId: null,
        contributingAgents: [],
        totalCallsAnalyzed: 0,
        mostRecentCallDate: null
      }
    }

    // Get unique agent IDs in order of most recent interaction
    const uniqueAgents: number[] = []
    const seenAgents = new Set<number>()
    
    for (const session of callSessions) {
      if (!seenAgents.has(session.agentId)) {
        uniqueAgents.push(session.agentId)
        seenAgents.add(session.agentId)
      }
    }

    // Most recent agent becomes primary, others become contributing
    const primaryAgentId = uniqueAgents[0]
    const contributingAgents = uniqueAgents.slice(1) // Exclude primary agent

    return {
      primaryAgentId,
      contributingAgents,
      totalCallsAnalyzed: callSessions.length,
      mostRecentCallDate: callSessions[0].startedAt
    }
  }

  /**
   * Check if approaching timeout
   */
  private isTimeoutApproaching(): boolean {
    const elapsed = Date.now() - this.startTime
    return elapsed > this.MAX_EXECUTION_TIME
  }
} 
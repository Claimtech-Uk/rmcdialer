import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/modules/core/utils/logger.utils'
import { AuthService } from '@/modules/auth/services/auth.service'

// Initialize the auth service with proper dependencies
const authService = new AuthService({
  prisma,
  logger
})

export async function GET(request: NextRequest) {
  try {
    logger.info('🧪 Starting Agent Management Function Tests...')
    
    const tests = {
      createAgent: { status: 'pending', error: null },
      updateAgent: { status: 'pending', error: null },
      resetPassword: { status: 'pending', error: null },
      deleteAgent: { status: 'pending', error: null },
      getAllAgents: { status: 'pending', error: null }
    }

    // Test 1: Get all agents
    logger.info('📋 Test 1: Getting all agents...')
    try {
      const agentsResult = await authService.getAllAgents({ page: 1, limit: 10 })
      tests.getAllAgents.status = 'success'
      logger.info(`✅ Found ${agentsResult.total} agents`)
    } catch (error: any) {
      tests.getAllAgents.status = 'error'
      tests.getAllAgents.error = error.message
      logger.error('❌ Failed to get agents:', error.message)
    }

    // Test 2: Create test agent
    logger.info('📋 Test 2: Creating test agent...')
    let testAgentId: number | null = null
    try {
      const testAgent = await authService.createAgent({
        email: `test-agent-${Date.now()}@test.com`,
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'Agent',
        role: 'agent',
        isAiAgent: false
      })
      testAgentId = testAgent.id
      tests.createAgent.status = 'success'
      logger.info(`✅ Created test agent with ID: ${testAgentId}`)
    } catch (error: any) {
      tests.createAgent.status = 'error'
      tests.createAgent.error = error.message
      logger.error('❌ Failed to create agent:', error.message)
    }

    // Test 3: Update agent (if created successfully)
    if (testAgentId) {
      logger.info('📋 Test 3: Updating test agent...')
      try {
        await authService.updateAgent(testAgentId, {
          firstName: 'Updated',
          lastName: 'TestAgent',
          role: 'supervisor'
        })
        tests.updateAgent.status = 'success'
        logger.info('✅ Updated test agent successfully')
      } catch (error: any) {
        tests.updateAgent.status = 'error'
        tests.updateAgent.error = error.message
        logger.error('❌ Failed to update agent:', error.message)
      }

      // Test 4: Reset password
      logger.info('📋 Test 4: Testing password reset...')
      try {
        await authService.resetAgentPassword(testAgentId, 'NewPassword123!')
        tests.resetPassword.status = 'success'
        logger.info('✅ Password reset successful')
      } catch (error: any) {
        tests.resetPassword.status = 'error'
        tests.resetPassword.error = error.message
        logger.error('❌ Failed to reset password:', error.message)
      }

      // Test 5: Delete agent
      logger.info('📋 Test 5: Deleting test agent...')
      try {
        await authService.deleteAgent(testAgentId)
        tests.deleteAgent.status = 'success'
        logger.info('✅ Deleted test agent successfully')
      } catch (error: any) {
        tests.deleteAgent.status = 'error'
        tests.deleteAgent.error = error.message
        logger.error('❌ Failed to delete agent:', error.message)
      }
    } else {
      tests.updateAgent.status = 'skipped'
      tests.resetPassword.status = 'skipped'
      tests.deleteAgent.status = 'skipped'
      logger.info('⏭️ Skipping update/reset/delete tests (no test agent created)')
    }

    const summary = {
      timestamp: new Date().toISOString(),
      overall: Object.values(tests).every(t => t.status === 'success' || t.status === 'skipped') ? 'PASS' : 'FAIL',
      tests,
      recommendations: [] as string[]
    }

    // Add recommendations based on test results
    if (tests.createAgent.status === 'error') {
      summary.recommendations.push('Check database connection and agent creation logic')
    }
    if (tests.deleteAgent.status === 'error') {
      summary.recommendations.push('Verify delete operation and foreign key constraints')
    }
    if (tests.resetPassword.status === 'error') {
      summary.recommendations.push('Check password hashing and update logic')
    }

    logger.info('🎯 Agent Management Tests Completed:', { summary: summary.overall })

    return NextResponse.json({
      success: true,
      message: 'Agent management tests completed',
      results: summary
    })

  } catch (error: any) {
    logger.error('❌ Agent management test failed:', error.message)
    return NextResponse.json({
      success: false,
      error: error.message,
      details: 'Failed to run agent management tests'
    }, { status: 500 })
  }
} 
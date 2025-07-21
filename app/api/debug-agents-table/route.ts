import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  console.log('🔍 Debugging agents table...')
  
  const results = {
    step1_agents_count: { success: false, details: null as any },
    step2_agents_sample: { success: false, details: null as any },
    step3_agent_sessions: { success: false, details: null as any }
  }
  
  // Step 1: Check if any agents exist
  try {
    const agentCount = await prisma.agent.count()
    results.step1_agents_count = {
      success: true,
      details: { 
        totalAgents: agentCount,
        message: agentCount > 0 ? 'Agents found in database' : 'No agents found - this is the problem!'
      }
    }
    console.log(`📊 Found ${agentCount} agents in database`)
  } catch (error: any) {
    results.step1_agents_count = {
      success: false,
      details: { error: error.message }
    }
    console.error('❌ Failed to count agents:', error)
  }
  
  // Step 2: Get sample agents if any exist
  try {
    const agents = await prisma.agent.findMany({
      take: 5,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true
      }
    })
    
    results.step2_agents_sample = {
      success: true,
      details: { 
        agents,
        message: agents.length > 0 ? 'Sample agents retrieved' : 'No agents to sample'
      }
    }
    console.log(`📋 Retrieved ${agents.length} sample agents`)
  } catch (error: any) {
    results.step2_agents_sample = {
      success: false,
      details: { error: error.message }
    }
    console.error('❌ Failed to get sample agents:', error)
  }
  
  // Step 3: Check agent sessions
  try {
    const sessionCount = await prisma.agentSession.count()
    results.step3_agent_sessions = {
      success: true,
      details: { 
        totalSessions: sessionCount,
        message: 'Agent sessions counted'
      }
    }
    console.log(`📊 Found ${sessionCount} agent sessions`)
  } catch (error: any) {
    results.step3_agent_sessions = {
      success: false,
      details: { error: error.message }
    }
    console.error('❌ Failed to count agent sessions:', error)
  }
  
  // Determine the most likely issue
  const agentCount = results.step1_agents_count.details?.totalAgents || 0
  let diagnosis = "Unknown issue"
  let solution = "Further investigation needed"
  
  if (agentCount === 0) {
    diagnosis = "🎯 ROOT CAUSE: No agents exist in database"
    solution = "Need to seed the database with at least one agent record"
  } else if (agentCount > 0) {
    diagnosis = "✅ Agents exist - issue is likely authentication context or wrong agentId"
    solution = "Check if authentication is providing valid agentId from existing agents"
  }
  
  return NextResponse.json({
    success: true,
    diagnosis,
    solution,
    results,
    timestamp: new Date().toISOString()
  })
} 
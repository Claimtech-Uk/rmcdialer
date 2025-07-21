import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST() {
  console.log('🌱 Seeding agents to match login form...')
  
  const results = {
    cleanup: { success: false, details: null as any },
    created_agents: { success: false, details: null as any }
  }
  
  try {
    // Step 1: Clean up existing agents first
    console.log('🧹 Cleaning up existing agents...')
    
    const deletedSessions = await prisma.agentSession.deleteMany({})
    const deletedAgents = await prisma.agent.deleteMany({})
    
    results.cleanup = {
      success: true,
      details: {
        deletedAgents: deletedAgents.count,
        deletedSessions: deletedSessions.count,
        message: 'Existing agents cleaned up'
      }
    }
    
    console.log(`✅ Cleaned up ${deletedAgents.count} agents and ${deletedSessions.count} sessions`)
    
    // Step 2: Create the 3 agents that match the login form
    console.log('👥 Creating new agents...')
    
    const hashedPassword = await bcrypt.hash('password123', 12)
    
    const agentsToCreate = [
      {
        email: 'agent@test.com',
        passwordHash: hashedPassword,
        firstName: 'Test',
        lastName: 'Agent',
        role: 'agent',
        isActive: true,
        isAiAgent: false
      },
      {
        email: 'supervisor@test.com',
        passwordHash: hashedPassword,
        firstName: 'Test',
        lastName: 'Supervisor',
        role: 'supervisor',
        isActive: true,
        isAiAgent: false
      },
      {
        email: 'admin@test.com',
        passwordHash: hashedPassword,
        firstName: 'Test',
        lastName: 'Admin',
        role: 'admin',
        isActive: true,
        isAiAgent: false
      }
    ]
    
    const createdAgents = []
    for (const agentData of agentsToCreate) {
      const agent = await prisma.agent.create({
        data: agentData,
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
      createdAgents.push(agent)
      console.log(`✅ Created agent: ${agent.email} (ID: ${agent.id})`)
    }
    
    results.created_agents = {
      success: true,
      details: {
        agents: createdAgents,
        count: createdAgents.length,
        message: 'All agents created successfully'
      }
    }
    
    console.log('🎉 Agent seeding completed successfully!')
    
    return NextResponse.json({
      success: true,
      message: 'Agents seeded successfully - login form quick buttons will now work',
      results,
      agents: createdAgents,
      instructions: {
        nextSteps: [
          'Test the quick login buttons on the login page',
          'Try creating a call session with a real authenticated agent',
          'The foreign key constraint should now be resolved'
        ]
      },
      timestamp: new Date().toISOString()
    })
    
  } catch (error: any) {
    console.error('❌ Agent seeding failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error.message,
      results,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
} 
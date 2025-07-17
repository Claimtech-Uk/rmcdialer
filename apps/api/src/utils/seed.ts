import { PrismaClient } from '@prisma/client';
import { hashPassword } from './auth.utils';
import { logger } from '../app';

const prisma = new PrismaClient();

const testAgents = [
  {
    email: 'admin@dialler.com',
    password: 'admin123',
    firstName: 'System',
    lastName: 'Administrator',
    role: 'admin',
    isActive: true,
    isAiAgent: false
  },
  {
    email: 'supervisor@dialler.com', 
    password: 'supervisor123',
    firstName: 'Sarah',
    lastName: 'Johnson',
    role: 'supervisor',
    isActive: true,
    isAiAgent: false
  },
  {
    email: 'agent1@dialler.com',
    password: 'agent123', 
    firstName: 'John',
    lastName: 'Smith',
    role: 'agent',
    isActive: true,
    isAiAgent: false
  },
  {
    email: 'agent2@dialler.com',
    password: 'agent123',
    firstName: 'Emma',
    lastName: 'Davis',
    role: 'agent', 
    isActive: true,
    isAiAgent: false
  },
  {
    email: 'ai-agent@dialler.com',
    password: 'ai-agent123',
    firstName: 'AI',
    lastName: 'Assistant',
    role: 'agent',
    isActive: true,
    isAiAgent: true
  }
];

export async function seedAgents() {
  try {
    logger.info('Starting agent seeding...');
    
    for (const agentData of testAgents) {
      // Check if agent already exists
      const existingAgent = await prisma.agent.findUnique({
        where: { email: agentData.email }
      });
      
      if (existingAgent) {
        logger.info(`Agent already exists: ${agentData.email}`);
        continue;
      }
      
      // Hash password
      const passwordHash = await hashPassword(agentData.password);
      
      // Create agent
      const agent = await prisma.agent.create({
        data: {
          email: agentData.email,
          passwordHash,
          firstName: agentData.firstName,
          lastName: agentData.lastName,
          role: agentData.role,
          isActive: agentData.isActive,
          isAiAgent: agentData.isAiAgent
        }
      });
      
      logger.info(`Created agent: ${agent.email} (ID: ${agent.id})`);
    }
    
    logger.info('Agent seeding completed successfully');
    
  } catch (error) {
    logger.error('Error seeding agents:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seedAgents()
    .then(() => {
      console.log('✅ Seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect();
    });
} 
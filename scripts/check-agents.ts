import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function checkAgents() {
  console.log('🔍 Checking agents in database...\n');
  
  try {
    // Count total agents
    const count = await prisma.agent.count();
    console.log(`Total agents: ${count}`);
    
    // Get all agents (without password hash for security)
    const agents = await prisma.agent.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true
      }
    });
    
    if (agents.length > 0) {
      console.log('\nExisting agents:');
      console.table(agents);
    } else {
      console.log('\n⚠️  No agents found in database!');
      console.log('\n📝 Creating a default admin agent...');
      
      // Create a default admin agent
      const passwordHash = await bcrypt.hash('Test123!', 10);
      const newAgent = await prisma.agent.create({
        data: {
          email: 'admin@test.com',
          passwordHash,
          firstName: 'Admin',
          lastName: 'User',
          role: 'admin',
          isActive: true
        }
      });
      
      console.log('✅ Created admin agent:');
      console.log({
        email: newAgent.email,
        password: 'Test123!',
        role: newAgent.role
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
checkAgents().catch(console.error);
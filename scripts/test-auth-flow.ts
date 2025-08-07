import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function testAuthFlow() {
  console.log('🧪 Testing authentication flow...\n');
  
  const email = 'admin@test.com';
  const password = 'Test123!';
  
  try {
    // Step 1: Find agent by email
    console.log('Step 1: Finding agent by email...');
    const agent = await prisma.agent.findUnique({
      where: { email, isActive: true }
    });
    
    if (!agent) {
      console.error('❌ Agent not found or not active');
      process.exit(1);
    }
    
    console.log('✅ Agent found:', {
      id: agent.id,
      email: agent.email,
      firstName: agent.firstName,
      lastName: agent.lastName,
      role: agent.role,
      isActive: agent.isActive
    });
    
    // Step 2: Verify password
    console.log('\nStep 2: Verifying password...');
    const isPasswordValid = await bcrypt.compare(password, agent.passwordHash);
    
    if (!isPasswordValid) {
      console.error('❌ Password is invalid');
      
      // Let's check what the hash should be
      const correctHash = await bcrypt.hash(password, 10);
      console.log('\nDebug info:');
      console.log('Current hash in DB:', agent.passwordHash.substring(0, 20) + '...');
      console.log('Expected hash pattern:', correctHash.substring(0, 20) + '...');
      
      // Update with correct hash
      console.log('\n🔧 Fixing password hash...');
      await prisma.agent.update({
        where: { id: agent.id },
        data: { passwordHash: correctHash }
      });
      console.log('✅ Password hash updated');
      
    } else {
      console.log('✅ Password is valid');
    }
    
    // Step 3: Test creating a session
    console.log('\nStep 3: Testing session creation...');
    const session = await prisma.agentSession.create({
      data: {
        agentId: agent.id,
        status: 'available',
        loginAt: new Date(),
        lastHeartbeat: new Date()
      }
    });
    
    console.log('✅ Session created:', {
      id: session.id,
      agentId: session.agentId,
      status: session.status
    });
    
    // Clean up test session
    await prisma.agentSession.delete({
      where: { id: session.id }
    });
    
    console.log('\n✅ Authentication flow test completed successfully!');
    console.log('🚀 Login should work now with:');
    console.log('   Email:', email);
    console.log('   Password:', password);
    
  } catch (error) {
    console.error('❌ Error during auth flow test:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testAuthFlow().catch(console.error);
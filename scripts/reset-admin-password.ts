import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function resetAdminPassword() {
  console.log('🔐 Resetting admin password...\n');
  
  try {
    // Find the admin user
    const admin = await prisma.agent.findUnique({
      where: { email: 'admin@test.com' }
    });
    
    if (!admin) {
      console.error('❌ Admin user not found!');
      process.exit(1);
    }
    
    // Generate new password hash
    const newPassword = 'Test123!';
    const passwordHash = await bcrypt.hash(newPassword, 10);
    
    // Update the password
    await prisma.agent.update({
      where: { email: 'admin@test.com' },
      data: { passwordHash }
    });
    
    console.log('✅ Password reset successfully!');
    console.log('\n📋 Login credentials:');
    console.log('   Email: admin@test.com');
    console.log('   Password: Test123!');
    console.log('\n🚀 You should be able to login now.');
    
  } catch (error) {
    console.error('❌ Error resetting password:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the reset
resetAdminPassword().catch(console.error);
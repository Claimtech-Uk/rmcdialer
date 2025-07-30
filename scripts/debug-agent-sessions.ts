import { prisma } from '../lib/db';

async function debugAgentSessions() {
  console.log('🔍 Debugging Agent Sessions...\n');
  
  try {
    // Use raw SQL to avoid Prisma naming issues
    const agents = await prisma.$queryRaw`SELECT * FROM agents WHERE is_active = true`;
    console.log(`📋 Active agents count: ${(agents as any[]).length}`);
    
    const sessions = await prisma.$queryRaw`
      SELECT 
        s.*, 
        a.first_name, 
        a.last_name, 
        a.email,
        a.is_active 
      FROM agent_sessions s 
      LEFT JOIN agents a ON s.agent_id = a.id 
      WHERE s.logout_at IS NULL
      ORDER BY s.last_activity DESC
    `;
    
    console.log(`\n📊 Active sessions count: ${(sessions as any[]).length}`);
    
    const availableSessions = await prisma.$queryRaw`
      SELECT 
        s.*, 
        a.first_name, 
        a.last_name, 
        a.email,
        a.is_active 
      FROM agent_sessions s 
      LEFT JOIN agents a ON s.agent_id = a.id 
      WHERE s.status = 'available' 
        AND s.logout_at IS NULL
        AND a.is_active = true
      ORDER BY s.last_activity ASC
    `;
    
    console.log(`\n✅ Available agents for calls: ${(availableSessions as any[]).length}`);
    
    if ((availableSessions as any[]).length === 0) {
      console.log('\n❌ No agents are currently available for calls!');
      console.log('\n💡 Current session statuses:');
      
      const allStatuses = await prisma.$queryRaw`
        SELECT status, COUNT(*) as count 
        FROM agent_sessions 
        WHERE logout_at IS NULL 
        GROUP BY status
      `;
      
      (allStatuses as any[]).forEach(row => {
        console.log(`   - ${row.status}: ${row.count} sessions`);
      });
      
      console.log('\n📝 To fix this:');
      console.log('   1. Make sure agents are logged in');
      console.log('   2. Ensure agent sessions have status: "available"');
      console.log('   3. Run: UPDATE agent_sessions SET status = "available" WHERE logout_at IS NULL AND status != "on_call"');
    } else {
      console.log('\n📞 Available agents:');
      (availableSessions as any[]).forEach(session => {
        console.log(`   - ${session.first_name} ${session.last_name} (Agent ID: ${session.agent_id}, Session ID: ${session.id})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error debugging agent sessions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugAgentSessions(); 
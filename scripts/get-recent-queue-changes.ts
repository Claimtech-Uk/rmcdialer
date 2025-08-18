// =============================================================================
// Get Recent Queue Changes - Detailed User Report
// =============================================================================
// Extract specific user IDs that were changed in recent health checks

import { prisma } from '@/lib/db';
import { replicaDb } from '@/lib/mysql';

async function getRecentQueueChanges() {
  console.log('📋 Getting detailed user changes from recent health checks...');
  console.log('===========================================================');

  try {
    // Get users who were updated in the last hour (our recent health checks)
    const recentChanges = await prisma.userCallScore.findMany({
      where: {
        lastQueueCheck: {
          gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
        }
      },
      select: {
        userId: true,
        currentQueueType: true,
        currentScore: true,
        lastQueueCheck: true,
        updatedAt: true,
        isActive: true
      },
      orderBy: { lastQueueCheck: 'desc' }
    });

    console.log(`\n📊 Found ${recentChanges.length} users with recent queue changes\n`);

    if (recentChanges.length === 0) {
      console.log('✅ No recent changes found');
      return;
    }

    // Get user details from replica DB for the changed users
    const userIds = recentChanges.map(u => u.userId);
    const userDetails = await replicaDb.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        phone_number: true,
        current_signature_file_id: true,
        status: true
      }
    });

    const userDetailsMap = new Map(userDetails.map(u => [u.id, u]));

    // Group by queue type for easier analysis
    const changesByQueue = {
      unsigned_users: [],
      outstanding_requests: [],
      none: []
    };

    console.log('📋 DETAILED USER CHANGES:');
    console.log('========================\n');

    recentChanges.forEach((change, index) => {
      const userDetail = userDetailsMap.get(change.userId);
      const queueType = change.currentQueueType || 'none';
      
      const changeRecord = {
        userId: change.userId.toString(),
        name: userDetail ? `${userDetail.first_name} ${userDetail.last_name || ''}`.trim() : 'Unknown',
        phone: userDetail?.phone_number || 'Unknown',
        currentQueueType: change.currentQueueType,
        hasSignature: !!(userDetail?.current_signature_file_id),
        userStatus: userDetail?.status || 'Unknown',
        score: change.currentScore,
        isActive: change.isActive,
        lastUpdated: change.lastQueueCheck.toISOString()
      };

      changesByQueue[queueType].push(changeRecord);

      // Log first 20 for immediate review
      if (index < 20) {
        console.log(`${index + 1:2}. User ${change.userId} (${changeRecord.name})`);
        console.log(`    Phone: ${changeRecord.phone}`);
        console.log(`    Queue Type: ${change.currentQueueType || 'none'}`);
        console.log(`    Has Signature: ${changeRecord.hasSignature ? 'Yes' : 'No'}`);
        console.log(`    Status: ${changeRecord.userStatus}`);
        console.log(`    Score: ${change.currentScore}`);
        console.log(`    Updated: ${change.lastQueueCheck.toLocaleString()}`);
        console.log('');
      }
    });

    if (recentChanges.length > 20) {
      console.log(`... and ${recentChanges.length - 20} more users\n`);
    }

    console.log('📊 CHANGES BY QUEUE TYPE:');
    console.log('=========================');
    console.log(`🔸 Unsigned Users: ${changesByQueue.unsigned_users.length} users`);
    console.log(`🔹 Outstanding Requests: ${changesByQueue.outstanding_requests.length} users`);  
    console.log(`⭕ None (Complete/Cancelled): ${changesByQueue.none.length} users`);

    // Save detailed report to file for manual review
    const reportData = {
      timestamp: new Date().toISOString(),
      totalChanges: recentChanges.length,
      changesByQueue,
      allChanges: recentChanges.map(change => {
        const userDetail = userDetailsMap.get(change.userId);
        return {
          userId: change.userId.toString(),
          name: userDetail ? `${userDetail.first_name} ${userDetail.last_name || ''}`.trim() : 'Unknown',
          phone: userDetail?.phone_number || 'Unknown',
          currentQueueType: change.currentQueueType,
          hasSignature: !!(userDetail?.current_signature_file_id),
          userStatus: userDetail?.status || 'Unknown',
          score: change.currentScore,
          isActive: change.isActive,
          lastUpdated: change.lastQueueCheck.toISOString()
        };
      })
    };

    // Write to file for detailed analysis
    const fs = require('fs');
    const reportFile = `queue-health-changes-${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.json`;
    fs.writeFileSync(reportFile, JSON.stringify(reportData, null, 2));
    
    console.log(`\n📄 Detailed report saved to: ${reportFile}`);
    console.log('💡 You can open this file to see all user IDs and their changes');
    
    // Sample users for spot checking
    console.log('\n🎯 SAMPLE USERS FOR SPOT CHECKING:');
    console.log('=================================');
    
    if (changesByQueue.unsigned_users.length > 0) {
      console.log('\n📍 Users moved to unsigned_users queue:');
      changesByQueue.unsigned_users.slice(0, 5).forEach((user, i) => {
        console.log(`   ${i + 1}. User ID ${user.userId} (${user.name}) - ${user.phone}`);
        console.log(`      Signature: ${user.hasSignature ? 'Has' : 'Missing'} | Status: ${user.userStatus}`);
      });
    }

    if (changesByQueue.none.length > 0) {
      console.log('\n📍 Users moved to none (complete/cancelled):');
      changesByQueue.none.slice(0, 5).forEach((user, i) => {
        console.log(`   ${i + 1}. User ID ${user.userId} (${user.name}) - ${user.phone}`);
        console.log(`      Signature: ${user.hasSignature ? 'Has' : 'Missing'} | Status: ${user.userStatus}`);
      });
    }

  } catch (error) {
    console.error('❌ Failed to get recent changes:', error);
  }
}

getRecentQueueChanges()
  .then(() => {
    console.log('\n🏁 Recent changes analysis completed!');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Analysis failed:', error);
    process.exit(1);
  });

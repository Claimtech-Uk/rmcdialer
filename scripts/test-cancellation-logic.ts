// =============================================================================
// Test Cancellation Logic - Detailed Breakdown
// =============================================================================
// Verify that cancelled users and cancelled claims are handled correctly

import { replicaDb } from '@/lib/mysql';
import { prisma } from '@/lib/db';

async function testCancellationLogic() {
  console.log('🧪 Testing Cancellation Logic in Detail...');
  console.log('==========================================');

  try {
    // Test 1: Get sample of users with different statuses
    const testUsers = await replicaDb.user.findMany({
      where: {
        is_enabled: true,
        phone_number: { not: null },
        first_name: { not: null }
      },
      include: {
        claims: {
          include: {
            requirements: {
              where: { status: 'PENDING' }
            }
          }
        }
      },
      take: 50,
      orderBy: { id: 'asc' }
    });

    console.log(`\n📊 Analyzing ${testUsers.length} users for cancellation patterns...\n`);

    const stats = {
      userCancelled: 0,
      allClaimsCancelled: 0,
      activeWithSignature: 0,
      activeWithoutSignature: 0,
      activeWithMixedClaims: 0
    };

    const EXCLUDED_TYPES = [
      'signature',
      'vehicle_registration',
      'cfa',
      'solicitor_letter_of_authority',
      'letter_of_authority'
    ];

    testUsers.forEach(user => {
      // Check user cancellation
      if (user.status === 'cancelled') {
        stats.userCancelled++;
        console.log(`❌ User ${user.id}: CANCELLED (status = cancelled)`);
        return;
      }

      // Check claims cancellation
      if (user.claims.length > 0) {
        const activeClaims = user.claims.filter(c => c.status !== 'cancelled');
        const cancelledClaims = user.claims.filter(c => c.status === 'cancelled');
        
        if (activeClaims.length === 0) {
          stats.allClaimsCancelled++;
          console.log(`❌ User ${user.id}: ALL CLAIMS CANCELLED (${cancelledClaims.length} cancelled claims)`);
          return;
        }

        if (cancelledClaims.length > 0) {
          stats.activeWithMixedClaims++;
          console.log(`⚠️  User ${user.id}: MIXED CLAIMS (${activeClaims.length} active, ${cancelledClaims.length} cancelled)`);
        }
      }

      // Check signature status for active users
      if (!user.current_signature_file_id) {
        stats.activeWithoutSignature++;
        console.log(`🔸 User ${user.id}: ACTIVE, NO SIGNATURE → should be unsigned_users`);
      } else {
        // Count valid requirements (excluding cancelled claims)
        const validRequirements = user.claims.reduce((acc, claim) => {
          if (claim.status === 'cancelled') return acc; // Skip cancelled claims
          
          const validReqs = claim.requirements.filter(req => {
            if (req.status !== 'PENDING') return false;
            if (EXCLUDED_TYPES.includes(req.type || '')) return false;
            if (req.type === 'id_document' && 
                req.claim_requirement_reason === 'base requirement for claim.') {
              return false;
            }
            return true;
          });
          
          return acc + validReqs.length;
        }, 0);

        if (validRequirements > 0) {
          console.log(`🔹 User ${user.id}: ACTIVE, HAS SIGNATURE, ${validRequirements} pending requirements → should be outstanding_requests`);
        } else {
          stats.activeWithSignature++;
          console.log(`✅ User ${user.id}: ACTIVE, COMPLETE → no queue needed`);
        }
      }
    });

    console.log('\n📈 CANCELLATION BREAKDOWN:');
    console.log(`   🚫 User cancelled: ${stats.userCancelled} users`);
    console.log(`   🚫 All claims cancelled: ${stats.allClaimsCancelled} users`);
    console.log(`   ⚠️  Mixed claims (some cancelled): ${stats.activeWithMixedClaims} users`);
    console.log(`   🔸 Active, no signature: ${stats.activeWithoutSignature} users`);
    console.log(`   ✅ Active, complete: ${stats.activeWithSignature} users`);

    console.log('\n✅ CONCLUSION:');
    console.log(`   Total excluded from queues: ${stats.userCancelled + stats.allClaimsCancelled} users`);
    console.log(`   Total should be in queues: ${stats.activeWithoutSignature} users (unsigned_users)`);
    console.log(`   Total complete: ${stats.activeWithSignature} users (no queue needed)`);

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testCancellationLogic()
  .then(() => {
    console.log('\n🏁 Cancellation logic test completed!');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });

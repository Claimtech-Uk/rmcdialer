import { NextResponse } from 'next/server';
import { replicaDb } from '@/lib/mysql';

export async function GET() {
  try {
    console.log('🧪 Testing MySQL replica only...');

    // Test 1: Get users with basic data
    console.log('📋 Test 1: Getting users from MySQL replica...');
    const users = await replicaDb.user.findMany({
      where: {
        is_enabled: true,
        status: {
          not: 'inactive'
        }
      },
      include: {
        claims: {
          include: {
            requirements: {
              where: { status: 'PENDING' }
            },
            vehiclePackages: true
          }
        },
        address: true
      },
      take: 3, // Just get 3 users for testing
      orderBy: { created_at: 'desc' }
    });

    console.log(`✅ Found ${users.length} users`);

    // Process users with proper BigInt handling
    const processedUsers = users.map(user => {
      return {
        id: Number(user.id),
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email_address,
        phoneNumber: user.phone_number,
        status: user.status,
        isEnabled: user.is_enabled,
        introducer: user.introducer,
        solicitor: user.solicitor,
        lastLogin: user.last_login,
        address: user.address ? {
          id: user.address.id,
          type: user.address.type,
          fullAddress: user.address.full_address,
          postCode: user.address.post_code,
          county: user.address.county
        } : null,
        claims: user.claims.map(claim => ({
          id: Number(claim.id),
          type: claim.type,
          status: claim.status,
          lender: claim.lender,
          solicitor: claim.solicitor,
          lastUpdated: claim.client_last_updated_at,
          requirementsCount: claim.requirements.length,
          vehiclePackagesCount: claim.vehiclePackages.length,
          requirements: claim.requirements.map(req => ({
            id: req.id,
            type: req.type,
            status: req.status,
            reason: req.claim_requirement_reason,
            rejectionReason: req.claim_requirement_rejection_reason,
            createdAt: req.created_at
          })),
          vehiclePackages: claim.vehiclePackages.map(pkg => ({
            id: pkg.id,
            registration: pkg.vehicle_registration,
            make: pkg.vehicle_make,
            model: pkg.vehicle_model,
            dealership: pkg.dealership_name,
            monthlyPayment: pkg.monthly_payment ? Number(pkg.monthly_payment) : null,
            contractStartDate: pkg.contract_start_date,
            status: pkg.status
          }))
        }))
      };
    });

    console.log('✅ Users processed successfully');
    console.log(`📊 Total claims: ${processedUsers.reduce((acc, u) => acc + u.claims.length, 0)}`);
    console.log(`📄 Total requirements: ${processedUsers.reduce((acc, u) => acc + u.claims.reduce((acc2, c) => acc2 + c.requirementsCount, 0), 0)}`);

    // Test 2: Get total counts
    const [totalUsers, totalClaims] = await Promise.all([
      replicaDb.user.count({
        where: { is_enabled: true }
      }),
      replicaDb.claim.count()
    ]);

    console.log(`📊 Database totals - Users: ${totalUsers}, Claims: ${totalClaims}`);

    return NextResponse.json({
      success: true,
      data: {
        sampleUsers: processedUsers,
        statistics: {
          totalEnabledUsers: totalUsers,
          totalClaims: totalClaims,
          sampleSize: processedUsers.length
        }
      },
      tests: {
        mysqlConnection: '✅ Working',
        userDataRetrieval: '✅ Working',
        claimsAndRequirements: '✅ Working',
        dataTransformation: '✅ Working'
      },
      message: 'MySQL replica connection and data retrieval working perfectly!',
      timestamp: new Date()
    });

  } catch (error: any) {
    console.error('❌ MySQL test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      details: error.stack,
      tests: {
        mysqlConnection: '❌ Failed',
        userDataRetrieval: '❌ Failed',
        claimsAndRequirements: '❌ Failed',
        dataTransformation: '❌ Failed'
      },
      timestamp: new Date(),
      message: 'MySQL replica test failed'
    }, { status: 500 });
  }
} 
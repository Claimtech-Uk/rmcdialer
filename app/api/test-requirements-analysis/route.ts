import { NextResponse } from 'next/server';
import { replicaDb } from '@/lib/mysql';

export async function GET(request: Request) {
  try {
    console.log('🔍 Analyzing real ClaimRequirement data from MySQL replica...');
    
    const results: any = {
      timestamp: new Date().toISOString(),
      analysis: {}
    };

    // Get unique requirement types from live data
    console.log('📋 Getting unique requirement types...');
    const requirementTypes = await replicaDb.$queryRaw`
      SELECT type, COUNT(*) as count
      FROM claim_requirements 
      WHERE type IS NOT NULL
      GROUP BY type 
      ORDER BY count DESC
    ` as Array<{ type: string; count: bigint }>;
    
    results.analysis.requirementTypes = {
      total: requirementTypes.length,
      breakdown: requirementTypes.map(item => ({
        type: item.type,
        count: Number(item.count)
      }))
    };

    // Get unique requirement statuses from live data
    console.log('📊 Getting unique requirement statuses...');
    const requirementStatuses = await replicaDb.$queryRaw`
      SELECT status, COUNT(*) as count
      FROM claim_requirements 
      WHERE status IS NOT NULL
      GROUP BY status 
      ORDER BY count DESC
    ` as Array<{ status: string; count: bigint }>;
    
    results.analysis.requirementStatuses = {
      total: requirementStatuses.length,
      breakdown: requirementStatuses.map(item => ({
        status: item.status,
        count: Number(item.count)
      }))
    };

    // Get unique requirement reasons from live data
    console.log('📝 Getting unique requirement reasons...');
    const requirementReasons = await replicaDb.$queryRaw`
      SELECT claim_requirement_reason, COUNT(*) as count
      FROM claim_requirements 
      WHERE claim_requirement_reason IS NOT NULL
      GROUP BY claim_requirement_reason 
      ORDER BY count DESC
      LIMIT 20
    ` as Array<{ claim_requirement_reason: string; count: bigint }>;
    
    results.analysis.requirementReasons = {
      total: requirementReasons.length,
      topReasons: requirementReasons.map(item => ({
        reason: item.claim_requirement_reason,
        count: Number(item.count)
      }))
    };

    // Get rejection reasons (if any)
    console.log('❌ Getting rejection reasons...');
    const rejectionReasons = await replicaDb.$queryRaw`
      SELECT claim_requirement_rejection_reason, COUNT(*) as count
      FROM claim_requirements 
      WHERE claim_requirement_rejection_reason IS NOT NULL
      GROUP BY claim_requirement_rejection_reason 
      ORDER BY count DESC
      LIMIT 10
    ` as Array<{ claim_requirement_rejection_reason: string; count: bigint }>;
    
    results.analysis.rejectionReasons = {
      total: rejectionReasons.length,
      topRejections: rejectionReasons.map(item => ({
        reason: item.claim_requirement_rejection_reason,
        count: Number(item.count)
      }))
    };

    // Get requirement age distribution
    console.log('📅 Analyzing requirement age distribution...');
    const ageDistribution = await replicaDb.$queryRaw`
      SELECT 
        CASE 
          WHEN DATEDIFF(NOW(), created_at) <= 7 THEN 'Last 7 days'
          WHEN DATEDIFF(NOW(), created_at) <= 30 THEN '8-30 days'
          WHEN DATEDIFF(NOW(), created_at) <= 90 THEN '31-90 days'
          WHEN DATEDIFF(NOW(), created_at) <= 180 THEN '91-180 days'
          ELSE 'Over 180 days'
        END as age_group,
        COUNT(*) as count
      FROM claim_requirements 
      WHERE created_at IS NOT NULL
      GROUP BY age_group
      ORDER BY 
        CASE age_group
          WHEN 'Last 7 days' THEN 1
          WHEN '8-30 days' THEN 2
          WHEN '31-90 days' THEN 3
          WHEN '91-180 days' THEN 4
          ELSE 5
        END
    ` as Array<{ age_group: string; count: bigint }>;
    
    results.analysis.ageDistribution = ageDistribution.map(item => ({
      ageGroup: item.age_group,
      count: Number(item.count)
    }));

    // Get sample requirements to see actual data structure
    console.log('📄 Getting sample requirements...');
    const sampleRequirements = await replicaDb.claimRequirement.findMany({
      take: 10,
      orderBy: { created_at: 'desc' },
      include: {
        claim: {
          include: {
            user: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                is_enabled: true
              }
            }
          }
        }
      }
    });

    results.analysis.sampleRequirements = sampleRequirements.map(req => ({
      id: req.id,
      type: req.type,
      status: req.status,
      reason: req.claim_requirement_reason,
      rejectionReason: req.claim_requirement_rejection_reason,
      createdAt: req.created_at,
      updatedAt: req.updated_at,
      user: {
        id: Number(req.claim.user.id),
        firstName: req.claim.user.first_name,
        lastName: req.claim.user.last_name,
        isEnabled: req.claim.user.is_enabled
      }
    }));

    // Get combinations of type + status for filtering insights
    console.log('🔄 Getting type-status combinations...');
    const typeStatusCombos = await replicaDb.$queryRaw`
      SELECT type, status, COUNT(*) as count
      FROM claim_requirements 
      WHERE type IS NOT NULL AND status IS NOT NULL
      GROUP BY type, status 
      ORDER BY count DESC
      LIMIT 30
    ` as Array<{ type: string; status: string; count: bigint }>;
    
    results.analysis.typeStatusCombinations = typeStatusCombos.map(item => ({
      type: item.type,
      status: item.status,
      count: Number(item.count)
    }));

    // Get total counts for context
    const totalRequirements = await replicaDb.claimRequirement.count();
    const pendingRequirements = await replicaDb.claimRequirement.count({
      where: { status: 'PENDING' }
    });

    results.analysis.summary = {
      totalRequirements,
      pendingRequirements,
      pendingPercentage: ((pendingRequirements / totalRequirements) * 100).toFixed(1)
    };

    console.log('✅ ClaimRequirement analysis completed');
    
    return NextResponse.json({
      success: true,
      message: 'Real ClaimRequirement data analysis completed',
      results,
      insights: {
        mostCommonType: results.analysis.requirementTypes.breakdown[0]?.type || 'Unknown',
        mostCommonStatus: results.analysis.requirementStatuses.breakdown[0]?.status || 'Unknown',
        totalUniqueTypes: results.analysis.requirementTypes.total,
        totalUniqueStatuses: results.analysis.requirementStatuses.total,
        dataFreshness: `${results.analysis.summary.pendingPercentage}% of requirements are PENDING`
      },
      usage: {
        filteringOptions: 'Use the type and status breakdowns to create targeted queues',
        ageBasedFiltering: 'Use age distribution to prioritize fresh vs stale requirements',
        reasonBasedFiltering: 'Use requirement reasons for context-aware calling'
      }
    });

  } catch (error: any) {
    console.error('❌ Requirements analysis failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      details: error.stack,
      timestamp: new Date().toISOString(),
      message: 'Requirements analysis failed'
    }, { status: 500 });
  }
} 
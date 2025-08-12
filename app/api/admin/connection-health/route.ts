import { NextRequest, NextResponse } from 'next/server';
import { replicaDatabaseCircuitBreaker, databaseCircuitBreaker } from '@/lib/services/circuit-breaker.service';
import { queryDeduplication } from '@/lib/services/query-deduplication.service';
import { getReplicaStats } from '@/lib/mysql';

/**
 * Admin endpoint to monitor database connection health, circuit breaker status,
 * and query deduplication performance
 */
export async function GET(request: NextRequest) {
  try {
    // Get circuit breaker stats
    const replicaCircuitStats = replicaDatabaseCircuitBreaker.getStats();
    const mainCircuitStats = databaseCircuitBreaker.getStats();
    
    // Get query deduplication stats
    const deduplicationStats = queryDeduplication.getStats();
    
    // Get database connection stats
    let replicaDbStats;
    try {
      replicaDbStats = await getReplicaStats();
    } catch (error) {
      replicaDbStats = {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    const healthData = {
      timestamp: new Date().toISOString(),
      
      // Circuit Breaker Status
      circuitBreakers: {
        replicaDatabase: {
          ...replicaCircuitStats,
          healthy: replicaCircuitStats.state === 'closed' && replicaCircuitStats.successRate > 90
        },
        mainDatabase: {
          ...mainCircuitStats,
          healthy: mainCircuitStats.state === 'closed' && mainCircuitStats.successRate > 90
        }
      },
      
      // Query Deduplication Performance
      queryDeduplication: {
        ...deduplicationStats,
        description: 'Prevents duplicate concurrent queries for same data'
      },
      
      // Database Connection Health
      databases: {
        replica: {
          ...replicaDbStats,
          description: 'MySQL replica for user/claim data'
        }
      },

      // Overall Health Assessment
      overallHealth: {
        status: getOverallHealthStatus(replicaCircuitStats, mainCircuitStats, replicaDbStats),
        recommendations: getHealthRecommendations(replicaCircuitStats, mainCircuitStats, replicaDbStats)
      }
    };

    return NextResponse.json(healthData);

  } catch (error) {
    console.error('Failed to get connection health:', error);
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      error: 'Failed to retrieve connection health',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Determine overall health status
 */
function getOverallHealthStatus(replicaStats: any, mainStats: any, dbStats: any): string {
  // Critical issues
  if (!dbStats.connected) return 'CRITICAL';
  if (replicaStats.state === 'open' || mainStats.state === 'open') return 'DEGRADED';
  
  // Performance issues
  if (replicaStats.successRate < 90 || mainStats.successRate < 90) return 'WARNING';
  if (replicaStats.avgDuration > 10000 || mainStats.avgDuration > 10000) return 'WARNING';
  
  return 'HEALTHY';
}

/**
 * Generate health recommendations
 */
function getHealthRecommendations(replicaStats: any, mainStats: any, dbStats: any): string[] {
  const recommendations: string[] = [];
  
  if (!dbStats.connected) {
    recommendations.push('Database connection failed - check connection string and network');
  }
  
  if (replicaStats.state === 'open') {
    recommendations.push(`Replica database circuit breaker is OPEN - will retry in ${Math.ceil(replicaStats.timeUntilRetry / 1000)}s`);
  }
  
  if (mainStats.state === 'open') {
    recommendations.push(`Main database circuit breaker is OPEN - will retry in ${Math.ceil(mainStats.timeUntilRetry / 1000)}s`);
  }
  
  if (replicaStats.successRate < 90) {
    recommendations.push(`Replica database success rate is low (${replicaStats.successRate}%) - investigate query performance`);
  }
  
  if (replicaStats.avgDuration > 10000) {
    recommendations.push(`Replica database queries are slow (${replicaStats.avgDuration}ms avg) - consider query optimization`);
  }
  
  if (mainStats.avgDuration > 15000) {
    recommendations.push(`Main database queries are slow (${mainStats.avgDuration}ms avg) - consider connection pool tuning`);
  }
  
  if (recommendations.length === 0) {
    recommendations.push('All systems operating normally');
  }
  
  return recommendations;
}

/**
 * Force circuit breaker reset (emergency admin action)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, circuitBreaker } = body;
    
    if (action === 'reset') {
      if (circuitBreaker === 'replica' || circuitBreaker === 'all') {
        replicaDatabaseCircuitBreaker.reset();
        console.log('🔄 Admin action: Replica database circuit breaker reset');
      }
      
      if (circuitBreaker === 'main' || circuitBreaker === 'all') {
        databaseCircuitBreaker.reset();
        console.log('🔄 Admin action: Main database circuit breaker reset');
      }
      
      return NextResponse.json({ 
        success: true, 
        message: `Circuit breaker(s) reset: ${circuitBreaker}` 
      });
    }
    
    if (action === 'clear_deduplication') {
      queryDeduplication.clear();
      console.log('🧹 Admin action: Query deduplication cache cleared');
      
      return NextResponse.json({ 
        success: true, 
        message: 'Query deduplication cache cleared' 
      });
    }
    
    return NextResponse.json({ 
      error: 'Invalid action. Supported: reset, clear_deduplication' 
    }, { status: 400 });
    
  } catch (error) {
    console.error('Failed to process admin action:', error);
    return NextResponse.json({ 
      error: 'Failed to process admin action',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

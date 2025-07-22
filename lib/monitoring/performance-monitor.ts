interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: Date;
  userId?: number;
  sessionId?: string;
  success: boolean;
  error?: string;
}

interface PerformanceStats {
  operation: string;
  totalCalls: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  successRate: number;
  slowCallsCount: number; // Calls taking > 2 seconds
  lastUpdated: Date;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private readonly maxStoredMetrics = 1000;
  private readonly slowCallThreshold = 2000; // 2 seconds

  /**
   * Record a performance metric for an operation
   */
  recordMetric(metric: Omit<PerformanceMetric, 'timestamp'>): void {
    const fullMetric: PerformanceMetric = {
      ...metric,
      timestamp: new Date()
    };

    this.metrics.push(fullMetric);

    // Keep only the last N metrics to prevent memory leaks
    if (this.metrics.length > this.maxStoredMetrics) {
      this.metrics = this.metrics.slice(-this.maxStoredMetrics);
    }

    // Log slow operations for investigation
    if (metric.duration > this.slowCallThreshold) {
      console.warn(`🐌 Slow operation detected: ${metric.operation} took ${metric.duration}ms`, {
        userId: metric.userId,
        sessionId: metric.sessionId,
        success: metric.success,
        error: metric.error
      });
    }

    // Log performance for analysis
    console.log(`⏱️ [PERF] ${metric.operation}: ${metric.duration}ms ${metric.success ? '✅' : '❌'}`, {
      userId: metric.userId,
      sessionId: metric.sessionId
    });
  }

  /**
   * Get performance statistics for an operation
   */
  getStats(operation: string): PerformanceStats | null {
    const operationMetrics = this.metrics.filter(m => m.operation === operation);
    
    if (operationMetrics.length === 0) {
      return null;
    }

    const durations = operationMetrics.map(m => m.duration);
    const successfulCalls = operationMetrics.filter(m => m.success).length;
    const slowCalls = operationMetrics.filter(m => m.duration > this.slowCallThreshold).length;

    return {
      operation,
      totalCalls: operationMetrics.length,
      averageDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      successRate: successfulCalls / operationMetrics.length,
      slowCallsCount: slowCalls,
      lastUpdated: new Date()
    };
  }

  /**
   * Get all performance statistics
   */
  getAllStats(): PerformanceStats[] {
    const operations = [...new Set(this.metrics.map(m => m.operation))];
    return operations.map(op => this.getStats(op)).filter(Boolean) as PerformanceStats[];
  }

  /**
   * Get slow operations (above threshold)
   */
  getSlowOperations(): PerformanceMetric[] {
    return this.metrics.filter(m => m.duration > this.slowCallThreshold);
  }

  /**
   * Clear old metrics older than specified hours
   */
  cleanup(hoursOld: number = 24): void {
    const cutoffTime = new Date(Date.now() - hoursOld * 60 * 60 * 1000);
    this.metrics = this.metrics.filter(m => m.timestamp > cutoffTime);
  }

  /**
   * Get summary of current performance
   */
  getSummary(): {
    totalOperations: number;
    slowOperationsCount: number;
    averageResponseTime: number;
    topSlowOperations: Array<{ operation: string; averageDuration: number; count: number; }>;
  } {
    const allStats = this.getAllStats();
    const slowOps = this.getSlowOperations();
    
    const totalOperations = this.metrics.length;
    const slowOperationsCount = slowOps.length;
    const averageResponseTime = this.metrics.reduce((sum, m) => sum + m.duration, 0) / this.metrics.length;

    // Get top 5 slowest operations by average duration
    const topSlowOperations = allStats
      .sort((a, b) => b.averageDuration - a.averageDuration)
      .slice(0, 5)
      .map(stat => ({
        operation: stat.operation,
        averageDuration: Math.round(stat.averageDuration),
        count: stat.totalCalls
      }));

    return {
      totalOperations,
      slowOperationsCount,
      averageResponseTime: Math.round(averageResponseTime),
      topSlowOperations
    };
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Export types
export type { PerformanceMetric, PerformanceStats };

// Helper function to time operations
export function timeOperation<T>(
  operation: string,
  fn: () => Promise<T>,
  context?: { userId?: number; sessionId?: string; }
): Promise<T> {
  const startTime = Date.now();
  
  return fn()
    .then(result => {
      const duration = Date.now() - startTime;
      performanceMonitor.recordMetric({
        operation,
        duration,
        success: true,
        userId: context?.userId,
        sessionId: context?.sessionId
      });
      return result;
    })
    .catch(error => {
      const duration = Date.now() - startTime;
      performanceMonitor.recordMetric({
        operation,
        duration,
        success: false,
        error: error.message,
        userId: context?.userId,
        sessionId: context?.sessionId
      });
      throw error;
    });
} 
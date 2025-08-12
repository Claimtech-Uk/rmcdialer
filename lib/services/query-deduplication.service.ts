/**
 * Query Deduplication Service
 * Prevents multiple concurrent identical queries from hitting the database
 * Uses in-memory promise deduplication to handle thundering herd scenarios
 */

interface PendingQuery<T> {
  promise: Promise<T>;
  timestamp: number;
  requestCount: number;
}

export class QueryDeduplicationService {
  private pendingQueries = new Map<string, PendingQuery<any>>();
  private readonly maxAge = 10000; // 10 seconds max age for pending queries
  private readonly cleanupInterval = 5000; // Cleanup every 5 seconds
  private lastCleanup = 0;

  constructor() {
    // No setInterval in serverless - cleanup on-demand during operations
  }

  /**
   * Execute a query with deduplication
   * If same query is already running, returns the existing promise
   */
  async deduplicate<T>(
    key: string,
    queryFn: () => Promise<T>,
    options: {
      maxAge?: number;
      description?: string;
    } = {}
  ): Promise<T> {
    const { maxAge = this.maxAge, description = 'query' } = options;
    const now = Date.now();

    // Perform cleanup on-demand (serverless-friendly)
    this.maybeCleanup(now);

    // Check if we have a pending query for this key
    const existing = this.pendingQueries.get(key);
    
    if (existing && (now - existing.timestamp) < maxAge) {
      // Increment request count for monitoring
      existing.requestCount++;
      
      console.log(`🔄 Deduplicating ${description} (key: ${key.substring(0, 20)}...) - ${existing.requestCount} concurrent requests`);
      
      return existing.promise;
    }

    // No existing query or it's stale, create new one
    console.log(`🚀 Starting new ${description} (key: ${key.substring(0, 20)}...)`);
    
    const promise = this.executeWithCleanup(key, queryFn, description);
    
    this.pendingQueries.set(key, {
      promise,
      timestamp: now,
      requestCount: 1
    });

    return promise;
  }

  /**
   * Execute query and clean up afterwards
   */
  private async executeWithCleanup<T>(
    key: string,
    queryFn: () => Promise<T>,
    description: string
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await queryFn();
      const duration = Date.now() - startTime;
      
      const pending = this.pendingQueries.get(key);
      const requestCount = pending?.requestCount || 1;
      
      console.log(`✅ ${description} completed in ${duration}ms (key: ${key.substring(0, 20)}...) - served ${requestCount} concurrent requests`);
      
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const pending = this.pendingQueries.get(key);
      const requestCount = pending?.requestCount || 1;
      
      console.error(`❌ ${description} failed after ${duration}ms (key: ${key.substring(0, 20)}...) - ${requestCount} concurrent requests:`, error);
      
      throw error;
      
    } finally {
      // Always clean up the pending query
      this.pendingQueries.delete(key);
    }
  }

  /**
   * Clean up stale pending queries (on-demand, serverless-friendly)
   */
  private maybeCleanup(now: number): void {
    // Only cleanup if enough time has passed since last cleanup
    if (now - this.lastCleanup < this.cleanupInterval) {
      return;
    }
    
    this.lastCleanup = now;
    this.cleanup();
  }

  /**
   * Clean up stale pending queries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, query] of this.pendingQueries.entries()) {
      if (now - query.timestamp > this.maxAge) {
        this.pendingQueries.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} stale queries`);
    }
  }

  /**
   * Get current statistics
   */
  getStats() {
    return {
      pendingQueries: this.pendingQueries.size,
      maxAge: this.maxAge,
      cleanupInterval: this.cleanupInterval
    };
  }

  /**
   * Clear all pending queries (for testing/emergency)
   */
  clear(): void {
    const count = this.pendingQueries.size;
    this.pendingQueries.clear();
    console.log(`🧹 Cleared ${count} pending queries`);
  }
}

// Global singleton instance
export const queryDeduplication = new QueryDeduplicationService();

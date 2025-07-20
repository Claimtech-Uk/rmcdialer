// Simple in-memory cache - no Redis needed
console.log('📝 Using in-memory cache (Redis removed for simplicity)')

// Cache key patterns - centralized for consistency
export const CACHE_KEYS = {
  user: (id: number) => `user:${id}`,
  userContext: (id: number) => `user:${id}:context`, 
  userClaims: (userId: number) => `user:${userId}:claims`,
  eligibleUsers: (filters?: string) => `eligible_users:${filters || 'default'}`,
  userScore: (userId: number) => `user:${userId}:score`,
  queue: (status: string) => `queue:${status}`,
  agentStats: (agentId: number, date: string) => `agent:${agentId}:stats:${date}`
} as const

// Cache TTLs (in seconds) - optimized for dialler use case
export const CACHE_TTL = {
  USER_CONTEXT: 900,      // 15 minutes - user data changes moderately
  USER_CLAIMS: 300,       // 5 minutes - claims can change frequently  
  ELIGIBLE_USERS: 300,    // 5 minutes - queue needs to be fresh
  USER_SCORE: 1800,       // 30 minutes - scores change less frequently
  STATIC_DATA: 3600,      // 1 hour - reference data
  SHORT_TERM: 60          // 1 minute - temporary data
} as const

// Simple in-memory cache service
class CacheService {
  private memoryCache = new Map<string, { data: any; expires: number }>()

  async get(key: string): Promise<any | null> {
    const cached = this.memoryCache.get(key)
    if (!cached) return null
    
    if (Date.now() > cached.expires) {
      this.memoryCache.delete(key)
      return null
    }
    
    return cached.data
  }

  async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    const expires = Date.now() + (ttlSeconds * 1000)
    this.memoryCache.set(key, { data: value, expires })
  }

  async del(key: string): Promise<void> {
    this.memoryCache.delete(key)
  }

  async delPattern(pattern: string): Promise<void> {
    // Simple pattern matching for memory cache
    for (const [key] of this.memoryCache) {
      if (key.includes(pattern.replace('*', ''))) {
        this.memoryCache.delete(key)
      }
    }
  }

  async exists(key: string): Promise<boolean> {
    const cached = this.memoryCache.get(key)
    return cached ? Date.now() <= cached.expires : false
  }

  async getStats(): Promise<{ redisConnected: boolean; memoryCacheSize: number }> {
    return {
      redisConnected: false,
      memoryCacheSize: this.memoryCache.size
    }
  }
}

// Export singleton cache service
export const cacheService = new CacheService() 
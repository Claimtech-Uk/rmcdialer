import { createClient } from 'redis'

// Redis client configuration
export const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        return new Error('Redis connection failed after 10 retries')
      }
      return Math.min(retries * 100, 3000)
    }
  }
})

// Handle Redis connection events
redis.on('error', (err) => {
  console.error('Redis Client Error:', err)
})

redis.on('connect', () => {
  console.log('Redis Client Connected')
})

redis.on('ready', () => {
  console.log('Redis Client Ready')
})

// Initialize Redis connection
let isRedisConnected = false

export const initRedis = async () => {
  if (!isRedisConnected) {
    try {
      await redis.connect()
      isRedisConnected = true
      console.log('✅ Redis connected successfully')
    } catch (error) {
      console.error('❌ Redis connection failed:', error)
      console.log('📝 Falling back to in-memory cache')
    }
  }
}

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

// Cache helper functions with fallback to in-memory
class CacheService {
  private memoryCache = new Map<string, { data: any; expires: number }>()

  async get(key: string): Promise<any | null> {
    try {
      if (isRedisConnected) {
        const result = await redis.get(key)
        return result ? JSON.parse(result) : null
      }
    } catch (error) {
      console.warn('Redis get failed, falling back to memory:', error)
    }

    // Fallback to memory cache
    const cached = this.memoryCache.get(key)
    if (!cached) return null
    
    if (Date.now() > cached.expires) {
      this.memoryCache.delete(key)
      return null
    }
    
    return cached.data
  }

  async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    try {
      if (isRedisConnected) {
        await redis.setEx(key, ttlSeconds, JSON.stringify(value))
        return
      }
    } catch (error) {
      console.warn('Redis set failed, falling back to memory:', error)
    }

    // Fallback to memory cache
    const expires = Date.now() + (ttlSeconds * 1000)
    this.memoryCache.set(key, { data: value, expires })
  }

  async del(key: string): Promise<void> {
    try {
      if (isRedisConnected) {
        await redis.del(key)
        return
      }
    } catch (error) {
      console.warn('Redis del failed, falling back to memory:', error)
    }

    // Fallback to memory cache
    this.memoryCache.delete(key)
  }

  async delPattern(pattern: string): Promise<void> {
    try {
      if (isRedisConnected) {
        const keys = await redis.keys(pattern)
        if (keys.length > 0) {
          await redis.del(keys)
        }
        return
      }
    } catch (error) {
      console.warn('Redis pattern delete failed, falling back to memory:', error)
    }

    // Fallback to memory cache - simple pattern matching
    for (const [key] of this.memoryCache) {
      if (key.includes(pattern.replace('*', ''))) {
        this.memoryCache.delete(key)
      }
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      if (isRedisConnected) {
        return (await redis.exists(key)) === 1
      }
    } catch (error) {
      console.warn('Redis exists failed, falling back to memory:', error)
    }

    // Fallback to memory cache
    const cached = this.memoryCache.get(key)
    return cached ? Date.now() <= cached.expires : false
  }

  async getStats(): Promise<{ redisConnected: boolean; memoryCacheSize: number }> {
    return {
      redisConnected: isRedisConnected,
      memoryCacheSize: this.memoryCache.size
    }
  }
}

// Export singleton cache service
export const cacheService = new CacheService()

// Initialize Redis on module load
initRedis().catch(console.error) 
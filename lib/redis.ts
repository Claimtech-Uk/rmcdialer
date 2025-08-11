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
  USER_CONTEXT: 900,
  USER_CLAIMS: 300,
  ELIGIBLE_USERS: 300,
  USER_SCORE: 1800,
  STATIC_DATA: 3600,
  SHORT_TERM: 60
} as const

interface ICacheService {
  get(key: string): Promise<any | null>
  set(key: string, value: any, ttlSeconds: number): Promise<void>
  del(key: string): Promise<void>
  delPattern(pattern: string): Promise<void>
  exists(key: string): Promise<boolean>
  getStats(): Promise<{ redisConnected: boolean; memoryCacheSize: number }>
}

// Memory cache fallback --------------------------------------------------------
class MemoryCacheService implements ICacheService {
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
    const expires = Date.now() + ttlSeconds * 1000
    this.memoryCache.set(key, { data: value, expires })
  }

  async del(key: string): Promise<void> {
    this.memoryCache.delete(key)
  }

  async delPattern(pattern: string): Promise<void> {
    const needle = pattern.includes('*') ? pattern.replace('*', '') : pattern
    for (const [key] of this.memoryCache) {
      if (needle === '' || key.includes(needle)) {
        this.memoryCache.delete(key)
      }
    }
  }

  async exists(key: string): Promise<boolean> {
    const cached = this.memoryCache.get(key)
    return cached ? Date.now() <= cached.expires : false
  }

  async getStats(): Promise<{ redisConnected: boolean; memoryCacheSize: number }> {
    return { redisConnected: false, memoryCacheSize: this.memoryCache.size }
  }
}

// Upstash Redis (serverless HTTP) ---------------------------------------------
type UpstashRedisClient = {
  get: (key: string) => Promise<any | null>
  set: (key: string, value: any, opts?: { ex?: number; px?: number }) => Promise<'OK' | null>
  del: (...keys: string[]) => Promise<number>
  exists: (key: string) => Promise<number>
  scan: (cursor: number, opts?: { match?: string; count?: number }) => Promise<[number, string[]]>
  ping: () => Promise<string>
}

class UpstashCacheService implements ICacheService {
  private redis: UpstashRedisClient
  private memoryCacheForStats = new Map<string, 1>()

  constructor(redis: UpstashRedisClient) {
    this.redis = redis
  }

  async get(key: string): Promise<any | null> {
    try {
      return await this.redis.get(key)
    } catch {
      return null
    }
  }

  async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, value, { ex: ttlSeconds })
    } catch {
      // best-effort, ignore
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key)
    } catch {
      // ignore
    }
  }

  async delPattern(pattern: string): Promise<void> {
    const match = pattern.includes('*') ? pattern : `${pattern}*`
    let cursor = 0
    try {
      do {
        const res = (await this.redis.scan(cursor, { match, count: 500 })) as any
        let nextCursor: number
        let keys: string[]
        if (Array.isArray(res)) {
          nextCursor = res[0]
          keys = res[1] ?? []
        } else {
          nextCursor = res?.cursor ?? 0
          keys = res?.keys ?? []
        }
        if (keys.length > 0) {
          await this.redis.del(...keys)
        }
        cursor = nextCursor
      } while (cursor !== 0)
    } catch {
      // ignore
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const n = await this.redis.exists(key)
      return n > 0
    } catch {
      return false
    }
  }

  async getStats(): Promise<{ redisConnected: boolean; memoryCacheSize: number }> {
    try {
      const pong = await this.redis.ping()
      return { redisConnected: pong === 'PONG', memoryCacheSize: this.memoryCacheForStats.size }
    } catch {
      return { redisConnected: false, memoryCacheSize: this.memoryCacheForStats.size }
    }
  }
}

// Factory: choose Upstash if configured, else memory
function createCacheService(): ICacheService {
  const hasUpstash = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  if (hasUpstash) {
    try {
      // Lazy import to avoid hard dependency at build time
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Redis } = require('@upstash/redis') as { Redis: new (cfg: { url: string; token: string }) => UpstashRedisClient }
      const client = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL as string,
        token: process.env.UPSTASH_REDIS_REST_TOKEN as string
      })
      // eslint-disable-next-line no-console
      console.log('🔗 Using Upstash Redis for cache')
      return new UpstashCacheService(client)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('⚠️ Failed to initialize Upstash Redis, falling back to in-memory cache', err)
      return new MemoryCacheService()
    }
  }
  // eslint-disable-next-line no-console
  console.log('📝 Using in-memory cache (Upstash not configured)')
  return new MemoryCacheService()
}

export const cacheService: ICacheService = createCacheService()
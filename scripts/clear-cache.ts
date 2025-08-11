async function clearAllCache() {
  console.log('🧹 Clearing all cache data...')

  // Prefer Upstash if configured
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Redis } = require('@upstash/redis') as {
        Redis: new (cfg: { url: string; token: string }) => any
      }
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN
      } as any)

      console.log('🔗 Connected to Upstash Redis')
      let cursor: number | string = 0
      let totalDeleted = 0
      do {
        const res = (await redis.scan(cursor, { match: '*', count: 1000 })) as any
        const nextCursor = Array.isArray(res) ? res[0] : res?.cursor ?? 0
        const keys: string[] = Array.isArray(res) ? res[1] ?? [] : res?.keys ?? []
        if (keys.length > 0) {
          totalDeleted += await redis.del(...keys)
        }
        cursor = nextCursor
      } while (cursor !== 0 && cursor !== '0')

      console.log(`🗑️ Upstash cache cleared, deleted ~${totalDeleted} keys`)
      console.log('✅ Cache cleanup completed!')
      return
    } catch (err) {
      console.warn('⚠️ Upstash clear failed, falling back to REDIS_URL if available', err)
    }
  }

  // Fallback: standard Redis via REDIS_URL (optional in dev)
  if (process.env.REDIS_URL) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { createClient } = require('redis') as { createClient: (opts: { url: string }) => any }
      const client = createClient({ url: process.env.REDIS_URL })
      client.on('error', (err: unknown) => console.error('Redis Client Error', err))
      await client.connect()
      console.log('🔗 Connected to Redis')

      // Use SCAN to iterate safely
      let cursor = '0'
      let totalDeleted = 0
      do {
        const [nextCursor, keys] = await client.scan(cursor, { MATCH: '*', COUNT: 1000 })
        if (keys.length > 0) {
          totalDeleted += await client.del(keys)
        }
        cursor = nextCursor
      } while (cursor !== '0')

      await client.disconnect()
      console.log(`🗑️ Redis cache cleared, deleted ~${totalDeleted} keys`)
      console.log('✅ Cache cleanup completed!')
      return
    } catch (error) {
      console.error('❌ Error clearing Redis cache:', error)
    }
  }

  console.log('📝 No remote cache configured (using in-memory fallback). Nothing to clear.')
}

// Run cache clear if this script is executed directly
if (require.main === module) {
  clearAllCache()
    .then(() => {
      console.log('🎉 Cache clear completed!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Cache clear failed:', error)
      process.exit(1)
    })
}

export { clearAllCache }
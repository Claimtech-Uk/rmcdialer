import { createClient } from 'redis';

async function clearAllCache() {
  console.log('🧹 Clearing all cache data...');

  try {
    // Check if Redis URL is configured
    if (!process.env.REDIS_URL) {
      console.log('📝 No Redis URL configured - cache is likely using in-memory fallback');
      console.log('✅ No Redis cache to clear');
      return;
    }

    // Connect to Redis
    const client = createClient({
      url: process.env.REDIS_URL
    });

    client.on('error', (err) => {
      console.error('Redis Client Error', err);
    });

    await client.connect();
    console.log('🔗 Connected to Redis');

    // Get all keys to see what's cached
    const keys = await client.keys('*');
    console.log(`📋 Found ${keys.length} cached keys`);

    if (keys.length > 0) {
      console.log('🔑 Sample keys:', keys.slice(0, 10));
      
      // Clear all cache
      await client.flushAll();
      console.log('🗑️ All cache cleared');
    } else {
      console.log('✨ Cache was already empty');
    }

    await client.disconnect();
    console.log('✅ Cache cleanup completed!');

  } catch (error) {
    console.error('❌ Error clearing cache:', error);
    
    // If Redis fails, it's likely using in-memory cache anyway
    console.log('💡 If Redis is not available, the app uses in-memory cache which will clear on restart');
  }
}

// Run cache clear if this script is executed directly
if (require.main === module) {
  clearAllCache()
    .then(() => {
      console.log('🎉 Cache clear completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Cache clear failed:', error);
      process.exit(1);
    });
}

export { clearAllCache }; 
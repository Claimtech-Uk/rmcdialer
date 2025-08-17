/**
 * Lightweight retry wrapper for database operations
 * Specifically designed for handling transient connection failures
 */

/**
 * Simple retry wrapper for database operations
 * Handles transient connection failures with exponential backoff
 * 
 * @param operation - The async operation to retry
 * @param operationName - Name for logging purposes
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns The result of the operation
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string = 'database operation',
  maxRetries: number = 3
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Check if this is a connection error worth retrying
      const errorMessage = error?.message?.toLowerCase() || '';
      const isConnectionError = 
        errorMessage.includes("can't reach database") ||
        errorMessage.includes('connection') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('econnrefused') ||
        errorMessage.includes('enotfound') ||
        errorMessage.includes('socket hang up') ||
        errorMessage.includes('econnreset');
      
      // Don't retry if it's not a connection error or we're out of retries
      if (!isConnectionError || attempt === maxRetries) {
        throw error;
      }
      
      // Calculate delay with exponential backoff (1s, 2s, 4s)
      const delay = Math.min(1000 * Math.pow(2, attempt), 4000);
      
      console.log(`⚠️ ${operationName} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`);
      console.log(`   Error: ${error.message}`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Test database connection with retry
 * Useful for warming up connections at the start of cron jobs
 */
export async function ensureConnection(prisma: any): Promise<void> {
  await withRetry(
    async () => {
      await prisma.$queryRaw`SELECT 1`;
    },
    'connection test',
    2
  );
}

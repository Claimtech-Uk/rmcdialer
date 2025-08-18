# Cron Job Database Resilience Guide

## Overview
This guide explains how to add retry logic to cron jobs to handle transient database connection failures (like the Neon pooler connection issues).

## Quick Fix

### 1. Import the retry utility
Add this import to your cron job:
```typescript
import { withRetry } from '@/lib/utils/db-retry';
```

### 2. Wrap database operations
Wrap any Prisma operation with `withRetry`:

```typescript
// Before
const data = await prisma.user.findMany();

// After
const data = await withRetry(
  () => prisma.user.findMany(),
  'fetch users'  // descriptive name for logging
);
```

## Complete Example

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withRetry } from '@/lib/utils/db-retry';

export async function GET(request: NextRequest) {
  try {
    // Wrap database operations with retry logic
    const users = await withRetry(
      () => prisma.user.findMany({
        where: { status: 'active' }
      }),
      'fetch active users'
    );

    // For multiple operations, wrap each one
    const stats = await withRetry(
      () => prisma.user.count(),
      'count users'
    );

    return NextResponse.json({ 
      success: true, 
      users, 
      stats 
    });
  } catch (error) {
    console.error('Cron job failed:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
```

## What This Does

- **Retries on connection failures**: Automatically retries up to 3 times
- **Exponential backoff**: Waits 1s, 2s, then 4s between retries
- **Smart error detection**: Only retries connection errors, not data errors
- **Logging**: Provides clear logs when retrying

## Connection Errors That Trigger Retry

- "Can't reach database"
- Connection timeout
- ECONNREFUSED
- ENOTFOUND
- Socket hang up
- ECONNRESET

## Files Already Updated

❌ `/api/cron/callback-notifications/route.ts` (REMOVED - callbacks now automatic)
✅ `/api/cron/session-cleanup/route.ts`

## Files That Need Updates

- [ ] `/api/cron/conversion-agent-attribution/route.ts`
- [ ] `/api/cron/daily-cleanup/route.ts`
- [ ] `/api/cron/scoring-maintenance/route.ts`
- [ ] `/api/cron/health/route.ts`
- [ ] Other cron jobs in `/api/cron/`

## Testing

To test if retry logic is working:
1. Check logs for retry messages when database is briefly unavailable
2. Look for patterns like: `⚠️ fetch users failed (attempt 1/4), retrying in 1000ms...`

## Advanced Usage

### Custom retry count
```typescript
await withRetry(
  () => prisma.user.findMany(),
  'fetch users',
  5  // Try up to 5 times instead of default 3
);
```

### Test connection at start
```typescript
import { ensureConnection } from '@/lib/utils/db-retry';

// At the start of your cron job
await ensureConnection(prisma);
```

## Why This Works

1. **Neon pooler issues are transient** - Usually recover within seconds
2. **Exponential backoff prevents overload** - Gradually increases wait time
3. **Selective retry** - Only retries connection issues, not business logic errors
4. **Simple to add** - Just wrap existing calls, no major refactoring needed

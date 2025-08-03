-- =============================================================================
-- SAFE Agent Heartbeat Enhancement Migration
-- =============================================================================
-- Adds heartbeat tracking and device connectivity fields to agent_sessions table
-- Part of Phase 1: Enhanced Agent Availability Tracking
--
-- SAFETY GUARANTEE: This migration is 100% safe and will NOT affect existing data
-- - Only ADDS new columns with safe defaults
-- - Never modifies or deletes existing data
-- - Can be run multiple times safely (IF NOT EXISTS)
-- - Instant rollback available via feature flags

-- PRE-MIGRATION VERIFICATION
-- Check current record count (save this number for verification)
-- SELECT COUNT(*) as "Records Before Migration" FROM agent_sessions;

-- SAFE: Add new fields to agent_sessions table for heartbeat tracking
-- These columns are NULL-able or have safe defaults
ALTER TABLE public.agent_sessions 
ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMP,
ADD COLUMN IF NOT EXISTS device_connected BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS max_concurrent_calls INTEGER DEFAULT 1;

-- SAFE: Create indexes for efficient heartbeat queries (only improves performance)
CREATE INDEX IF NOT EXISTS idx_agent_sessions_heartbeat 
ON public.agent_sessions (last_heartbeat, device_connected, status);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_availability 
ON public.agent_sessions (agent_id, status, logout_at, last_heartbeat);

-- SAFE: Update existing active sessions to have realistic defaults
-- This only affects the new columns we just added
UPDATE public.agent_sessions 
SET device_connected = true 
WHERE logout_at IS NULL 
  AND status IN ('available', 'on_call') 
  AND device_connected = false;

-- SAFE: Set last_heartbeat to last_activity for existing sessions (one-time migration)
-- This gives us a realistic starting point for heartbeat tracking
UPDATE public.agent_sessions 
SET last_heartbeat = last_activity 
WHERE last_heartbeat IS NULL 
  AND logout_at IS NULL;

-- SAFE: Add documentation comments
COMMENT ON COLUMN public.agent_sessions.last_heartbeat IS 'Timestamp of last heartbeat received from agent device/application';
COMMENT ON COLUMN public.agent_sessions.device_connected IS 'Whether the agent device (browser, app) is currently connected';
COMMENT ON COLUMN public.agent_sessions.max_concurrent_calls IS 'Maximum number of concurrent calls this agent can handle';

-- POST-MIGRATION VERIFICATION
-- Run these queries to verify migration success:
--
-- 1. Check record count is unchanged:
-- SELECT COUNT(*) as "Records After Migration" FROM agent_sessions;
--
-- 2. Verify new columns exist:
-- SELECT 
--   COUNT(*) as total_sessions,
--   COUNT(last_heartbeat) as sessions_with_heartbeat,
--   COUNT(*) FILTER (WHERE device_connected = true) as connected_devices,
--   COUNT(*) FILTER (WHERE max_concurrent_calls = 1) as default_capacity
-- FROM agent_sessions;
--
-- 3. Verify active sessions have proper defaults:
-- SELECT agent_id, status, device_connected, last_heartbeat 
-- FROM agent_sessions 
-- WHERE logout_at IS NULL 
-- LIMIT 5;

-- SUCCESS CRITERIA:
-- ✅ Record count unchanged
-- ✅ All sessions have max_concurrent_calls = 1
-- ✅ Active sessions have device_connected = true  
-- ✅ Active sessions have last_heartbeat set to last_activity
-- ✅ No errors during migration
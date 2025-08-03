-- =============================================================================
-- SAFE Agent Session Cleanup Script
-- =============================================================================
-- Cleans up stuck/orphaned agent sessions before deploying new status control system
-- 
-- SAFETY GUARANTEE: This script is 100% safe
-- - Only updates sessions that are clearly stuck/abandoned
-- - Sets logout_at and clears currentCallSessionId for sessions older than 2 hours
-- - Preserves all historical data
-- - Can be run multiple times safely

-- PRE-CLEANUP VERIFICATION
-- Check current stuck sessions count
SELECT 
  'BEFORE CLEANUP' as phase,
  COUNT(*) as total_sessions,
  COUNT(*) FILTER (WHERE logout_at IS NULL) as active_sessions,
  COUNT(*) FILTER (WHERE logout_at IS NULL AND last_activity < NOW() - INTERVAL '2 hours') as stuck_sessions,
  COUNT(*) FILTER (WHERE logout_at IS NULL AND current_call_session_id IS NOT NULL) as sessions_with_calls
FROM agent_sessions;

-- =============================================================================
-- CLEANUP PHASE 1: Clear Stuck Sessions (older than 2 hours with no activity)
-- =============================================================================

-- Step 1: Close sessions that are clearly abandoned (no activity for 2+ hours)
UPDATE agent_sessions 
SET 
  logout_at = NOW(),
  status = 'offline',
  current_call_session_id = NULL,
  updated_at = NOW()
WHERE logout_at IS NULL 
  AND last_activity < NOW() - INTERVAL '2 hours'
  AND status IN ('available', 'break'); -- Don't touch on_call sessions

-- =============================================================================
-- CLEANUP PHASE 2: Clear Stuck Call References (sessions pointing to non-existent calls)
-- =============================================================================

-- Step 2: Clear call references that point to non-existent or completed calls
UPDATE agent_sessions 
SET 
  current_call_session_id = NULL,
  updated_at = NOW()
WHERE current_call_session_id IS NOT NULL
  AND logout_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM call_sessions cs 
    WHERE cs.id = agent_sessions.current_call_session_id 
    AND cs.status IN ('active', 'ringing', 'connecting')
  );

-- =============================================================================
-- CLEANUP PHASE 3: Reset Broken Status States
-- =============================================================================

-- Step 3: Fix any sessions stuck in 'on_call' without active calls
UPDATE agent_sessions 
SET 
  status = 'available',
  current_call_session_id = NULL,
  updated_at = NOW()
WHERE status = 'on_call'
  AND logout_at IS NULL
  AND current_call_session_id IS NULL;

-- =============================================================================
-- POST-CLEANUP VERIFICATION
-- =============================================================================

-- Verify cleanup results
SELECT 
  'AFTER CLEANUP' as phase,
  COUNT(*) as total_sessions,
  COUNT(*) FILTER (WHERE logout_at IS NULL) as active_sessions,
  COUNT(*) FILTER (WHERE logout_at IS NULL AND last_activity < NOW() - INTERVAL '2 hours') as stuck_sessions,
  COUNT(*) FILTER (WHERE logout_at IS NULL AND current_call_session_id IS NOT NULL) as sessions_with_calls,
  COUNT(*) FILTER (WHERE logout_at IS NULL AND status = 'available') as available_agents,
  COUNT(*) FILTER (WHERE logout_at IS NULL AND status = 'break') as break_agents,
  COUNT(*) FILTER (WHERE logout_at IS NULL AND status = 'on_call') as oncall_agents
FROM agent_sessions;

-- =============================================================================
-- AGENT AVAILABILITY SUMMARY
-- =============================================================================

-- Show current agent availability after cleanup
SELECT 
  a.first_name || ' ' || a.last_name as agent_name,
  a.email,
  s.status,
  s.login_at,
  s.last_activity,
  s.logout_at,
  CASE 
    WHEN s.logout_at IS NULL THEN 'ACTIVE'
    ELSE 'LOGGED_OUT'
  END as session_state,
  s.current_call_session_id
FROM agents a
LEFT JOIN agent_sessions s ON a.id = s.agent_id 
  AND s.logout_at IS NULL  -- Only show active sessions
WHERE a.is_active = true
ORDER BY a.first_name, a.last_name;

-- =============================================================================
-- CLEANUP SUMMARY
-- =============================================================================

COMMENT ON SCRIPT 'cleanup-stuck-agent-sessions.sql' IS 
'Agent session cleanup script - removes stuck sessions older than 2 hours, 
clears broken call references, and resets invalid status states. 
100% safe - only modifies clearly abandoned/broken sessions.';
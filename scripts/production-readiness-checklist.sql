-- =============================================================================
-- PRODUCTION READINESS CHECKLIST & VERIFICATION
-- =============================================================================
-- Comprehensive script to verify and prepare the agent status control system
-- for production deployment

-- =============================================================================
-- STEP 1: PRE-DEPLOYMENT DATABASE STATE CHECK
-- =============================================================================

-- Check if new heartbeat columns exist
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'agent_sessions' 
  AND column_name IN ('last_heartbeat', 'device_connected', 'max_concurrent_calls')
ORDER BY column_name;

-- If the above returns empty, the heartbeat migration needs to be run

-- =============================================================================
-- STEP 2: CURRENT AGENT SESSIONS ANALYSIS
-- =============================================================================

-- Analyze current agent session states
SELECT 
  'CURRENT SESSION STATE ANALYSIS' as analysis_type,
  COUNT(*) as total_sessions,
  COUNT(*) FILTER (WHERE logout_at IS NULL) as active_sessions,
  COUNT(*) FILTER (WHERE logout_at IS NULL AND status = 'available') as available_sessions,
  COUNT(*) FILTER (WHERE logout_at IS NULL AND status = 'break') as break_sessions,
  COUNT(*) FILTER (WHERE logout_at IS NULL AND status = 'on_call') as oncall_sessions,
  COUNT(*) FILTER (WHERE logout_at IS NULL AND status = 'offline') as offline_but_active,
  COUNT(*) FILTER (WHERE logout_at IS NULL AND current_call_session_id IS NOT NULL) as sessions_with_calls,
  COUNT(*) FILTER (WHERE logout_at IS NULL AND last_activity < NOW() - INTERVAL '2 hours') as stale_sessions,
  COUNT(*) FILTER (WHERE logout_at IS NULL AND last_activity < NOW() - INTERVAL '30 minutes') as potentially_stuck
FROM agent_sessions;

-- =============================================================================
-- STEP 3: IDENTIFY PROBLEMATIC SESSIONS
-- =============================================================================

-- Show sessions that need cleanup
SELECT 
  'SESSIONS REQUIRING CLEANUP' as report_type,
  s.id,
  a.first_name || ' ' || a.last_name as agent_name,
  s.status,
  s.login_at,
  s.last_activity,
  s.current_call_session_id,
  EXTRACT(EPOCH FROM (NOW() - s.last_activity))/3600 as hours_since_activity,
  CASE 
    WHEN s.last_activity < NOW() - INTERVAL '2 hours' THEN 'STALE - NEEDS CLEANUP'
    WHEN s.current_call_session_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM call_sessions cs 
      WHERE cs.id = s.current_call_session_id 
      AND cs.status IN ('active', 'ringing', 'connecting')
    ) THEN 'BROKEN CALL REF - NEEDS CLEANUP'
    WHEN s.status = 'on_call' AND s.current_call_session_id IS NULL THEN 'INVALID STATE - NEEDS CLEANUP'
    ELSE 'OK'
  END as cleanup_reason
FROM agent_sessions s
JOIN agents a ON s.agent_id = a.id
WHERE s.logout_at IS NULL
  AND (
    s.last_activity < NOW() - INTERVAL '2 hours'
    OR (s.current_call_session_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM call_sessions cs 
      WHERE cs.id = s.current_call_session_id 
      AND cs.status IN ('active', 'ringing', 'connecting')
    ))
    OR (s.status = 'on_call' AND s.current_call_session_id IS NULL)
  )
ORDER BY s.last_activity ASC;

-- =============================================================================
-- STEP 4: VERIFY NEW STATUS CONTROL ENDPOINTS
-- =============================================================================

-- Check if session-cleanup cron endpoint exists (this is just documentation)
SELECT 'ENDPOINT VERIFICATION' as check_type,
       'app/api/cron/session-cleanup/route.ts should exist' as requirement,
       'Manual verification required' as status;

-- =============================================================================
-- STEP 5: AGENT READINESS FOR NEW SYSTEM
-- =============================================================================

-- Show active agents who will use the new system
SELECT 
  'AGENTS READY FOR NEW SYSTEM' as report_type,
  a.id,
  a.first_name || ' ' || a.last_name as agent_name,
  a.email,
  a.is_active,
  CASE 
    WHEN s.id IS NOT NULL THEN 'HAS ACTIVE SESSION'
    ELSE 'NO ACTIVE SESSION'
  END as current_session_status,
  s.status as current_status,
  s.last_activity
FROM agents a
LEFT JOIN agent_sessions s ON a.id = s.agent_id AND s.logout_at IS NULL
WHERE a.is_active = true
  AND a.role = 'agent'
ORDER BY a.first_name, a.last_name;

-- =============================================================================
-- STEP 6: PRODUCTION READINESS SUMMARY
-- =============================================================================

-- Final readiness check
WITH readiness_checks AS (
  SELECT 
    -- Check 1: Database schema ready
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'agent_sessions' 
        AND column_name = 'last_heartbeat'
    ) THEN 'PASS' ELSE 'FAIL' END as schema_ready,
    
    -- Check 2: No stuck sessions
    CASE WHEN (
      SELECT COUNT(*) FROM agent_sessions 
      WHERE logout_at IS NULL 
        AND last_activity < NOW() - INTERVAL '2 hours'
    ) = 0 THEN 'PASS' ELSE 'NEEDS_CLEANUP' END as sessions_clean,
    
    -- Check 3: No broken call references
    CASE WHEN (
      SELECT COUNT(*) FROM agent_sessions s
      WHERE s.logout_at IS NULL
        AND s.current_call_session_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM call_sessions cs 
          WHERE cs.id = s.current_call_session_id 
          AND cs.status IN ('active', 'ringing', 'connecting')
        )
    ) = 0 THEN 'PASS' ELSE 'NEEDS_CLEANUP' END as call_refs_clean,
    
    -- Check 4: Active agents exist
    CASE WHEN (
      SELECT COUNT(*) FROM agents WHERE is_active = true AND role = 'agent'
    ) > 0 THEN 'PASS' ELSE 'FAIL' END as agents_available
)
SELECT 
  'PRODUCTION READINESS SUMMARY' as report_type,
  schema_ready,
  sessions_clean,
  call_refs_clean,
  agents_available,
  CASE 
    WHEN schema_ready = 'PASS' 
      AND sessions_clean = 'PASS' 
      AND call_refs_clean = 'PASS' 
      AND agents_available = 'PASS' 
    THEN '🟢 READY FOR PRODUCTION'
    WHEN schema_ready = 'FAIL' 
    THEN '🔴 NEEDS DATABASE MIGRATION'
    WHEN sessions_clean = 'NEEDS_CLEANUP' OR call_refs_clean = 'NEEDS_CLEANUP'
    THEN '🟡 NEEDS SESSION CLEANUP'
    ELSE '🔴 NOT READY'
  END as overall_status
FROM readiness_checks;
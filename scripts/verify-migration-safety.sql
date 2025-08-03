-- =============================================================================
-- Migration Safety Verification Script
-- =============================================================================
-- Run this script BEFORE and AFTER migration to verify data safety

-- STEP 1: PRE-MIGRATION BASELINE
-- Run this before the migration to establish baseline
\echo '=== PRE-MIGRATION BASELINE ==='

SELECT 
    'agent_sessions' as table_name,
    COUNT(*) as total_records,
    MIN(login_at) as oldest_login,
    MAX(last_activity) as latest_activity,
    COUNT(DISTINCT agent_id) as unique_agents
FROM agent_sessions;

-- Check for any existing heartbeat columns (should be 0 if first time)
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'agent_sessions' 
  AND column_name IN ('last_heartbeat', 'device_connected', 'max_concurrent_calls');

-- Current agent session status distribution
SELECT 
    status,
    COUNT(*) as count,
    COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () as percentage
FROM agent_sessions 
WHERE logout_at IS NULL
GROUP BY status
ORDER BY count DESC;

\echo '=== SAVE THESE NUMBERS FOR COMPARISON ==='

-- =============================================================================

-- STEP 2: POST-MIGRATION VERIFICATION  
-- Run this after the migration to verify safety
\echo ''
\echo '=== POST-MIGRATION VERIFICATION ==='

-- Verify record count is unchanged
SELECT 
    'agent_sessions' as table_name,
    COUNT(*) as total_records_after,
    MIN(login_at) as oldest_login_after,
    MAX(last_activity) as latest_activity_after,
    COUNT(DISTINCT agent_id) as unique_agents_after
FROM agent_sessions;

-- Verify new columns were added correctly
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'agent_sessions' 
  AND column_name IN ('last_heartbeat', 'device_connected', 'max_concurrent_calls')
ORDER BY column_name;

-- Verify new columns have proper values
SELECT 
    COUNT(*) as total_sessions,
    COUNT(last_heartbeat) as sessions_with_heartbeat,
    COUNT(*) FILTER (WHERE device_connected = true) as connected_devices,
    COUNT(*) FILTER (WHERE device_connected = false) as disconnected_devices,
    COUNT(*) FILTER (WHERE max_concurrent_calls = 1) as default_capacity,
    AVG(max_concurrent_calls) as avg_capacity
FROM agent_sessions;

-- Verify active sessions have proper defaults
SELECT 
    status,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE device_connected = true) as connected,
    COUNT(*) FILTER (WHERE last_heartbeat IS NOT NULL) as with_heartbeat
FROM agent_sessions 
WHERE logout_at IS NULL
GROUP BY status;

-- Sample a few records to verify data integrity
\echo '=== SAMPLE RECORDS AFTER MIGRATION ==='
SELECT 
    agent_id,
    status,
    device_connected,
    max_concurrent_calls,
    last_activity,
    last_heartbeat,
    CASE 
        WHEN last_heartbeat = last_activity THEN 'CORRECT'
        WHEN last_heartbeat IS NULL AND logout_at IS NOT NULL THEN 'CORRECT (logged out)'
        ELSE 'CHECK_NEEDED'
    END as heartbeat_status
FROM agent_sessions 
ORDER BY last_activity DESC 
LIMIT 10;

-- Verify indexes were created
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'agent_sessions' 
  AND indexname LIKE '%heartbeat%' 
  OR indexname LIKE '%availability%';

\echo ''
\echo '=== MIGRATION SAFETY CHECKLIST ==='
\echo '[ ] Record count unchanged'
\echo '[ ] New columns exist with correct data types'
\echo '[ ] Active sessions have device_connected = true'
\echo '[ ] Active sessions have last_heartbeat = last_activity'
\echo '[ ] Logged out sessions have appropriate defaults'
\echo '[ ] New indexes created successfully'
\echo '[ ] No errors during verification'
\echo ''
\echo 'If all checkboxes pass: Migration is SAFE and SUCCESSFUL'
\echo 'If any checkbox fails: INVESTIGATE before proceeding'
-- =============================================================================
-- Extract List of Users with Incorrect Queue Assignments
-- =============================================================================
-- Gets detailed list of all users that were corrected during health check

-- Get all users that were updated during our health check runs (last 3 hours)
WITH recent_changes AS (
  SELECT 
    ucs.user_id,
    ucs.current_queue_type,
    ucs.current_score,
    ucs.is_active,
    ucs.last_queue_check,
    ucs.updated_at,
    ucs.created_at
  FROM user_call_scores ucs
  WHERE ucs.last_queue_check >= NOW() - INTERVAL '3 hours'
    OR ucs.updated_at >= NOW() - INTERVAL '3 hours'
),
summary_stats AS (
  SELECT 
    current_queue_type,
    COUNT(*) as user_count,
    MIN(last_queue_check) as first_update,
    MAX(last_queue_check) as last_update
  FROM recent_changes
  GROUP BY current_queue_type
)

-- Main detailed report
SELECT 
  '=== INCORRECT USERS CORRECTED DURING HEALTH CHECK ===' as report_section,
  '' as spacer1,
  'Total users corrected: ' || (SELECT COUNT(*) FROM recent_changes) as total_corrected,
  'Time range: ' || (SELECT MIN(last_queue_check)::text FROM recent_changes) || ' to ' || (SELECT MAX(last_queue_check)::text FROM recent_changes) as time_range,
  '' as spacer2

UNION ALL

-- Summary by queue type
SELECT 
  '=== CORRECTIONS BY QUEUE TYPE ===' as report_section,
  '' as spacer1,
  current_queue_type || ': ' || user_count || ' users' as total_corrected,
  'First: ' || first_update::text || ' | Last: ' || last_update::text as time_range,
  '' as spacer2
FROM summary_stats
ORDER BY user_count DESC;

-- Detailed user list (first 100 for manual review)
\echo ''
\echo '=== DETAILED USER LIST (First 100) ==='
\echo '====================================='

SELECT 
  rc.user_id as "User ID",
  rc.current_queue_type as "Corrected To",
  rc.current_score as "Score",
  rc.is_active as "Active",
  rc.last_queue_check as "Corrected At"
FROM recent_changes rc
ORDER BY rc.last_queue_check DESC
LIMIT 100;

-- Save complete list to CSV for detailed analysis
\copy (SELECT user_id, current_queue_type, current_score, is_active, last_queue_check FROM recent_changes ORDER BY last_queue_check DESC) TO 'incorrect_users_complete_list.csv' WITH CSV HEADER;

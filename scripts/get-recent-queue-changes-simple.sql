-- =============================================================================
-- Get Recent Queue Changes - User-Level Details
-- =============================================================================
-- Query to get specific user IDs that were changed in recent health checks

-- Get users who were updated in the last 2 hours (our recent health check runs)
SELECT 
    ucs.user_id as userId,
    ucs.current_queue_type as currentQueueType,
    ucs.current_score as currentScore,
    ucs.is_active as isActive,
    ucs.last_queue_check as lastUpdated,
    ucs.created_at as createdAt,
    ucs.updated_at as updatedAt
FROM user_call_scores ucs
WHERE ucs.last_queue_check >= NOW() - INTERVAL '2 hours'
ORDER BY ucs.last_queue_check DESC
LIMIT 500;

-- Summary by queue type for our changes
SELECT 
    current_queue_type,
    COUNT(*) as user_count,
    MIN(last_queue_check) as first_change,
    MAX(last_queue_check) as last_change
FROM user_call_scores 
WHERE last_queue_check >= NOW() - INTERVAL '2 hours'
GROUP BY current_queue_type
ORDER BY user_count DESC;

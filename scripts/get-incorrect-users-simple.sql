-- =============================================================================
-- Get List of Users Corrected During Health Check  
-- =============================================================================
-- Simple query to get all users that were updated during our health check

-- Summary of corrections by queue type
SELECT 
    COALESCE(current_queue_type, 'NULL') as queue_type,
    COUNT(*) as user_count,
    MIN(last_queue_check) as first_correction,
    MAX(last_queue_check) as last_correction
FROM user_call_scores 
WHERE last_queue_check >= NOW() - INTERVAL '4 hours'
GROUP BY current_queue_type
ORDER BY user_count DESC;

-- Detailed list of corrected users (first 200)
SELECT 
    user_id as "User ID",
    COALESCE(current_queue_type, 'NULL') as "Corrected To",
    current_score as "Score", 
    is_active as "Active",
    last_queue_check as "When Corrected"
FROM user_call_scores
WHERE last_queue_check >= NOW() - INTERVAL '4 hours'
ORDER BY last_queue_check DESC
LIMIT 200;

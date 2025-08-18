-- =============================================================================
-- Spot Check Specific Users - Detailed Validation
-- =============================================================================
-- Verify specific user IDs and their current state after health check

-- Replace these user IDs with the ones you want to spot check
\set user1 10890
\set user2 1159
\set user3 777
\set user4 1214
\set user5 1208

-- Detailed report for specific users (PostgreSQL side - user_call_scores)
SELECT 
    ucs.user_id as "User ID",
    ucs.current_queue_type as "Current Queue Type",
    ucs.current_score as "Score",
    ucs.is_active as "Active",
    ucs.last_queue_check as "Last Updated",
    ucs.created_at as "First Created"
FROM user_call_scores ucs
WHERE ucs.user_id IN (:user1, :user2, :user3, :user4, :user5)
ORDER BY ucs.user_id;

-- Show what these users look like in the actual unsigned_users_queue
SELECT 
    uuq.user_id as "User ID",
    uuq.priority_score as "Priority Score", 
    uuq.queue_position as "Queue Position",
    uuq.status as "Queue Status",
    uuq.created_at as "Added to Queue"
FROM unsigned_users_queue uuq
WHERE uuq.user_id IN (:user1, :user2, :user3, :user4, :user5)
ORDER BY uuq.queue_position;

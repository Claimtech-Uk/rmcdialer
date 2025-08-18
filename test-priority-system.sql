-- 🧪 Comprehensive Priority System Test
-- Verify that nextCallAfter delays are working correctly with the new priority system

-- 1. Check users with different nextCallAfter statuses
SELECT 
  'nextCallAfter Status' as test_type,
  CASE 
    WHEN next_call_after IS NULL THEN 'Immediately Available'
    WHEN next_call_after <= NOW() THEN 'Ready to Call'
    WHEN next_call_after > NOW() THEN 'Delayed'
  END as call_status,
  COUNT(*) as user_count,
  ROUND(AVG(current_score), 1) as avg_score
FROM user_call_scores 
WHERE current_queue_type = 'unsigned_users' 
  AND is_active = true
GROUP BY 
  CASE 
    WHEN next_call_after IS NULL THEN 'Immediately Available'
    WHEN next_call_after <= NOW() THEN 'Ready to Call'  
    WHEN next_call_after > NOW() THEN 'Delayed'
  END;

-- 2. Show delayed users and when they'll be available
SELECT 
  'Delayed Users Analysis' as test_type,
  user_id,
  current_score,
  last_outcome,
  next_call_after,
  ROUND(TIMESTAMPDIFF(HOUR, NOW(), next_call_after), 1) as hours_until_available,
  CASE 
    WHEN TIMESTAMPDIFF(HOUR, NOW(), next_call_after) <= 4 THEN 'Short delay (≤4h)'
    WHEN TIMESTAMPDIFF(HOUR, NOW(), next_call_after) <= 24 THEN 'Medium delay (≤24h)'
    WHEN TIMESTAMPDIFF(HOUR, NOW(), next_call_after) <= 72 THEN 'Long delay (≤72h)'
    ELSE 'Very long delay (>72h)'
  END as delay_category
FROM user_call_scores 
WHERE next_call_after > NOW()
  AND current_queue_type = 'unsigned_users'
  AND is_active = true
ORDER BY next_call_after
LIMIT 20;

-- 3. Verify queue eligibility for score 0 users (should ALL be eligible if weeks old)
SELECT 
  'Score 0 Eligibility Test' as test_type,
  user_id,
  current_score,
  current_queue_type,
  is_active,
  next_call_after,
  created_at,
  TIMESTAMPDIFF(DAY, created_at, NOW()) as days_old,
  CASE 
    WHEN current_queue_type = 'unsigned_users' 
         AND is_active = true 
         AND (next_call_after IS NULL OR next_call_after <= NOW())
         AND created_at <= DATE_SUB(NOW(), INTERVAL 2 HOUR)
    THEN 'SHOULD BE IN QUEUE'
    ELSE 'EXCLUDED FROM QUEUE'
  END as queue_eligibility
FROM user_call_scores 
WHERE current_score = 0
ORDER BY created_at DESC
LIMIT 10;

-- 4. Check actual queue contents vs expectations
SELECT 
  'Queue Contents vs Expectations' as test_type,
  ucs.user_id,
  ucs.current_score,
  uuq.queue_position,
  uuq.priority_score,
  uuq.status,
  CASE 
    WHEN uuq.user_id IS NOT NULL THEN 'IN QUEUE'
    ELSE 'MISSING FROM QUEUE'
  END as queue_status
FROM user_call_scores ucs
LEFT JOIN unsigned_users_queue uuq ON ucs.user_id = uuq.user_id
WHERE ucs.current_score = 0 
  AND ucs.current_queue_type = 'unsigned_users'
  AND ucs.is_active = true
  AND (ucs.next_call_after IS NULL OR ucs.next_call_after <= NOW())
ORDER BY ucs.created_at DESC
LIMIT 15;

-- 5. Show queue position vs score correlation (should be perfect match)
SELECT 
  'Queue Position Analysis' as test_type,
  queue_position,
  priority_score,
  COUNT(*) as users_at_position,
  MIN(priority_score) as min_score,
  MAX(priority_score) as max_score
FROM unsigned_users_queue 
WHERE status = 'pending'
GROUP BY queue_position, priority_score
ORDER BY queue_position
LIMIT 20;

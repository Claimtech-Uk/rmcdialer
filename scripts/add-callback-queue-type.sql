-- Migration: Add queueType to callbacks table for simplified callback system
-- This allows callbacks to be filtered by auto-dialler queue type

-- Add the queueType column with default value
ALTER TABLE callbacks 
ADD COLUMN queue_type VARCHAR(50) NOT NULL DEFAULT 'outstanding_requests';

-- Create index for efficient auto-dialler queries
CREATE INDEX idx_callbacks_due_by_queue 
ON callbacks(queue_type, scheduled_for, status);

-- Update existing callbacks to have appropriate queue types based on user's current queue
UPDATE callbacks 
SET queue_type = COALESCE(
  (SELECT current_queue_type 
   FROM user_call_scores 
   WHERE user_call_scores.user_id = callbacks.user_id), 
  'outstanding_requests'
)
WHERE queue_type = 'outstanding_requests'; -- Only update defaults

-- Verify the migration
SELECT 
  queue_type,
  COUNT(*) as callback_count,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count
FROM callbacks 
GROUP BY queue_type;

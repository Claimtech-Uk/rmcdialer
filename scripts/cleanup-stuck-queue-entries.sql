-- =============================================================================
-- Inbound Call Queue Cleanup Script
-- =============================================================================
-- This script cleans up stuck entries in the inbound_call_queue table that
-- have been active for too long without proper completion/abandonment.
--
-- CRITICAL: This fixes the queue backup where 50+ entries are stuck because
-- call completion wasn't properly updating queue status.
--
-- USE CAREFULLY: Review the WHERE clauses before running on production.
-- =============================================================================

-- Show current queue state before cleanup
SELECT 
  'BEFORE CLEANUP' as phase,
  COUNT(*) as total_entries,
  COUNT(CASE WHEN completed_at IS NULL AND abandoned_at IS NULL THEN 1 END) as active_entries,
  COUNT(CASE WHEN status = 'waiting' THEN 1 END) as waiting_entries,
  COUNT(CASE WHEN status = 'connecting' THEN 1 END) as connecting_entries,
  COUNT(CASE WHEN status = 'connected' THEN 1 END) as connected_entries,
  COUNT(CASE WHEN entered_queue_at < NOW() - INTERVAL '1 hour' THEN 1 END) as old_entries
FROM inbound_call_queue;

-- Mark ancient entries (older than 2 hours) as abandoned
-- These are clearly stuck and should have been processed long ago
UPDATE inbound_call_queue
SET
  status = 'abandoned',
  abandoned_at = NOW(),
  metadata = COALESCE(metadata, '{}')::jsonb || jsonb_build_object(
    'cleanupReason', 'stuck_entry_cleanup',
    'originalStatus', status,
    'hoursInQueue', EXTRACT(EPOCH FROM (NOW() - entered_queue_at))/3600,
    'cleanedAt', NOW()
  )
WHERE
  completed_at IS NULL
  AND abandoned_at IS NULL
  AND entered_queue_at < NOW() - INTERVAL '2 hours'
  AND status IN ('waiting', 'connecting', 'connected');

-- Mark entries that have been "connecting" for more than 15 minutes as abandoned
-- These agents likely didn't answer and the connection attempt failed
UPDATE inbound_call_queue
SET
  status = 'abandoned',
  abandoned_at = NOW(),
  metadata = COALESCE(metadata, '{}')::jsonb || jsonb_build_object(
    'cleanupReason', 'stuck_connecting_cleanup',
    'originalStatus', 'connecting',
    'minutesConnecting', EXTRACT(EPOCH FROM (NOW() - entered_queue_at))/60,
    'cleanedAt', NOW()
  )
WHERE
  completed_at IS NULL
  AND abandoned_at IS NULL
  AND status = 'connecting'
  AND entered_queue_at < NOW() - INTERVAL '15 minutes';

-- Show queue state after cleanup
SELECT 
  'AFTER CLEANUP' as phase,
  COUNT(*) as total_entries,
  COUNT(CASE WHEN completed_at IS NULL AND abandoned_at IS NULL THEN 1 END) as active_entries,
  COUNT(CASE WHEN status = 'waiting' THEN 1 END) as waiting_entries,
  COUNT(CASE WHEN status = 'connecting' THEN 1 END) as connecting_entries,
  COUNT(CASE WHEN status = 'connected' THEN 1 END) as connected_entries,
  COUNT(CASE WHEN status = 'abandoned' THEN 1 END) as abandoned_entries,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_entries
FROM inbound_call_queue;

-- Show summary of cleaned entries
SELECT 
  'CLEANUP SUMMARY' as report_type,
  metadata->>'cleanupReason' as cleanup_reason,
  metadata->>'originalStatus' as original_status,
  COUNT(*) as entries_cleaned,
  AVG((metadata->>'hoursInQueue')::float) as avg_hours_stuck,
  MIN(entered_queue_at) as oldest_entry,
  MAX(entered_queue_at) as newest_entry
FROM inbound_call_queue
WHERE metadata->>'cleanupReason' IS NOT NULL
GROUP BY metadata->>'cleanupReason', metadata->>'originalStatus'
ORDER BY entries_cleaned DESC;

-- Show remaining active entries (should be minimal)
SELECT 
  'REMAINING ACTIVE ENTRIES' as report_type,
  id,
  twilio_call_sid,
  caller_phone,
  status,
  entered_queue_at,
  EXTRACT(EPOCH FROM (NOW() - entered_queue_at))/60 as minutes_in_queue
FROM inbound_call_queue
WHERE completed_at IS NULL AND abandoned_at IS NULL
ORDER BY entered_queue_at ASC;

COMMENT ON TABLE inbound_call_queue IS 'Cleanup completed - entries now properly marked as abandoned when stuck. New webhook logic will prevent future buildups.';
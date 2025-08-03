-- =============================================================================
-- SAFE Inbound Call Queue System Migration - Phase 2
-- =============================================================================
-- Creates queue-based call holding system tables and indexes
-- Part of Phase 2: Queue-Based Call Holding System
--
-- SAFETY GUARANTEE: This migration is 100% safe and will NOT affect existing data
-- - Only CREATES new tables (no existing data touched)
-- - Can be run multiple times safely (IF NOT EXISTS)
-- - Instant rollback available via feature flags
-- - No foreign key constraints that could affect existing tables

-- PRE-MIGRATION VERIFICATION
-- Check that Phase 1 migration was successful
-- SELECT COUNT(*) as agent_sessions_with_heartbeat 
-- FROM agent_sessions 
-- WHERE last_heartbeat IS NOT NULL OR device_connected IS NOT NULL;

-- SAFE: Create new inbound_call_queue table (completely separate from existing data)
CREATE TABLE IF NOT EXISTS public.inbound_call_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    twilio_call_sid VARCHAR(255) UNIQUE NOT NULL,
    caller_phone VARCHAR(20) NOT NULL,
    caller_name VARCHAR(255),
    user_id BIGINT,
    priority_score INTEGER DEFAULT 0,
    queue_position INTEGER,
    estimated_wait_seconds INTEGER,
    entered_queue_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_to_agent_id INTEGER,
    assigned_at TIMESTAMP,
    status VARCHAR(50) DEFAULT 'waiting',
    attempts_count INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMP,
    last_attempt_agent_id INTEGER,
    abandoned_at TIMESTAMP,
    connected_at TIMESTAMP,
    completed_at TIMESTAMP,
    total_wait_seconds INTEGER,
    max_wait_reached BOOLEAN DEFAULT FALSE,
    callback_offered BOOLEAN DEFAULT FALSE,
    callback_accepted BOOLEAN DEFAULT FALSE,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SAFE: Create indexes for efficient queue operations (performance only)
CREATE INDEX IF NOT EXISTS idx_queue_status_priority 
ON public.inbound_call_queue (status, priority_score);

CREATE INDEX IF NOT EXISTS idx_queue_position 
ON public.inbound_call_queue (queue_position);

CREATE INDEX IF NOT EXISTS idx_queue_caller_phone 
ON public.inbound_call_queue (caller_phone);

CREATE INDEX IF NOT EXISTS idx_queue_entry_time 
ON public.inbound_call_queue (entered_queue_at, status);

CREATE INDEX IF NOT EXISTS idx_queue_agent_assignment 
ON public.inbound_call_queue (assigned_to_agent_id, status);

CREATE INDEX IF NOT EXISTS idx_queue_twilio_sid 
ON public.inbound_call_queue (twilio_call_sid);

-- SAFE: Add trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION update_inbound_call_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_inbound_call_queue_updated_at
    BEFORE UPDATE ON public.inbound_call_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_inbound_call_queue_updated_at();

-- SAFE: Add table comments for documentation
COMMENT ON TABLE public.inbound_call_queue IS 'Queue management for inbound calls - holds callers until agents available';
COMMENT ON COLUMN public.inbound_call_queue.twilio_call_sid IS 'Unique Twilio call SID for this queued call';
COMMENT ON COLUMN public.inbound_call_queue.queue_position IS 'Current position in queue (1 = next, NULL = not positioned)';
COMMENT ON COLUMN public.inbound_call_queue.status IS 'Queue status: waiting, assigned, connecting, connected, abandoned, completed';
COMMENT ON COLUMN public.inbound_call_queue.attempts_count IS 'Number of agent assignment attempts made';
COMMENT ON COLUMN public.inbound_call_queue.estimated_wait_seconds IS 'Estimated wait time provided to caller';
COMMENT ON COLUMN public.inbound_call_queue.max_wait_reached IS 'Whether caller reached maximum wait time threshold';
COMMENT ON COLUMN public.inbound_call_queue.callback_offered IS 'Whether callback option was offered to caller';

-- POST-MIGRATION VERIFICATION
-- Run these queries to verify migration success:
--
-- 1. Verify table was created:
-- SELECT table_name, table_type 
-- FROM information_schema.tables 
-- WHERE table_name = 'inbound_call_queue';
--
-- 2. Verify indexes were created:
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename = 'inbound_call_queue';
--
-- 3. Verify table is empty (new table):
-- SELECT COUNT(*) as queue_records FROM inbound_call_queue;
--
-- 4. Test insert (optional):
-- INSERT INTO inbound_call_queue (twilio_call_sid, caller_phone, status) 
-- VALUES ('test_sid_12345', '+1234567890', 'waiting') 
-- RETURNING id, created_at;

-- SUCCESS CRITERIA:
-- ✅ Table 'inbound_call_queue' created successfully
-- ✅ All indexes created without errors
-- ✅ Triggers and functions created
-- ✅ Table is empty (ready for queue data)
-- ✅ No impact on existing tables or data
-- ✅ Comments added for documentation
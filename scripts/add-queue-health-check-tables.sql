-- =============================================================================
-- Queue Health Check Tables Schema
-- =============================================================================
-- Following pattern from add-queue-system-tables.sql and add-queue-transition-audit.sql
-- Creates tables for storing queue health check results and historical analysis

-- Create table for queue health check results
CREATE TABLE IF NOT EXISTS queue_health_check_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Execution metadata
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    duration_ms INTEGER NOT NULL,
    success BOOLEAN NOT NULL DEFAULT FALSE,
    timeout_hit BOOLEAN DEFAULT FALSE,
    batches_processed INTEGER DEFAULT 0,
    
    -- Processing parameters
    batch_size INTEGER NOT NULL DEFAULT 200,
    start_offset INTEGER DEFAULT 0,
    max_users_limit INTEGER,
    dry_run BOOLEAN DEFAULT FALSE,
    
    -- Results summary
    total_checked INTEGER DEFAULT 0,
    total_updated INTEGER DEFAULT 0,
    correct_queue_count INTEGER DEFAULT 0,
    wrong_queue_count INTEGER DEFAULT 0,
    
    -- Queue distribution counts
    unsigned_users_count INTEGER DEFAULT 0,
    outstanding_requests_count INTEGER DEFAULT 0,
    no_queue_count INTEGER DEFAULT 0,
    
    -- Issue breakdown counts
    not_in_user_call_scores INTEGER DEFAULT 0,
    no_queue_type_assigned INTEGER DEFAULT 0,
    wrong_queue_type INTEGER DEFAULT 0,
    marked_inactive INTEGER DEFAULT 0,
    in_cooldown INTEGER DEFAULT 0,
    should_be_in_queue INTEGER DEFAULT 0,
    already_in_queue INTEGER DEFAULT 0,
    
    -- Raw result data (for detailed analysis)
    full_result JSONB,
    
    -- Summary message
    summary_message TEXT,
    
    -- Continuation info (if timeout)
    next_offset INTEGER,
    can_resume BOOLEAN DEFAULT FALSE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_queue_health_executed_at 
    ON queue_health_check_results(executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_queue_health_success 
    ON queue_health_check_results(success, executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_queue_health_timeout 
    ON queue_health_check_results(timeout_hit, executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_queue_health_can_resume 
    ON queue_health_check_results(can_resume, next_offset) 
    WHERE can_resume = TRUE;

CREATE INDEX IF NOT EXISTS idx_queue_health_dry_run
    ON queue_health_check_results(dry_run, executed_at DESC);

-- Add table comments for documentation
COMMENT ON TABLE queue_health_check_results IS 
    'Stores results of queue health checks for historical analysis and monitoring';

COMMENT ON COLUMN queue_health_check_results.full_result IS 
    'Complete JSON result for detailed analysis and debugging';

COMMENT ON COLUMN queue_health_check_results.can_resume IS 
    'Whether this execution can be resumed from next_offset due to timeout';

COMMENT ON COLUMN queue_health_check_results.timeout_hit IS 
    'Whether the execution hit the 25-second timeout limit';

COMMENT ON COLUMN queue_health_check_results.dry_run IS 
    'Whether this was a dry run (no actual queue updates performed)';

-- Optional: Create a view for easy summary queries
CREATE OR REPLACE VIEW queue_health_check_summary AS
SELECT 
    DATE_TRUNC('day', executed_at) as check_date,
    COUNT(*) as total_runs,
    COUNT(*) FILTER (WHERE success = true) as successful_runs,
    COUNT(*) FILTER (WHERE timeout_hit = true) as timeout_runs,
    COUNT(*) FILTER (WHERE dry_run = true) as dry_runs,
    AVG(duration_ms)::INTEGER as avg_duration_ms,
    SUM(total_checked) as total_users_checked,
    SUM(total_updated) as total_users_updated,
    CASE 
        WHEN SUM(total_checked) > 0 
        THEN ROUND((SUM(total_updated) * 100.0 / SUM(total_checked))::numeric, 2)
        ELSE 0 
    END as avg_update_percentage
FROM queue_health_check_results 
WHERE executed_at > NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', executed_at)
ORDER BY check_date DESC;

COMMENT ON VIEW queue_health_check_summary IS 
    'Daily summary of queue health check metrics for the last 30 days';

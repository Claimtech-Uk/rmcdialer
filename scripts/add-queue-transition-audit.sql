-- =============================================================================
-- Queue Transition Audit System
-- =============================================================================
-- Adds complete audit trail and safety net for queue transitions

-- 1. Create audit table for tracking all queue transitions
CREATE TABLE IF NOT EXISTS queue_transition_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL,
  from_queue TEXT,
  to_queue TEXT,
  reason TEXT NOT NULL,
  source TEXT NOT NULL,
  agent_id INTEGER,
  conversion_id UUID,
  conversion_logged BOOLEAN DEFAULT false,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Add indexes for performance
  CONSTRAINT valid_queue_types CHECK (
    from_queue IN ('unsigned_users', 'outstanding_requests') OR from_queue IS NULL
  ),
  CONSTRAINT valid_to_queue_types CHECK (
    to_queue IN ('unsigned_users', 'outstanding_requests') OR to_queue IS NULL
  )
);

-- 2. Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_queue_audit_user_id ON queue_transition_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_queue_audit_timestamp ON queue_transition_audit(timestamp);
CREATE INDEX IF NOT EXISTS idx_queue_audit_conversion ON queue_transition_audit(conversion_logged, timestamp);
CREATE INDEX IF NOT EXISTS idx_queue_audit_source ON queue_transition_audit(source, timestamp);
CREATE INDEX IF NOT EXISTS idx_queue_audit_leak_detection ON queue_transition_audit(user_id, timestamp, conversion_logged) 
  WHERE conversion_logged = false;

-- 3. Add trigger function to detect direct currentQueueType updates
CREATE OR REPLACE FUNCTION detect_queue_transitions()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger on currentQueueType changes
  IF OLD.current_queue_type IS DISTINCT FROM NEW.current_queue_type THEN
    
    -- Log the change for monitoring
    INSERT INTO queue_transition_audit (
      user_id, 
      from_queue, 
      to_queue, 
      reason, 
      source,
      conversion_logged,
      metadata
    ) VALUES (
      NEW.user_id,
      OLD.current_queue_type,
      NEW.current_queue_type,
      'Direct database update detected - POTENTIAL LEAK',
      'database_trigger',
      false,  -- Mark as potentially missed conversion
      jsonb_build_object(
        'detected_by', 'postgres_trigger',
        'old_queue', OLD.current_queue_type,
        'new_queue', NEW.current_queue_type,
        'alert_level', 'high'
      )
    );
    
    -- Also log to PostgreSQL logs for immediate alerting
    RAISE WARNING 'QUEUE TRANSITION DETECTED: User % changed from % to % via direct update', 
      NEW.user_id, OLD.current_queue_type, NEW.current_queue_type;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Apply trigger to user_call_scores table
DROP TRIGGER IF EXISTS queue_transition_detector ON user_call_scores;
CREATE TRIGGER queue_transition_detector
  AFTER UPDATE ON user_call_scores
  FOR EACH ROW
  EXECUTE FUNCTION detect_queue_transitions();

-- 5. Add helpful views for monitoring

-- View: Recent queue transitions
CREATE OR REPLACE VIEW recent_queue_transitions AS
SELECT 
  qta.user_id,
  qta.from_queue,
  qta.to_queue,
  qta.reason,
  qta.source,
  qta.agent_id,
  qta.conversion_logged,
  qta.timestamp,
  c.id as conversion_id,
  c.conversionType as conversion_type
FROM queue_transition_audit qta
LEFT JOIN conversions c ON c.id = qta.conversion_id
WHERE qta.timestamp > NOW() - INTERVAL '24 hours'
ORDER BY qta.timestamp DESC;

-- View: Potential conversion leaks
CREATE OR REPLACE VIEW potential_conversion_leaks AS
SELECT 
  qta.user_id,
  qta.from_queue,
  qta.to_queue,
  qta.timestamp,
  qta.source,
  qta.reason,
  u.current_signature_file_id,
  CASE 
    WHEN qta.from_queue = 'unsigned_users' 
         AND qta.to_queue IN ('outstanding_requests', NULL)
         AND u.current_signature_file_id IS NOT NULL
    THEN 'SIGNATURE_CONVERSION_MISSED'
    WHEN qta.from_queue = 'outstanding_requests' 
         AND qta.to_queue IS NULL
    THEN 'REQUIREMENTS_CONVERSION_MISSED'
    ELSE 'NO_LEAK'
  END as leak_type
FROM queue_transition_audit qta
LEFT JOIN users u ON u.id = qta.user_id
LEFT JOIN conversions c ON c.userId = qta.user_id 
  AND c.convertedAt BETWEEN qta.timestamp - INTERVAL '5 minutes' 
                          AND qta.timestamp + INTERVAL '5 minutes'
WHERE qta.timestamp > NOW() - INTERVAL '24 hours'
  AND qta.conversion_logged = false
  AND c.id IS NULL
  AND (
    (qta.from_queue = 'unsigned_users' AND qta.to_queue IN ('outstanding_requests', NULL))
    OR (qta.from_queue = 'outstanding_requests' AND qta.to_queue IS NULL)
  )
ORDER BY qta.timestamp DESC;

-- View: Conversion tracking health metrics
CREATE OR REPLACE VIEW conversion_tracking_health AS
SELECT 
  date_trunc('hour', qta.timestamp) as hour,
  COUNT(*) as total_transitions,
  COUNT(*) FILTER (WHERE qta.conversion_logged = true) as transitions_with_conversions,
  COUNT(*) FILTER (WHERE qta.source = 'database_trigger') as direct_updates,
  ROUND(
    (COUNT(*) FILTER (WHERE qta.conversion_logged = true)::numeric / 
     NULLIF(COUNT(*) FILTER (WHERE qta.from_queue IN ('unsigned_users', 'outstanding_requests')), 0)) * 100, 
    2
  ) as conversion_capture_rate
FROM queue_transition_audit qta
WHERE qta.timestamp > NOW() - INTERVAL '7 days'
GROUP BY date_trunc('hour', qta.timestamp)
ORDER BY hour DESC;

-- 6. Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT ON queue_transition_audit TO your_app_user;
-- GRANT SELECT ON recent_queue_transitions TO your_app_user;
-- GRANT SELECT ON potential_conversion_leaks TO your_app_user;
-- GRANT SELECT ON conversion_tracking_health TO your_app_user;

-- 7. Add comments for documentation
COMMENT ON TABLE queue_transition_audit IS 'Complete audit trail of all user queue transitions for conversion leak detection';
COMMENT ON COLUMN queue_transition_audit.source IS 'Source of the transition: call_completion, pre_call_validation, cleanup_cron, admin_action, etc.';
COMMENT ON COLUMN queue_transition_audit.conversion_logged IS 'Whether a conversion was logged for this transition';
COMMENT ON COLUMN queue_transition_audit.metadata IS 'Additional context about the transition (JSON)';

COMMENT ON VIEW potential_conversion_leaks IS 'Real-time view of queue transitions that may have missed conversion tracking';
COMMENT ON VIEW conversion_tracking_health IS 'Hourly metrics showing conversion tracking effectiveness';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Queue Transition Audit system installed successfully!';
  RAISE NOTICE 'Monitor potential leaks with: SELECT * FROM potential_conversion_leaks;';
  RAISE NOTICE 'Check system health with: SELECT * FROM conversion_tracking_health;';
END
$$;

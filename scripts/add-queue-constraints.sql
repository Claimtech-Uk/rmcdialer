-- Queue Separation Database Constraints
-- These constraints ensure data integrity and prevent users from being in multiple queues

-- ============================================================================
-- CONSTRAINT: User can only be in one queue at a time
-- ============================================================================

-- Function to validate queue integrity
CREATE OR REPLACE FUNCTION validate_queue_user_integrity() 
RETURNS TRIGGER AS $$
BEGIN
  -- Check if user is being added to unsigned queue
  IF TG_TABLE_NAME = 'unsigned_users_queue' THEN
    -- Prevent user from being in outstanding queue
    IF EXISTS (SELECT 1 FROM outstanding_requests_queue WHERE user_id = NEW.user_id AND status = 'pending') THEN
      RAISE EXCEPTION 'User % cannot be in both unsigned and outstanding queues simultaneously', NEW.user_id;
    END IF;
  END IF;
  
  -- Check if user is being added to outstanding queue  
  IF TG_TABLE_NAME = 'outstanding_requests_queue' THEN
    -- Prevent user from being in unsigned queue
    IF EXISTS (SELECT 1 FROM unsigned_users_queue WHERE user_id = NEW.user_id AND status = 'pending') THEN
      RAISE EXCEPTION 'User % cannot be in both unsigned and outstanding queues simultaneously', NEW.user_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to both queue tables
DROP TRIGGER IF EXISTS trigger_unsigned_queue_integrity ON unsigned_users_queue;
CREATE TRIGGER trigger_unsigned_queue_integrity
  BEFORE INSERT OR UPDATE ON unsigned_users_queue
  FOR EACH ROW EXECUTE FUNCTION validate_queue_user_integrity();

DROP TRIGGER IF EXISTS trigger_outstanding_queue_integrity ON outstanding_requests_queue;
CREATE TRIGGER trigger_outstanding_queue_integrity
  BEFORE INSERT OR UPDATE ON outstanding_requests_queue
  FOR EACH ROW EXECUTE FUNCTION validate_queue_user_integrity();

-- ============================================================================
-- CONSTRAINT: Validate priority scores are within reasonable bounds
-- ============================================================================

-- Function to validate priority scores
CREATE OR REPLACE FUNCTION validate_priority_score() 
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure priority score is within reasonable bounds (0-9999)
  IF NEW.priority_score < 0 OR NEW.priority_score > 9999 THEN
    RAISE EXCEPTION 'Priority score must be between 0 and 9999, got %', NEW.priority_score;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to both queue tables
DROP TRIGGER IF EXISTS trigger_unsigned_priority_validation ON unsigned_users_queue;
CREATE TRIGGER trigger_unsigned_priority_validation
  BEFORE INSERT OR UPDATE ON unsigned_users_queue
  FOR EACH ROW EXECUTE FUNCTION validate_priority_score();

DROP TRIGGER IF EXISTS trigger_outstanding_priority_validation ON outstanding_requests_queue;
CREATE TRIGGER trigger_outstanding_priority_validation
  BEFORE INSERT OR UPDATE ON outstanding_requests_queue
  FOR EACH ROW EXECUTE FUNCTION validate_priority_score();

-- ============================================================================
-- VIEWS: Helpful views for queue management and reporting
-- ============================================================================

-- View for queue health monitoring
CREATE OR REPLACE VIEW queue_health_summary AS
SELECT 
  'unsigned_users' as queue_type,
  COUNT(*) as total_entries,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE status = 'assigned') as assigned_count,
  COUNT(*) FILTER (WHERE urgent_signature = true) as urgent_count,
  AVG(priority_score) as avg_priority_score,
  MIN(created_at) as oldest_entry,
  MAX(created_at) as newest_entry
FROM unsigned_users_queue
UNION ALL
SELECT 
  'outstanding_requests' as queue_type,
  COUNT(*) as total_entries,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE status = 'assigned') as assigned_count,
  COUNT(*) FILTER (WHERE escalation_level > 0) as urgent_count,
  AVG(priority_score) as avg_priority_score,
  MIN(created_at) as oldest_entry,
  MAX(created_at) as newest_entry
FROM outstanding_requests_queue; 
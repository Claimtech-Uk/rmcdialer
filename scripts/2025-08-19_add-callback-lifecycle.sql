-- Callback lifecycle & creator tracking migration (safe, additive)
ALTER TABLE "callbacks"
  ADD COLUMN IF NOT EXISTS "assigned_to_agent_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "assigned_at" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "lease_expires_at" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "retry_count" INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "max_retries" INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "last_attempt_at" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "created_by_agent_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "created_by_source" TEXT DEFAULT 'agent';

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_callbacks_preferred_status_sched
  ON "callbacks" ("preferred_agent_id", "status", "scheduled_for");

CREATE INDEX IF NOT EXISTS idx_callbacks_assigned_status
  ON "callbacks" ("assigned_to_agent_id", "status");

CREATE INDEX IF NOT EXISTS idx_callbacks_user_status
  ON "callbacks" ("user_id", "status");



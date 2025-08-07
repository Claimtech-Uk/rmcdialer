-- Enhanced Agent Session Management Migration
-- This migration adds proper session lifecycle management to prevent duplicate sessions

-- Step 1: Add the new endedAt field for session termination tracking
ALTER TABLE agent_sessions 
ADD COLUMN ended_at TIMESTAMP;

-- Step 2: Create the AgentSessionStatus enum
CREATE TYPE "AgentSessionStatus" AS ENUM ('offline', 'available', 'on_call', 'break', 'ended');

-- Step 3: Add a temporary status column with the enum type
ALTER TABLE agent_sessions 
ADD COLUMN status_new "AgentSessionStatus" DEFAULT 'offline';

-- Step 4: Migrate existing status values to the enum
UPDATE agent_sessions 
SET status_new = CASE 
  WHEN status = 'offline' THEN 'offline'::"AgentSessionStatus"
  WHEN status = 'available' THEN 'available'::"AgentSessionStatus"
  WHEN status = 'on_call' THEN 'on_call'::"AgentSessionStatus"
  WHEN status = 'break' THEN 'break'::"AgentSessionStatus"
  ELSE 'offline'::"AgentSessionStatus"
END;

-- Step 5: Drop the old status column and rename the new one
ALTER TABLE agent_sessions DROP COLUMN status;
ALTER TABLE agent_sessions RENAME COLUMN status_new TO status;

-- Step 6: Create the unique constraint to prevent multiple active sessions per agent
-- This constraint allows only one session per agent where logoutAt is NULL (active session)
CREATE UNIQUE INDEX unique_active_agent_session 
ON agent_sessions (agent_id, logout_at) 
WHERE logout_at IS NULL;

-- Step 7: Add index for efficient cleanup queries
CREATE INDEX idx_agent_sessions_cleanup 
ON agent_sessions (status, ended_at);

-- Step 8: Update existing indexes if needed (these may already exist)
-- CREATE INDEX IF NOT EXISTS idx_agent_sessions_heartbeat 
-- ON agent_sessions (last_heartbeat, device_connected, status);

-- CREATE INDEX IF NOT EXISTS idx_agent_sessions_availability 
-- ON agent_sessions (agent_id, status, logout_at, last_heartbeat);
-- Fix agents table schema mismatch
-- Add missing columns that exist in Prisma schema but not in production database

-- Add created_by column (nullable, references agent who created this agent)
ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS created_by INTEGER NULL;

-- Add last_login_at column (nullable, tracks last login time)
ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP NULL;

-- Add updated_by column (nullable, references agent who last updated this agent)
ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS updated_by INTEGER NULL;

-- Add foreign key constraints (optional, but good for data integrity)
-- Note: These are commented out by default to avoid issues if there are orphaned records
-- Uncomment if you want to enforce referential integrity

-- ALTER TABLE agents 
-- ADD CONSTRAINT fk_agents_created_by 
-- FOREIGN KEY (created_by) REFERENCES agents(id) ON DELETE SET NULL;

-- ALTER TABLE agents 
-- ADD CONSTRAINT fk_agents_updated_by 
-- FOREIGN KEY (updated_by) REFERENCES agents(id) ON DELETE SET NULL;

-- Verify the columns were added
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM 
    information_schema.columns 
WHERE 
    table_name = 'agents' 
    AND column_name IN ('created_by', 'last_login_at', 'updated_by')
ORDER BY 
    column_name;
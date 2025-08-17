-- EMERGENCY ROLLBACK SCRIPT
-- Only use if migration causes issues

-- Option 1: Remove new columns (safest - keeps all data)
ALTER TABLE "sms_messages" 
DROP COLUMN IF EXISTS "processed",
DROP COLUMN IF EXISTS "processed_at",
DROP COLUMN IF EXISTS "phone_number",
DROP COLUMN IF EXISTS "user_id",
DROP COLUMN IF EXISTS "message_sid";

-- Remove indexes
DROP INDEX IF EXISTS "idx_phone_processed";
DROP INDEX IF EXISTS "idx_message_sid";

-- Option 2: Full restoration from backup (if columns removal fails)
-- CAUTION: This will lose any NEW messages since backup
/*
BEGIN;
  -- Rename current table
  ALTER TABLE public.sms_messages RENAME TO sms_messages_failed;
  
  -- Restore from backup
  CREATE TABLE public.sms_messages AS 
  SELECT * FROM backup_2025_08_16.sms_messages;
  
  -- Restore constraints and indexes
  ALTER TABLE public.sms_messages 
  ADD PRIMARY KEY (id);
  
  -- Verify restoration
  SELECT COUNT(*) FROM public.sms_messages;
  
  -- If all good, commit. Otherwise ROLLBACK;
COMMIT;
*/

-- Verification after rollback
SELECT 
    'Rollback completed. Current schema:' as status,
    COUNT(*) as total_columns
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'sms_messages';

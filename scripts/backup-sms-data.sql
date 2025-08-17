-- CRITICAL: Backup SMS data before migration
-- Run this to create backup tables

-- 1. Create backup schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS backup_2025_08_16;

-- 2. Create exact copy of sms_messages table
CREATE TABLE backup_2025_08_16.sms_messages AS 
SELECT * FROM public.sms_messages;

-- 3. Create exact copy of sms_conversations table
CREATE TABLE backup_2025_08_16.sms_conversations AS 
SELECT * FROM public.sms_conversations;

-- 4. Verify backup was successful
SELECT 
    'Original' as source,
    COUNT(*) as message_count 
FROM public.sms_messages
UNION ALL
SELECT 
    'Backup' as source,
    COUNT(*) as message_count 
FROM backup_2025_08_16.sms_messages;

-- 5. Create restoration script (save this!)
COMMENT ON SCHEMA backup_2025_08_16 IS 'SMS backup before check-before-send migration. Created: ' || NOW() || '. To restore: DROP TABLE public.sms_messages; CREATE TABLE public.sms_messages AS SELECT * FROM backup_2025_08_16.sms_messages;';

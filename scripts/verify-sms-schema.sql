-- Script to verify current SMS schema before migration
-- Run this in your database to check existing structure

-- 1. Check existing columns in sms_messages table
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'sms_messages'
ORDER BY ordinal_position;

-- 2. Count total messages (for backup verification)
SELECT 
    COUNT(*) as total_messages,
    COUNT(DISTINCT conversation_id) as total_conversations,
    MIN(created_at) as oldest_message,
    MAX(created_at) as newest_message
FROM sms_messages;

-- 3. Check for any existing processed columns (should return 0 rows)
SELECT column_name 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'sms_messages'
AND column_name IN ('processed', 'processed_at', 'phone_number', 'user_id', 'message_sid');

-- 4. Sample recent messages (last 10)
SELECT 
    id,
    conversation_id,
    direction,
    created_at,
    LENGTH(body) as message_length
FROM sms_messages
ORDER BY created_at DESC
LIMIT 10;

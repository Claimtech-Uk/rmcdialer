-- SMS Destination Number Migration
-- Adds destination_number field to track which Twilio number was contacted
-- Safe migration with backfill strategy

-- Step 1: Add the destination_number column (nullable for safety)
ALTER TABLE sms_messages 
ADD COLUMN destination_number VARCHAR(20) NULL;

-- Step 2: Create index for routing performance
CREATE INDEX CONCURRENTLY idx_sms_destination_number ON sms_messages(destination_number);

-- Step 3: Backfill existing records with intelligent defaults
-- Note: This is conservative - sets AI test number for auto responses, main number for manual
UPDATE sms_messages 
SET destination_number = CASE 
  WHEN message_type = 'auto_response' OR message_type = 'ai_agent' THEN '+447723495560'
  WHEN message_type = 'manual' OR message_type IS NULL THEN '+447488879172'
  ELSE '+447723495560' -- Safe default for unknown types
END
WHERE destination_number IS NULL;

-- Step 4: Verify migration results
SELECT 
  destination_number,
  message_type,
  direction,
  COUNT(*) as message_count
FROM sms_messages 
GROUP BY destination_number, message_type, direction
ORDER BY destination_number, message_type;

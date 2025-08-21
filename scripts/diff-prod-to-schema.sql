-- DropTable
DROP TABLE "queue_health_check_results";

-- CreateTable
CREATE TABLE "sms_batch_status" (
    "batch_id" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "processing_started" BOOLEAN NOT NULL DEFAULT false,
    "processing_started_at" TIMESTAMP(3),
    "processing_completed" BOOLEAN NOT NULL DEFAULT false,
    "processing_completed_at" TIMESTAMP(3),
    "response_text" TEXT,
    "response_sent" BOOLEAN NOT NULL DEFAULT false,
    "response_sent_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_batch_status_pkey" PRIMARY KEY ("batch_id")
);

-- CreateTable
CREATE TABLE "scheduled_sms" (
    "id" UUID NOT NULL,
    "user_id" BIGINT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "follow_up_type" TEXT NOT NULL,
    "message_type" TEXT NOT NULL,
    "template_key" TEXT,
    "message" TEXT,
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "processing_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "error_message" TEXT,
    "canceled_at" TIMESTAMP(3),
    "canceled_by_event" TEXT,
    "canceled_reason" TEXT,
    "origin" TEXT NOT NULL DEFAULT 'system',
    "created_by_agent_id" INTEGER,
    "dedup_key" TEXT,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_sms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sms_batch_status_phone_number_created_at_idx" ON "sms_batch_status"("phone_number", "created_at");

-- CreateIndex
CREATE INDEX "sms_batch_status_processing_started_created_at_idx" ON "sms_batch_status"("processing_started", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_sms_dedup_key_key" ON "scheduled_sms"("dedup_key");

-- CreateIndex
CREATE INDEX "scheduled_sms_status_scheduled_for_idx" ON "scheduled_sms"("status", "scheduled_for");

-- CreateIndex
CREATE INDEX "scheduled_sms_user_id_idx" ON "scheduled_sms"("user_id");

-- CreateIndex
CREATE INDEX "scheduled_sms_follow_up_type_idx" ON "scheduled_sms"("follow_up_type");

-- CreateIndex
CREATE INDEX "callbacks_preferred_agent_id_status_scheduled_for_idx" ON "callbacks"("preferred_agent_id", "status", "scheduled_for");

-- CreateIndex
CREATE INDEX "callbacks_assigned_to_agent_id_status_idx" ON "callbacks"("assigned_to_agent_id", "status");

-- CreateIndex
CREATE INDEX "callbacks_user_id_status_idx" ON "callbacks"("user_id", "status");

-- CreateIndex
CREATE INDEX "idx_batch_processing" ON "sms_messages"("batch_id", "batch_processed");

-- CreateIndex
CREATE INDEX "idx_destination_number" ON "sms_messages"("destination_number");

-- RenameIndex
ALTER INDEX "idx_callbacks_due_by_queue" RENAME TO "callbacks_queue_type_scheduled_for_status_idx";

-- RenameIndex
ALTER INDEX "idx_sms_messages_message_sid" RENAME TO "idx_message_sid";

-- RenameIndex
ALTER INDEX "idx_sms_messages_phone_processed" RENAME TO "idx_phone_processed";


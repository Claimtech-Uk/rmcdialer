#!/bin/bash

# DMS Replication Setup Script
# Creates DMS instance, endpoints, and replication tasks

set -e

echo "🔗 Setting up DMS Replication for CDC..."

# Load configuration
source .env 2>/dev/null || echo "⚠️  No .env file found, using environment variables"

# Required environment variables
: ${AWS_REGION:?❌ AWS_REGION is required}
: ${SQS_QUEUE_URL:?❌ SQS_QUEUE_URL is required}  
: ${REPLICA_DATABASE_URL:?❌ REPLICA_DATABASE_URL is required}

# Parse MySQL connection details from REPLICA_DATABASE_URL
if [[ $REPLICA_DATABASE_URL =~ mysql://([^:]+):([^@]+)@([^:]+):([0-9]+)/(.+) ]]; then
    DB_USERNAME="${BASH_REMATCH[1]}"
    DB_PASSWORD="${BASH_REMATCH[2]}"
    DB_HOSTNAME="${BASH_REMATCH[3]}"
    DB_PORT="${BASH_REMATCH[4]}"
    DB_NAME="${BASH_REMATCH[5]}"
else
    echo "❌ Could not parse REPLICA_DATABASE_URL"
    exit 1
fi

PROJECT_NAME="rmc-dialler"
ENVIRONMENT="${ENVIRONMENT:-production}"

echo "📍 Region: $AWS_REGION"
echo "🗄️  Database: $DB_HOSTNAME:$DB_PORT/$DB_NAME"
echo "📤 SQS Queue: $SQS_QUEUE_URL"

# 1. Create DMS Replication Instance
echo "🏗️  Creating DMS replication instance..."

REPLICATION_INSTANCE_ID="${PROJECT_NAME}-replication-${ENVIRONMENT}"

aws dms create-replication-instance \
  --replication-instance-identifier "$REPLICATION_INSTANCE_ID" \
  --replication-instance-class "dms.t3.micro" \
  --allocated-storage 20 \
  --no-publicly-accessible \
  --replication-subnet-group-identifier "$DMS_SUBNET_GROUP_NAME" \
  --region "$AWS_REGION" || echo "⚠️  Replication instance may already exist"

echo "⏳ Waiting for replication instance to be available..."
aws dms wait replication-instance-available \
  --replication-instance-identifier "$REPLICATION_INSTANCE_ID" \
  --region "$AWS_REGION"

echo "✅ Replication instance ready: $REPLICATION_INSTANCE_ID"

# 2. Create Source Endpoint (MySQL)
echo "🔌 Creating MySQL source endpoint..."

SOURCE_ENDPOINT_ID="${PROJECT_NAME}-mysql-source-${ENVIRONMENT}"

aws dms create-endpoint \
  --endpoint-identifier "$SOURCE_ENDPOINT_ID" \
  --endpoint-type source \
  --engine-name mysql \
  --server-name "$DB_HOSTNAME" \
  --port "$DB_PORT" \
  --database-name "$DB_NAME" \
  --username "$DB_USERNAME" \
  --password "$DB_PASSWORD" \
  --extra-connection-attributes "initstmt=SET foreign_key_checks=0" \
  --region "$AWS_REGION" || echo "⚠️  Source endpoint may already exist"

echo "✅ MySQL source endpoint created: $SOURCE_ENDPOINT_ID"

# 3. Create Target Endpoint (SQS)
echo "📤 Creating SQS target endpoint..."

TARGET_ENDPOINT_ID="${PROJECT_NAME}-sqs-target-${ENVIRONMENT}"

# Extract SQS queue name from URL
QUEUE_NAME=$(basename "$SQS_QUEUE_URL")

aws dms create-endpoint \
  --endpoint-identifier "$TARGET_ENDPOINT_ID" \
  --endpoint-type target \
  --engine-name kinesis \
  --kinesis-settings "StreamArn=$SQS_QUEUE_URL,MessageFormat=json,IncludeTransactionDetails=true,IncludePartitionDetails=true,PartitionIncludeSchemaTable=true,IncludeTableAlterOperations=true,IncludeControlDetails=true" \
  --region "$AWS_REGION" || echo "⚠️  Target endpoint may already exist"

echo "✅ SQS target endpoint created: $TARGET_ENDPOINT_ID"

# 4. Test Endpoints Connection
echo "🔍 Testing endpoint connections..."

echo "Testing MySQL source connection..."
aws dms test-connection \
  --replication-instance-arn "arn:aws:dms:$AWS_REGION:$(aws sts get-caller-identity --query Account --output text):replication-instance:$REPLICATION_INSTANCE_ID" \
  --endpoint-arn "arn:aws:dms:$AWS_REGION:$(aws sts get-caller-identity --query Account --output text):endpoint:$SOURCE_ENDPOINT_ID" \
  --region "$AWS_REGION"

echo "Testing SQS target connection..."
aws dms test-connection \
  --replication-instance-arn "arn:aws:dms:$AWS_REGION:$(aws sts get-caller-identity --query Account --output text):replication-instance:$REPLICATION_INSTANCE_ID" \
  --endpoint-arn "arn:aws:dms:$AWS_REGION:$(aws sts get-caller-identity --query Account --output text):endpoint:$TARGET_ENDPOINT_ID" \
  --region "$AWS_REGION"

# 5. Create Table Mappings Configuration
echo "📋 Creating table mappings for CDC..."

cat > /tmp/table-mappings.json << EOF
{
  "rules": [
    {
      "rule-type": "selection",
      "rule-id": "1",
      "rule-name": "select-users-table",
      "object-locator": {
        "schema-name": "$DB_NAME",
        "table-name": "users"
      },
      "rule-action": "include"
    },
    {
      "rule-type": "selection", 
      "rule-id": "2",
      "rule-name": "select-claims-table",
      "object-locator": {
        "schema-name": "$DB_NAME",
        "table-name": "claims"
      },
      "rule-action": "include"
    },
    {
      "rule-type": "selection",
      "rule-id": "3", 
      "rule-name": "select-claim-requirements-table",
      "object-locator": {
        "schema-name": "$DB_NAME",
        "table-name": "claim_requirements"
      },
      "rule-action": "include"
    },
    {
      "rule-type": "selection",
      "rule-id": "4",
      "rule-name": "select-user-addresses-table", 
      "object-locator": {
        "schema-name": "$DB_NAME",
        "table-name": "user_addresses"
      },
      "rule-action": "include"
    }
  ]
}
EOF

# 6. Create Replication Task
echo "🔄 Creating replication task..."

REPLICATION_TASK_ID="${PROJECT_NAME}-cdc-task-${ENVIRONMENT}"

aws dms create-replication-task \
  --replication-task-identifier "$REPLICATION_TASK_ID" \
  --source-endpoint-arn "arn:aws:dms:$AWS_REGION:$(aws sts get-caller-identity --query Account --output text):endpoint:$SOURCE_ENDPOINT_ID" \
  --target-endpoint-arn "arn:aws:dms:$AWS_REGION:$(aws sts get-caller-identity --query Account --output text):endpoint:$TARGET_ENDPOINT_ID" \
  --replication-instance-arn "arn:aws:dms:$AWS_REGION:$(aws sts get-caller-identity --query Account --output text):replication-instance:$REPLICATION_INSTANCE_ID" \
  --migration-type cdc \
  --table-mappings file:///tmp/table-mappings.json \
  --replication-task-settings '{
    "TargetMetadata": {
      "TargetSchema": "",
      "SupportLobs": true,
      "FullLobMode": false,
      "LobChunkSize": 64,
      "LimitedSizeLobMode": true,
      "LobMaxSize": 32,
      "LoadMaxFileSize": 0,
      "ParallelLoadThreads": 0,
      "ParallelLoadBufferSize": 0,
      "BatchApplyEnabled": false
    },
    "ChangeProcessingTuning": {
      "BatchApplyPreserveTransaction": true,
      "BatchApplyTimeoutMin": 1,
      "BatchApplyTimeoutMax": 30,
      "BatchApplyMemoryLimit": 500,
      "BatchSplitSize": 0,
      "MinTransactionSize": 1000,
      "CommitTimeout": 1,
      "MemoryLimitTotal": 1024,
      "MemoryKeepTime": 60,
      "StatementCacheSize": 50
    }
  }' \
  --region "$AWS_REGION" || echo "⚠️  Replication task may already exist"

echo "✅ Replication task created: $REPLICATION_TASK_ID"

# Clean up temp files
rm -f /tmp/table-mappings.json

echo ""
echo "🎯 DMS Setup Complete!"
echo "📋 Next steps:"
echo "   1. Start the replication task: aws dms start-replication-task --replication-task-arn <arn> --start-replication-task-type start-replication"
echo "   2. Monitor task status in AWS DMS console"
echo "   3. Test CDC by making changes to your main database"
echo ""
echo "📊 Monitor with:"
echo "   aws dms describe-replication-tasks --filters Name=replication-task-id,Values=$REPLICATION_TASK_ID --region $AWS_REGION" 
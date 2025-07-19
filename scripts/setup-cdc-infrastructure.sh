#!/bin/bash

# CDC Infrastructure Setup Script
# Run this to create AWS resources for Change Data Capture

set -e

echo "🚀 Setting up CDC Infrastructure for RMC Dialler..."

# Configuration variables
AWS_REGION="${AWS_REGION:-eu-west-1}"
PROJECT_NAME="rmc-dialler"
ENVIRONMENT="${ENVIRONMENT:-production}"

echo "📍 Region: $AWS_REGION"
echo "🏷️  Environment: $ENVIRONMENT"

# 1. Create SQS Queue for CDC Events
echo "📤 Creating SQS queue for CDC events..."

QUEUE_NAME="${PROJECT_NAME}-cdc-events-${ENVIRONMENT}"
DLQ_NAME="${PROJECT_NAME}-cdc-dlq-${ENVIRONMENT}"

# Create Dead Letter Queue first
aws sqs create-queue \
  --queue-name "$DLQ_NAME" \
  --region "$AWS_REGION" \
  --attributes '{
    "MessageRetentionPeriod": "1209600",
    "VisibilityTimeoutSeconds": "300"
  }'

DLQ_URL=$(aws sqs get-queue-url --queue-name "$DLQ_NAME" --region "$AWS_REGION" --query 'QueueUrl' --output text)
DLQ_ARN=$(aws sqs get-queue-attributes --queue-url "$DLQ_URL" --attribute-names QueueArn --region "$AWS_REGION" --query 'Attributes.QueueArn' --output text)

echo "✅ Dead Letter Queue created: $DLQ_ARN"

# Create main SQS queue with DLQ configuration
aws sqs create-queue \
  --queue-name "$QUEUE_NAME" \
  --region "$AWS_REGION" \
  --attributes "{
    \"MessageRetentionPeriod\": \"1209600\",
    \"VisibilityTimeoutSeconds\": \"300\",
    \"RedrivePolicy\": \"{\\\"deadLetterTargetArn\\\":\\\"$DLQ_ARN\\\",\\\"maxReceiveCount\\\":3}\"
  }"

QUEUE_URL=$(aws sqs get-queue-url --queue-name "$QUEUE_NAME" --region "$AWS_REGION" --query 'QueueUrl' --output text)
QUEUE_ARN=$(aws sqs get-queue-attributes --queue-url "$QUEUE_URL" --attribute-names QueueArn --region "$AWS_REGION" --query 'Attributes.QueueArn' --output text)

echo "✅ Main SQS Queue created: $QUEUE_ARN"

# 2. Create IAM Role for DMS
echo "🔐 Creating IAM role for DMS..."

DMS_ROLE_NAME="${PROJECT_NAME}-dms-role-${ENVIRONMENT}"

# Create trust policy for DMS
cat > /tmp/dms-trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "dms.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create permissions policy for DMS to access SQS
cat > /tmp/dms-permissions-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sqs:SendMessage",
        "sqs:GetQueueAttributes",
        "sqs:GetQueueUrl"
      ],
      "Resource": "$QUEUE_ARN"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "*"
    }
  ]
}
EOF

# Create IAM role
aws iam create-role \
  --role-name "$DMS_ROLE_NAME" \
  --assume-role-policy-document file:///tmp/dms-trust-policy.json \
  --region "$AWS_REGION"

# Attach custom policy
aws iam put-role-policy \
  --role-name "$DMS_ROLE_NAME" \
  --policy-name "${PROJECT_NAME}-dms-permissions" \
  --policy-document file:///tmp/dms-permissions-policy.json \
  --region "$AWS_REGION"

# Attach AWS managed policies
aws iam attach-role-policy \
  --role-name "$DMS_ROLE_NAME" \
  --policy-arn "arn:aws:iam::aws:policy/service-role/AmazonDMSVPCManagementRole"

echo "✅ IAM role created: $DMS_ROLE_NAME"

# 3. Create DMS Subnet Group (if needed)
echo "🌐 Creating DMS subnet group..."

# Get default VPC and subnets
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=is-default,Values=true" --region "$AWS_REGION" --query 'Vpcs[0].VpcId' --output text)
SUBNET_IDS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --region "$AWS_REGION" --query 'Subnets[].SubnetId' --output text)

SUBNET_GROUP_NAME="${PROJECT_NAME}-dms-subnet-group-${ENVIRONMENT}"

aws dms create-replication-subnet-group \
  --replication-subnet-group-identifier "$SUBNET_GROUP_NAME" \
  --replication-subnet-group-description "DMS subnet group for $PROJECT_NAME" \
  --subnet-ids $SUBNET_IDS \
  --region "$AWS_REGION" || echo "⚠️  Subnet group may already exist"

echo "✅ DMS subnet group configured: $SUBNET_GROUP_NAME"

# 4. Output environment variables for .env file
echo ""
echo "🎯 Add these to your .env file:"
echo "# CDC Configuration"
echo "AWS_REGION=$AWS_REGION"
echo "SQS_QUEUE_URL=$QUEUE_URL"
echo "SQS_DLQ_URL=$DLQ_URL"
echo "DMS_ROLE_ARN=arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):role/$DMS_ROLE_NAME"
echo "DMS_SUBNET_GROUP_NAME=$SUBNET_GROUP_NAME"

# Clean up temp files
rm -f /tmp/dms-trust-policy.json /tmp/dms-permissions-policy.json

echo ""
echo "✅ CDC Infrastructure setup complete!"
echo "📋 Next steps:"
echo "   1. Add environment variables to your .env file"
echo "   2. Run the DMS setup script (after updating .env)"
echo "   3. Test SQS queue access from your application" 
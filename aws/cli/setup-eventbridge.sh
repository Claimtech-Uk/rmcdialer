#!/bin/bash

# =============================================================================
# AWS EventBridge Setup Script - Alternative to CDK
# =============================================================================
# This script creates EventBridge rules and Lambda function for RMC Dialler cron jobs

set -e

echo "🚀 Setting up AWS EventBridge for RMC Dialler Cron Jobs"
echo "======================================================="

# Check AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ AWS CLI not configured. Run 'aws configure' first."
    exit 1
fi

# Get AWS account and region
AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region || echo "us-east-1")

echo "📍 Deploying to Account: $AWS_ACCOUNT, Region: $AWS_REGION"

# Create Lambda function for cron handling
echo "🔧 Creating Lambda function..."

# Create function code zip
cat > /tmp/cron-handler.js << 'EOF'
const https = require('https');
const { URL } = require('url');

exports.handler = async (event) => {
  const { path } = event;
  const baseUrl = process.env.AMPLIFY_URL;
  
  console.log(`🔄 [AWS-CRON] Executing: ${path}`);
  
  try {
    const result = await makeHttpRequest(baseUrl + path);
    console.log(`✅ [AWS-CRON] Completed: ${path}`, { 
      status: result.statusCode,
      duration: result.duration 
    });
    return result;
  } catch (error) {
    console.error(`❌ [AWS-CRON] Failed: ${path}`, error);
    throw error;
  }
};

function makeHttpRequest(url) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`,
        'User-Agent': 'AWS-EventBridge-Cron/1.0',
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const duration = Date.now() - startTime;
        resolve({ 
          statusCode: res.statusCode, 
          body: data,
          duration: duration + 'ms'
        });
      });
    });

    req.on('error', (error) => {
      const duration = Date.now() - startTime;
      reject({ error: error.message, duration: duration + 'ms' });
    });

    req.setTimeout(295000, () => {
      req.destroy();
      reject(new Error('Request timeout after 295 seconds'));
    });

    req.end();
  });
}
EOF

# Create deployment package
cd /tmp
zip -q cron-handler.zip cron-handler.js

# Create IAM role for Lambda
LAMBDA_ROLE_ARN=$(aws iam create-role \
  --role-name rmc-dialler-cron-lambda-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Service": "lambda.amazonaws.com"
        },
        "Action": "sts:AssumeRole"
      }
    ]
  }' \
  --query 'Role.Arn' --output text 2>/dev/null || \
  aws iam get-role --role-name rmc-dialler-cron-lambda-role --query 'Role.Arn' --output text)

# Attach basic execution policy
aws iam attach-role-policy \
  --role-name rmc-dialler-cron-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

echo "✅ IAM role created: $LAMBDA_ROLE_ARN"

# Wait for IAM propagation
echo "⏳ Waiting for IAM propagation (10 seconds)..."
sleep 10

# Create or update Lambda function
FUNCTION_ARN=$(aws lambda create-function \
  --function-name rmc-dialler-cron-handler \
  --runtime nodejs20.x \
  --role $LAMBDA_ROLE_ARN \
  --handler index.handler \
  --zip-file fileb://cron-handler.zip \
  --timeout 300 \
  --memory-size 512 \
  --environment Variables="{AMPLIFY_URL=$AMPLIFY_URL,CRON_SECRET=$CRON_SECRET,NODE_ENV=production}" \
  --query 'FunctionArn' --output text 2>/dev/null || \
  aws lambda update-function-code \
  --function-name rmc-dialler-cron-handler \
  --zip-file fileb://cron-handler.zip \
  --query 'FunctionArn' --output text)

echo "✅ Lambda function created: $FUNCTION_ARN"

# Create EventBridge rules for all cron jobs
echo "🔧 Creating EventBridge rules..."

declare -A cron_jobs=(
  ["queue-level-check"]="rate(5 minutes)"
  ["signature-conversion-cleanup"]="cron(0 * * * ? *)"
  ["smart-new-users-discovery"]="cron(5 * * * ? *)"
  ["outstanding-requirements-conversion-cleanup"]="cron(10 * * * ? *)"
  ["discover-new-requirements"]="cron(15 * * * ? *)"
  ["scoring-maintenance"]="cron(20 * * * ? *)"
  ["conversion-agent-attribution"]="cron(25 * * * ? *)"
  ["populate-separated-queues"]="cron(30 * * * ? *)"
  ["daily-cleanup"]="cron(0 2 * * ? *)"
  ["session-cleanup"]="rate(5 minutes)"
  ["heartbeat-cleanup"]="rate(1 minute)"
  ["queue-cleanup"]="rate(2 minutes)"
  ["sms-followups"]="rate(5 minutes)"
  ["process-sms-batches"]="rate(1 minute)"
  ["weekly-score-aging"]="cron(1 0 ? * SUN *)"
  ["process-transcriptions"]="rate(1 minute)"
)

for job_name in "${!cron_jobs[@]}"; do
  schedule="${cron_jobs[$job_name]}"
  rule_name="rmc-dialler-$job_name"
  
  echo "📅 Creating rule: $rule_name"
  
  # Create EventBridge rule
  aws events put-rule \
    --name "$rule_name" \
    --schedule-expression "$schedule" \
    --description "RMC Dialler cron job: /api/cron/$job_name" \
    --state ENABLED
  
  # Add Lambda target to rule
  aws events put-targets \
    --rule "$rule_name" \
    --targets "Id"="1","Arn"="$FUNCTION_ARN","Input"="{\"path\":\"/api/cron/$job_name\"}"
  
  # Grant EventBridge permission to invoke Lambda
  aws lambda add-permission \
    --function-name rmc-dialler-cron-handler \
    --statement-id "allow-eventbridge-$job_name" \
    --action lambda:InvokeFunction \
    --principal events.amazonaws.com \
    --source-arn "arn:aws:events:$AWS_REGION:$AWS_ACCOUNT:rule/$rule_name" \
    2>/dev/null || echo "Permission already exists"
  
  echo "✅ Rule created: $rule_name ($schedule)"
done

# Cleanup
rm -f /tmp/cron-handler.js /tmp/cron-handler.zip

echo ""
echo "🎉 AWS EventBridge setup complete!"
echo "================================================"
echo "✅ Lambda function: rmc-dialler-cron-handler"
echo "✅ EventBridge rules: ${#cron_jobs[@]} cron jobs migrated"
echo "📊 Monitor at: https://console.aws.amazon.com/lambda/home?region=$AWS_REGION#/functions/rmc-dialler-cron-handler"
echo "📅 Schedules at: https://console.aws.amazon.com/events/home?region=$AWS_REGION#/rules"
echo ""
echo "🔧 Next steps:"
echo "1. Set AMPLIFY_URL and CRON_SECRET environment variables"
echo "2. Test with: aws lambda invoke --function-name rmc-dialler-cron-handler --payload '{\"path\":\"/api/cron/queue-level-check\"}' /tmp/test-response.json"
echo "3. Check logs: aws logs tail /aws/lambda/rmc-dialler-cron-handler --follow"

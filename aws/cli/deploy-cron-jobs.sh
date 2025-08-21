#!/bin/bash

# =============================================================================
# Deploy RMC Dialler Cron Jobs to AWS EventBridge
# =============================================================================
# Choose your deployment method: CDK (recommended) or CLI

set -e

echo "🚀 RMC Dialler AWS EventBridge Deployment"
echo "========================================="

# Check required environment variables
if [ -z "$AMPLIFY_URL" ]; then
    echo "⚠️ AMPLIFY_URL not set. Please set your Amplify app URL:"
    echo "   export AMPLIFY_URL=https://your-amplify-domain.amplifyapp.com"
    exit 1
fi

if [ -z "$CRON_SECRET" ]; then
    echo "⚠️ CRON_SECRET not set. Please set your cron secret:"
    echo "   export CRON_SECRET=your-super-secure-cron-secret"
    exit 1
fi

echo "📍 Amplify URL: $AMPLIFY_URL"
echo "🔐 Cron secret: [HIDDEN]"

# Choose deployment method
echo ""
echo "Choose deployment method:"
echo "1) CDK (Recommended - Infrastructure as Code)"
echo "2) AWS CLI (Direct commands)"
echo "3) Manual (Instructions only)"

read -p "Enter choice (1-3): " -n 1 -r
echo

case $REPLY in
    1)
        echo "🔧 Deploying with AWS CDK..."
        cd aws/cdk
        
        # Install CDK dependencies if needed
        if [ ! -d "node_modules" ]; then
            echo "📦 Installing CDK dependencies..."
            npm install
        fi
        
        # Bootstrap CDK if needed
        if ! aws cloudformation describe-stacks --stack-name CDKToolkit > /dev/null 2>&1; then
            echo "🔄 Bootstrapping CDK..."
            npx cdk bootstrap
        fi
        
        # Deploy the stack
        echo "🚀 Deploying EventBridge rules..."
        npx cdk deploy --require-approval never
        
        echo "✅ CDK deployment completed!"
        ;;
        
    2)
        echo "🔧 Deploying with AWS CLI..."
        chmod +x aws/cli/setup-eventbridge.sh
        ./aws/cli/setup-eventbridge.sh
        ;;
        
    3)
        echo "📋 Manual setup instructions:"
        echo ""
        echo "1. Go to AWS Lambda Console"
        echo "2. Create function 'rmc-dialler-cron-handler' with Node.js 20.x"
        echo "3. Copy code from aws/cdk/cron-migration-stack.ts inline code"
        echo "4. Go to EventBridge Console"
        echo "5. Create rules for each cron job schedule"
        echo "6. Add Lambda targets to each rule"
        echo ""
        echo "💡 TIP: Use option 1 (CDK) for automated setup!"
        ;;
        
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "🎯 Testing cron job setup..."
echo "============================="

# Test one cron job
echo "📊 Testing queue-level-check endpoint..."
TEST_RESPONSE=$(curl -s -w "%{http_code}" -o /tmp/cron-test.json \
  -H "Authorization: Bearer $CRON_SECRET" \
  "$AMPLIFY_URL/api/cron/queue-level-check" || echo "000")

if [ "$TEST_RESPONSE" = "200" ]; then
    echo "✅ Cron endpoint test successful!"
    echo "📊 Response:"
    cat /tmp/cron-test.json | jq '.' 2>/dev/null || cat /tmp/cron-test.json
else
    echo "⚠️ Cron endpoint test failed (HTTP $TEST_RESPONSE)"
    echo "Check that CRON_SECRET matches your Amplify environment variables"
fi

# Cleanup
rm -f /tmp/cron-test.json /tmp/cron-handler.js /tmp/cron-handler.zip

echo ""
echo "🎉 EventBridge setup complete!"
echo "📊 Monitor: https://console.aws.amazon.com/lambda/home#/functions/rmc-dialler-cron-handler"
echo "📅 Rules: https://console.aws.amazon.com/events/home#/rules"

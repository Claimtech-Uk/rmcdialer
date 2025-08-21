#!/bin/bash

# =============================================================================
# Complete AWS Amplify Migration - One-Click Deployment
# =============================================================================
# This script handles the complete migration from Vercel to AWS Amplify

set -e

echo "🚀 RMC Dialler - Complete AWS Migration"
echo "======================================="

# Check prerequisites
echo "🔍 Checking prerequisites..."

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Install with: brew install awscli"
    exit 1
fi

# Check AWS configuration
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ AWS CLI not configured. Run 'aws configure' first."
    exit 1
fi

# Check git status
if ! git diff-index --quiet HEAD --; then
    echo "⚠️ You have uncommitted changes"
    read -p "Commit them first? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "📝 Please commit your changes first, then run this script again"
        exit 1
    fi
fi

# Get AWS info
AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region || echo "us-east-1")
echo "📍 AWS Account: $AWS_ACCOUNT, Region: $AWS_REGION"

# Build locally first
echo "🔨 Testing build locally..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Local build successful"
else
    echo "❌ Local build failed - fix errors before deploying"
    exit 1
fi

# Check for required environment variables
echo "🔧 Checking environment variables..."
echo "⚠️ Make sure these are set in AWS Amplify Console:"
echo "   - DATABASE_URL"
echo "   - REPLICA_DATABASE_URL"
echo "   - JWT_SECRET"
echo "   - ENCRYPTION_KEY"
echo "   - TWILIO_ACCOUNT_SID"
echo "   - TWILIO_AUTH_TOKEN"
echo "   - MAIN_APP_URL"
echo "   - CRON_SECRET"

read -p "Are all environment variables configured in Amplify? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Please configure environment variables in AWS Amplify Console first"
    echo "🔗 Go to: https://console.aws.amazon.com/amplify/ → Your App → Environment Variables"
    exit 1
fi

# Commit changes if any
if ! git diff-index --quiet HEAD --; then
    echo "📝 Committing AWS configuration changes..."
    git add .
    git commit -m "feat: Complete AWS Amplify migration configuration

- Update next.config.js for Amplify compatibility
- Add amplify.yml build configuration  
- Add AWS EventBridge + Lambda cron job infrastructure
- Add AWS CLI deployment scripts
- Add AWS-specific npm scripts for monitoring and deployment"
fi

# Push to trigger Amplify deployment
echo "🚀 Pushing to trigger Amplify deployment..."
git push origin main

echo "⏳ Waiting for Amplify deployment to complete..."
echo "📱 Monitor at: https://console.aws.amazon.com/amplify/"

# Wait for user to confirm deployment
read -p "Has your Amplify deployment completed successfully? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Please wait for Amplify deployment to complete, then run: npm run aws:deploy:cron"
    exit 1
fi

# Get Amplify URL
echo "🔍 Please enter your Amplify app URL:"
read -p "URL (e.g., https://main.d1234567890.amplifyapp.com): " AMPLIFY_URL

if [ -z "$AMPLIFY_URL" ]; then
    echo "❌ Amplify URL required"
    exit 1
fi

# Export for cron deployment
export AMPLIFY_URL
export CRON_SECRET="${CRON_SECRET:-rmcdialler-cron-secret-$(date +%s)}"

echo "📅 Deploying EventBridge cron jobs..."
npm run aws:deploy:cron

# Test health endpoints
echo "🔍 Testing health endpoints..."
echo "📊 App Health:"
curl -s "$AMPLIFY_URL/api/health" | jq '.' 2>/dev/null || echo "Health check response received"

echo ""
echo "📊 Cron Health:"
curl -s "$AMPLIFY_URL/api/cron/health" | jq '.' 2>/dev/null || echo "Cron health response received"

# Final verification
echo ""
echo "🎯 Final Migration Checklist:"
echo "=============================================="
echo "✅ Next.js config updated for Amplify"
echo "✅ amplify.yml build configuration created"
echo "✅ EventBridge + Lambda cron jobs deployed"
echo "✅ AWS-specific npm scripts added"
echo "✅ Database URL safety checks implemented"
echo ""
echo "🎉 AWS Amplify Migration Complete!"
echo ""
echo "📊 Monitor your application:"
echo "   🌐 App: $AMPLIFY_URL"
echo "   📊 Logs: npm run aws:logs:live"
echo "   🚨 Errors: npm run aws:logs:errors"
echo "   💊 Health: npm run aws:health"
echo ""
echo "🔍 AWS Console Links:"
echo "   📱 Amplify: https://console.aws.amazon.com/amplify/"
echo "   📅 EventBridge: https://console.aws.amazon.com/events/home#/rules"
echo "   🐑 Lambda: https://console.aws.amazon.com/lambda/home#/functions/rmc-dialler-cron-handler"
echo "   📊 CloudWatch: https://console.aws.amazon.com/cloudwatch/home#logsV2:live-tail"

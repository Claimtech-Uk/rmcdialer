#!/bin/bash

# RMC Dialler - Smart Deployment Script with Auto Queue Discovery
# Prevents multiple simultaneous deployments and triggers immediate queue population

set -e

echo "🚀 RMC Dialler Smart Deployment Script"
echo "======================================="

# Check if we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "⚠️  Warning: You're on branch '$CURRENT_BRANCH', not 'main'"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Deployment cancelled"
        exit 1
    fi
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  You have uncommitted changes"
    read -p "Commit them first? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "📝 Please commit your changes first, then run this script again"
        exit 1
    fi
fi

# Check for existing Vercel deployments
echo "🔍 Checking for existing deployments..."
DEPLOYMENTS=$(npx vercel ls 2>/dev/null || echo "")

if echo "$DEPLOYMENTS" | grep -q "Building\|Queued"; then
    echo "⚠️  There are active deployments running:"
    echo "$DEPLOYMENTS"
    read -p "Cancel them and proceed? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🛑 Cancelling active deployments..."
        # Note: Vercel doesn't have a direct cancel command, but new deployments auto-cancel old ones
    else
        echo "❌ Deployment cancelled - wait for current deployments to finish"
        exit 1
    fi
fi

# Ensure we're up to date with remote
echo "🔄 Syncing with remote..."
git fetch origin

if [ "$(git rev-parse HEAD)" != "$(git rev-parse @{u})" ]; then
    echo "⚠️  Your local branch is not up to date with origin/$CURRENT_BRANCH"
    read -p "Pull latest changes? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git pull origin $CURRENT_BRANCH
    else
        echo "❌ Deployment cancelled - please sync with remote first"
        exit 1
    fi
fi

# Build and test locally first
echo "🔨 Building locally to catch errors early..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Local build successful"
else
    echo "❌ Local build failed - fix errors before deploying"
    exit 1
fi

# Deploy to Vercel
echo "🚀 Deploying to Vercel..."
DEPLOYMENT_OUTPUT=$(npx vercel --prod 2>&1)
DEPLOYMENT_URL=$(echo "$DEPLOYMENT_OUTPUT" | grep -E 'https://.*\.vercel\.app' | tail -1 | tr -d ' ')

if [ $? -eq 0 ]; then
    echo "✅ Deployment completed successfully!"
    echo "🌐 Production URL: $DEPLOYMENT_URL"
    
    # Post-Deployment: Trigger Queue Discovery
    echo ""
    echo "🔄 Post-Deployment: Triggering Queue Discovery..."
    echo "================================================="
    
    # Wait a moment for deployment to be fully ready
    echo "⏳ Waiting 10 seconds for deployment to stabilize..."
    sleep 10
    
    # Trigger queue discovery
    echo "📊 Step 1: Triggering Queue Discovery..."
    DISCOVERY_RESPONSE=$(curl -s -X GET "${DEPLOYMENT_URL}/api/cron/discover-new-leads" || echo "ERROR")
    
    if echo "$DISCOVERY_RESPONSE" | grep -q '"success":true'; then
        echo "✅ Queue Discovery completed successfully!"
        echo "$DISCOVERY_RESPONSE" | jq -r '.report.summary // "Summary not available"' 2>/dev/null || echo "Raw response: $DISCOVERY_RESPONSE"
    else
        echo "⚠️  Queue Discovery response: $DISCOVERY_RESPONSE"
    fi
    
    # Wait a moment between requests
    sleep 3
    
    # Trigger scoring maintenance
    echo "📈 Step 2: Triggering Scoring Maintenance..."
    SCORING_RESPONSE=$(curl -s -X GET "${DEPLOYMENT_URL}/api/cron/scoring-maintenance" || echo "ERROR")
    
    if echo "$SCORING_RESPONSE" | grep -q '"success":true'; then
        echo "✅ Scoring Maintenance completed successfully!"
        echo "$SCORING_RESPONSE" | jq -r '.summary // "Summary not available"' 2>/dev/null || echo "Raw response: $SCORING_RESPONSE"
    else
        echo "⚠️  Scoring Maintenance response: $SCORING_RESPONSE"
    fi
    
    # Wait a moment and check system status
    sleep 3
    
    echo "🔍 Step 3: Checking System Status..."
    STATUS_RESPONSE=$(curl -s "${DEPLOYMENT_URL}/api/cron-status" || echo "ERROR")
    
    if echo "$STATUS_RESPONSE" | grep -q '"status"'; then
        echo "📊 System Status:"
        echo "$STATUS_RESPONSE" | jq '.' 2>/dev/null || echo "Raw response: $STATUS_RESPONSE"
    else
        echo "⚠️  Status check response: $STATUS_RESPONSE"
    fi
    
    echo ""
    echo "🎯 Quick Summary:"
    echo "   🌐 Production: $DEPLOYMENT_URL"
    echo "   📋 Queue Status: ${DEPLOYMENT_URL}/queue/unsigned"
    echo "   📊 Admin Panel: ${DEPLOYMENT_URL}/admin"
    echo "   🔍 Cron Status: ${DEPLOYMENT_URL}/api/cron-status"
    
else
    echo "❌ Deployment failed"
    echo "$DEPLOYMENT_OUTPUT"
    exit 1
fi

echo ""
echo "🎉 Deployment & Queue Discovery Complete!" 
echo "Your production database should now be populated with real users!"

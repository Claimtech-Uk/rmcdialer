#!/bin/bash

# RMC Dialler - Smart Deployment Script
# Prevents multiple simultaneous deployments

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
DEPLOYMENTS=$(npx vercel ls --limit 5 2>/dev/null || echo "")

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
npx vercel --prod

if [ $? -eq 0 ]; then
    echo "✅ Deployment completed successfully!"
    echo "🌐 Check: https://rmcdialer.vercel.app"
else
    echo "❌ Deployment failed"
    exit 1
fi

echo "🎉 All done!" 
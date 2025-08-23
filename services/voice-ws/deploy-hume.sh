#!/bin/bash

# Deploy Hume EVI to EC2
echo "🎭 Deploying Hume EVI Service..."

# Check if HUME_CONFIG_ID is set
if [ -z "$HUME_CONFIG_ID" ]; then
    echo "❌ Error: HUME_CONFIG_ID environment variable not set"
    echo "   Please run: export HUME_CONFIG_ID=your-actual-config-id"
    exit 1
fi

# Stop any existing voice services
echo "🛑 Stopping existing voice services..."
pkill -f "node server.js" 2>/dev/null || true
pkill -f "node hume-server.js" 2>/dev/null || true
pkill -f "node provider-selector.js" 2>/dev/null || true

# Update repository
echo "📦 Updating repository..."
git pull origin main

# Install/update dependencies
echo "📦 Installing dependencies..."
npm install

# Set environment variables for Hume
echo "🔧 Setting up Hume environment..."
export VOICE_PROVIDER=hume
export ENVIRONMENT_NAME=staging-development
export AI_VOICE_ALLOWED_ENVIRONMENTS=staging-development
export VOICE_MAX_CONCURRENT_STREAMS=2
export VOICE_STREAM_TOKEN=set-a-random-dev-token
export PORT=8080

# Display configuration
echo "✅ Environment configuration:"
echo "   HUME_CONFIG_ID: ${HUME_CONFIG_ID:0:20}..."
echo "   VOICE_PROVIDER: $VOICE_PROVIDER"
echo "   REPLICA_DATABASE_URL: ${REPLICA_DATABASE_URL:0:30}..."
echo "   PORT: $PORT"

# Test Hume service health
echo "🧪 Testing Hume service startup..."
timeout 10s npm run start:hume &
SERVICE_PID=$!
sleep 5

# Check if service started
if kill -0 $SERVICE_PID 2>/dev/null; then
    echo "✅ Hume service started successfully (PID: $SERVICE_PID)"
    kill $SERVICE_PID
    
    echo ""
    echo "🚀 Ready to start Hume EVI service:"
    echo "   npm run start:hume"
    echo ""
    echo "🧪 Test with:"
    echo "   curl http://localhost:8080/health"
    echo ""
else
    echo "❌ Hume service failed to start"
    echo "Check logs above for errors"
    exit 1
fi

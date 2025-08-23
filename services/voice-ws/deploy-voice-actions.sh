#!/bin/bash

# Deploy Voice Actions to EC2
# Run this script on your EC2 instance to update with the new voice actions system

echo "🚀 Deploying Voice Actions System to EC2..."

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "voice-actions" ]; then
    echo "❌ Error: Please run this script from the services/voice-ws directory"
    exit 1
fi

# Stop any running voice service
echo "🛑 Stopping existing voice service..."
pkill -f "node server.js" 2>/dev/null || true
pkill -f "node hume-server.js" 2>/dev/null || true
pkill -f "node provider-selector.js" 2>/dev/null || true

echo "📦 Installing new dependencies..."
npm install

# Check if Prisma client is available
if [ -f "../../../../prisma/generated/mysql-client/index.js" ]; then
    echo "✅ Prisma MySQL client found"
else 
    echo "❌ Error: Prisma MySQL client not found"
    echo "   Run 'npx prisma generate' in the project root to generate the client"
    exit 1
fi

# Verify voice-actions directory structure
echo "🔍 Verifying voice actions structure..."
REQUIRED_FILES=(
    "voice-actions/voice-action-registry.js"
    "voice-actions/services/voice-database.js"
    "voice-actions/services/voice-sms.js"
    "voice-actions/actions/schedule-callback.js"
    "voice-actions/actions/send-portal-link.js"
    "voice-actions/actions/check-user-details.js"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ Found: $file"
    else
        echo "❌ Missing: $file"
        exit 1
    fi
done

# Set required environment variables if not already set
echo "🔧 Checking environment variables..."

ENV_VARS=(
    "ENVIRONMENT_NAME"
    "AI_VOICE_ALLOWED_ENVIRONMENTS" 
    "VOICE_MAX_CONCURRENT_STREAMS"
    "VOICE_STREAM_TOKEN"
    "AI_VOICE_MODEL"
    "AI_VOICE_NAME"
)

for var in "${ENV_VARS[@]}"; do
    if [ -n "${!var}" ]; then
        echo "✅ $var is set"
    else
        echo "⚠️ Warning: $var is not set"
    fi
done

# Database connection check (Prisma Replica)
if [ -n "$REPLICA_DATABASE_URL" ]; then
    echo "✅ Replica database environment variable configured"
else
    echo "❌ Warning: REPLICA_DATABASE_URL missing"
    echo "   Required: REPLICA_DATABASE_URL (MySQL replica connection)"
fi

# Twilio SMS check
if [ -n "$TWILIO_ACCOUNT_SID" ] && [ -n "$TWILIO_AUTH_TOKEN" ]; then
    echo "✅ Twilio SMS environment variables configured"
else
    echo "❌ Warning: Twilio SMS environment variables missing" 
    echo "   Required: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER"
fi

# Test the voice action registry
echo "🧪 Testing voice action registry..."
node -e "
import { voiceActionRegistry } from './voice-actions/voice-action-registry.js';
console.log('✅ Voice action registry loaded successfully');
console.log('📋 Available actions:', voiceActionRegistry.listActions().map(a => a.name).join(', '));
" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ Voice action registry test passed"
else
    echo "❌ Voice action registry test failed"
    exit 1
fi

# Show deployment options
echo ""
echo "🎯 Deployment complete! Start options:"
echo ""
echo "Auto Provider Selection:"
echo "  export VOICE_PROVIDER=openai && npm run start:auto"
echo "  export VOICE_PROVIDER=hume && npm run start:auto"
echo ""
echo "Specific Providers:"  
echo "  npm run start:openai    # OpenAI Realtime API"
echo "  npm run start:hume      # Hume EVI"
echo "  npm start               # Default (OpenAI)"
echo ""
echo "🔧 Voice Actions Available:"
voiceActionCount=$(find voice-actions/actions -name "*.js" | wc -l)
echo "  - $voiceActionCount business actions configured"
echo "  - Real database operations"
echo "  - SMS confirmations via Twilio"
echo "  - Complete audit logging"
echo ""
echo "✅ Your voice AI now has full business capabilities!"

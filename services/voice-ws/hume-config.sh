#!/bin/bash

# Hume EVI Configuration Script
# Run this on your EC2 instance

echo "🎭 Setting up Hume EVI Configuration..."

# Set Hume Configuration ID
export HUME_CONFIG_ID=d5e403eb-9a95-4821-8b95-e1dd4702f0d5

# Set Voice Provider to Hume
export VOICE_PROVIDER=hume

# Set standard voice environment variables
export ENVIRONMENT_NAME=staging-development
export AI_VOICE_ALLOWED_ENVIRONMENTS=staging-development
export VOICE_MAX_CONCURRENT_STREAMS=2
export VOICE_STREAM_TOKEN=set-a-random-dev-token
export PORT=8080

# Display configuration
echo "✅ Hume EVI Configuration Set:"
echo "   HUME_CONFIG_ID: $HUME_CONFIG_ID"
echo "   VOICE_PROVIDER: $VOICE_PROVIDER"
echo "   ENVIRONMENT_NAME: $ENVIRONMENT_NAME"
echo "   PORT: $PORT"

# Check if required database URL is set
if [ -z "$REPLICA_DATABASE_URL" ]; then
    echo "⚠️  Warning: REPLICA_DATABASE_URL not set"
    echo "   Set with: export REPLICA_DATABASE_URL=your-mysql-connection"
fi

# Check if Twilio SMS variables are set
if [ -z "$TWILIO_ACCOUNT_SID" ] || [ -z "$TWILIO_AUTH_TOKEN" ]; then
    echo "⚠️  Warning: Twilio SMS variables not fully set"
    echo "   Required: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER"
fi

echo ""
echo "🚀 Ready to start Hume EVI service!"
echo "   Run: npm run start:hume"

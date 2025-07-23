#!/bin/bash

# Quick Queue Discovery Trigger - Test Without Full Deployment
# Run this to immediately populate queues with real users

set -e

echo "⚡ Quick Queue Discovery Trigger"
echo "================================"

# Get the production URL
PRODUCTION_URL="https://rmcdialer-45m0lwnlq-james-campbells-projects-6c4e4922.vercel.app"

echo "🎯 Targeting: $PRODUCTION_URL"
echo ""

# Step 1: Check current system status
echo "🔍 Step 1: Checking Current System Status..."
echo "============================================"
STATUS_RESPONSE=$(curl -s "${PRODUCTION_URL}/api/cron-status" || echo "ERROR")

if echo "$STATUS_RESPONSE" | grep -q '"queueUsers"'; then
    echo "📊 Current State:"
    echo "$STATUS_RESPONSE" | jq '{
        timestamp: .timestamp,
        queueUsers: .queueUsers,
        userScores: .userScores,
        gap: .gap,
        healthStatus: .healthStatus
    }' 2>/dev/null || echo "Raw: $STATUS_RESPONSE"
else
    echo "⚠️  Status Response: $STATUS_RESPONSE"
fi

echo ""

# Step 2: Trigger queue discovery
echo "📊 Step 2: Triggering Queue Discovery..."
echo "========================================"
echo "🔄 Discovering eligible users from MySQL replica (11,719 total users)..."

DISCOVERY_RESPONSE=$(curl -s -X GET "${PRODUCTION_URL}/api/cron/discover-new-leads" || echo "ERROR")

if echo "$DISCOVERY_RESPONSE" | grep -q '"success":true'; then
    echo "✅ Queue Discovery completed!"
    echo "📋 Results:"
    echo "$DISCOVERY_RESPONSE" | jq '.report // {summary: "No detailed report available"}' 2>/dev/null || echo "Raw: $DISCOVERY_RESPONSE"
else
    echo "❌ Queue Discovery failed:"
    echo "$DISCOVERY_RESPONSE"
fi

echo ""

# Step 3: Trigger scoring maintenance
echo "📈 Step 3: Triggering Scoring Maintenance..."
echo "==========================================="
echo "🔧 Creating user_call_scores for queue users (starting at 0)..."

SCORING_RESPONSE=$(curl -s -X GET "${PRODUCTION_URL}/api/cron/scoring-maintenance" || echo "ERROR")

if echo "$SCORING_RESPONSE" | grep -q '"success":true'; then
    echo "✅ Scoring Maintenance completed!"
    echo "📈 Results:"
    echo "$SCORING_RESPONSE" | jq '.maintenanceStats // {summary: "No detailed stats available"}' 2>/dev/null || echo "Raw: $SCORING_RESPONSE"
else
    echo "❌ Scoring Maintenance failed:"
    echo "$SCORING_RESPONSE"
fi

echo ""

# Step 4: Check final status
echo "🎯 Step 4: Final System Status..."
echo "================================="
sleep 3  # Wait for changes to settle

FINAL_STATUS=$(curl -s "${PRODUCTION_URL}/api/cron-status" || echo "ERROR")

if echo "$FINAL_STATUS" | grep -q '"queueUsers"'; then
    echo "📊 Updated State:"
    echo "$FINAL_STATUS" | jq '{
        timestamp: .timestamp,
        queueUsers: .queueUsers,
        userScores: .userScores,
        gap: .gap,
        healthStatus: .healthStatus,
        recommendations: .recommendations
    }' 2>/dev/null || echo "Raw: $FINAL_STATUS"
else
    echo "⚠️  Final Status Response: $FINAL_STATUS"
fi

echo ""
echo "🎉 Queue Discovery Trigger Complete!"
echo ""
echo "🔗 Quick Links:"
echo "   📋 Unsigned Queue: ${PRODUCTION_URL}/queue/unsigned"
echo "   📞 Requirements Queue: ${PRODUCTION_URL}/queue/requirements"
echo "   📊 Admin Panel: ${PRODUCTION_URL}/admin"
echo "   🔍 System Status: ${PRODUCTION_URL}/api/cron-status"
echo ""
echo "💡 Tip: If you see a gap between queueUsers and userScores,"
echo "    run this script again or wait for the next cron cycle."

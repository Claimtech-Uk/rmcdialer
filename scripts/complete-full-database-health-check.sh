#!/bin/bash
# =============================================================================
# Complete Full Database Queue Health Check
# =============================================================================
# Automated script to process the entire database in resumable batches

set -e

# Configuration
BASE_URL="https://dialer.solvosolutions.co.uk"
CRON_SECRET="test-secret"
BATCH_SIZE=200
SLEEP_BETWEEN_BATCHES=5  # 5 seconds between batches to be gentle on the system

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🏥 Full Database Queue Health Check${NC}"
echo "=================================="
echo "🎯 Target: All users in database"
echo "📦 Batch size: $BATCH_SIZE users"
echo "⏱️  Delay between batches: ${SLEEP_BETWEEN_BATCHES}s"
echo ""

# Track totals across all batches
TOTAL_CHECKED=1800  # We already processed 1800
TOTAL_UPDATED=262   # We already updated 262
TOTAL_UNSIGNED=465  # We already recovered 465 unsigned leads
CURRENT_OFFSET=1800 # Start from where we left off
BATCH_COUNT=3       # We've already done 2 full batches (counting the separate 1000-user test)

echo -e "${YELLOW}📊 Starting from offset $CURRENT_OFFSET (already processed $TOTAL_CHECKED users)${NC}"
echo ""

while true; do
    echo -e "${BLUE}🔍 Batch $BATCH_COUNT: Processing users $((CURRENT_OFFSET + 1))-$((CURRENT_OFFSET + BATCH_SIZE))...${NC}"
    
    # Make the API call
    RESPONSE=$(curl -s -H "Authorization: Bearer $CRON_SECRET" \
        "$BASE_URL/api/health/queue-check?offset=$CURRENT_OFFSET&batchSize=$BATCH_SIZE")
    
    # Parse the response
    SUCCESS=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['success'])" 2>/dev/null || echo "false")
    
    if [ "$SUCCESS" != "True" ]; then
        echo -e "${RED}❌ Batch $BATCH_COUNT failed. Response:${NC}"
        echo "$RESPONSE"
        break
    fi
    
    # Extract metrics
    CHECKED=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['stats']['checked'])")
    UPDATED=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['stats']['updated'])")
    UNSIGNED=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['stats']['queueDistribution']['unsigned_users'])")
    TIMEOUT_HIT=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['timeoutHit'])")
    PERCENTAGE=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['progress']['percentage'])")
    DURATION=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(round(data['duration']/1000, 1))")
    
    # Update running totals
    TOTAL_CHECKED=$((TOTAL_CHECKED + CHECKED))
    TOTAL_UPDATED=$((TOTAL_UPDATED + UPDATED))
    TOTAL_UNSIGNED=$((TOTAL_UNSIGNED + UNSIGNED))
    
    # Calculate update percentage for this batch
    if [ "$CHECKED" -gt 0 ]; then
        UPDATE_RATE=$(echo "scale=1; $UPDATED * 100 / $CHECKED" | bc -l)
    else
        UPDATE_RATE="0.0"
    fi
    
    echo -e "${GREEN}✅ Batch $BATCH_COUNT complete:${NC} $CHECKED checked, $UPDATED updated (${UPDATE_RATE}%), $UNSIGNED unsigned leads recovered"
    echo -e "   ⏱️  Duration: ${DURATION}s | 📈 Progress: ${PERCENTAGE}%"
    echo -e "${YELLOW}📊 Running totals: $TOTAL_CHECKED checked, $TOTAL_UPDATED updated, $TOTAL_UNSIGNED unsigned leads recovered${NC}"
    echo ""
    
    # Check if we're done
    if [ "$TIMEOUT_HIT" != "True" ]; then
        echo -e "${GREEN}🎉 FULL DATABASE PROCESSING COMPLETE!${NC}"
        echo "=================================="
        echo -e "${GREEN}✅ Final Results:${NC}"
        echo "   📊 Total users processed: $TOTAL_CHECKED"
        echo "   🔧 Total users updated: $TOTAL_UPDATED"
        echo "   🎯 Total unsigned leads recovered: $TOTAL_UNSIGNED"
        echo "   📈 Overall update rate: $(echo "scale=1; $TOTAL_UPDATED * 100 / $TOTAL_CHECKED" | bc -l)%"
        echo ""
        echo -e "${BLUE}🤖 Next: Your queue generation services will populate the actual queues within 1 hour${NC}"
        break
    fi
    
    # Get next offset
    NEXT_OFFSET=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['continuation']['nextOffset'])")
    CURRENT_OFFSET=$NEXT_OFFSET
    BATCH_COUNT=$((BATCH_COUNT + 1))
    
    # Sleep between batches to be gentle on the system
    echo "⏳ Waiting ${SLEEP_BETWEEN_BATCHES}s before next batch..."
    sleep $SLEEP_BETWEEN_BATCHES
done

echo ""
echo -e "${GREEN}🏁 Full database health check completed!${NC}"

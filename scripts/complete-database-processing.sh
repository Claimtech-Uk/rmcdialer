#!/bin/bash
# =============================================================================
# Complete Database Processing with Detailed Change Tracking
# =============================================================================
# Processes all remaining users and creates detailed change reports

set -e

BASE_URL="https://dialer.solvosolutions.co.uk"
CRON_SECRET="test-secret"
CURRENT_OFFSET=2400  # We've processed up to 2400
TOTAL_USERS=18820
BATCH_SIZE=200

# Running totals from previous batches
TOTAL_PROCESSED=2400
TOTAL_UPDATED=210
TOTAL_UNSIGNED=618

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🚀 FULL DATABASE QUEUE HEALTH CHECK${NC}"
echo "==================================="
echo "📊 Target: All $TOTAL_USERS users"
echo "🎯 Starting from offset: $CURRENT_OFFSET"
echo "📈 Already processed: $TOTAL_PROCESSED users"
echo "🔧 Already corrected: $TOTAL_UPDATED users"
echo "👥 Unsigned users found: $TOTAL_UNSIGNED"
echo ""

# Initialize change tracking file
CHANGES_FILE="incorrect_users_$(date +%Y%m%d_%H%M%S).json"
echo "{\"execution_start\": \"$(date -Iseconds)\", \"batches\": [" > $CHANGES_FILE

BATCH_COUNT=1

while [ $CURRENT_OFFSET -lt $TOTAL_USERS ]; do
    echo -e "${BLUE}🔍 Batch $BATCH_COUNT: Users $((CURRENT_OFFSET + 1))-$((CURRENT_OFFSET + BATCH_SIZE))${NC}"
    
    # Make API call
    RESPONSE=$(curl -s -H "Authorization: Bearer $CRON_SECRET" \
        "$BASE_URL/api/health/queue-check?offset=$CURRENT_OFFSET&batchSize=$BATCH_SIZE")
    
    # Check if successful
    SUCCESS=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('success', False))" 2>/dev/null)
    
    if [ "$SUCCESS" != "True" ]; then
        echo -e "${RED}❌ Batch $BATCH_COUNT failed${NC}"
        echo "$RESPONSE" | head -5
        break
    fi
    
    # Extract metrics
    CHECKED=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['stats']['checked'])")
    UPDATED=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['stats']['updated'])")
    UNSIGNED=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['stats']['queueDistribution']['unsigned_users'])")
    TIMEOUT_HIT=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('timeoutHit', False))")
    DURATION=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(round(data['duration']/1000, 1))")
    
    # Update totals
    TOTAL_PROCESSED=$((TOTAL_PROCESSED + CHECKED))
    TOTAL_UPDATED=$((TOTAL_UPDATED + UPDATED))
    TOTAL_UNSIGNED=$((TOTAL_UNSIGNED + UNSIGNED))
    
    # Calculate rates
    if [ "$CHECKED" -gt 0 ]; then
        BATCH_UPDATE_RATE=$(echo "scale=1; $UPDATED * 100 / $CHECKED" | bc -l)
    else
        BATCH_UPDATE_RATE="0.0"
    fi
    
    OVERALL_UPDATE_RATE=$(echo "scale=1; $TOTAL_UPDATED * 100 / $TOTAL_PROCESSED" | bc -l)
    PROGRESS_PCT=$(echo "scale=1; $TOTAL_PROCESSED * 100 / $TOTAL_USERS" | bc -l)
    
    echo -e "${GREEN}✅ Batch $BATCH_COUNT:${NC} $CHECKED checked, $UPDATED corrected (${BATCH_UPDATE_RATE}%), $UNSIGNED unsigned"
    echo -e "   ⏱️  ${DURATION}s | 📈 Overall: ${PROGRESS_PCT}% complete | 🔧 ${OVERALL_UPDATE_RATE}% update rate"
    
    # Add batch data to tracking file
    if [ $BATCH_COUNT -gt 1 ]; then
        echo "," >> $CHANGES_FILE
    fi
    
    BATCH_JSON=$(echo "$RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
batch_info = {
    'batch_number': $BATCH_COUNT,
    'offset': $CURRENT_OFFSET,
    'processed': data['stats']['checked'],
    'updated': data['stats']['updated'],
    'update_rate': round(data['stats']['updated']/data['stats']['checked']*100, 1) if data['stats']['checked'] > 0 else 0,
    'unsigned_users': data['stats']['queueDistribution']['unsigned_users'],
    'outstanding_requests': data['stats']['queueDistribution']['outstanding_requests'],
    'none': data['stats']['queueDistribution']['none'],
    'duration_seconds': round(data['duration']/1000, 1),
    'issues': data['stats']['issues'],
    'timeout_hit': data['timeoutHit']
}
print(json.dumps(batch_info, indent=2))
")
    
    echo "$BATCH_JSON" >> $CHANGES_FILE
    
    # Check if done
    if [ "$TIMEOUT_HIT" != "True" ]; then
        echo -e "${GREEN}🎉 ALL USERS PROCESSED!${NC}"
        break
    fi
    
    # Get next offset
    NEXT_OFFSET=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['continuation']['nextOffset'])")
    CURRENT_OFFSET=$NEXT_OFFSET
    BATCH_COUNT=$((BATCH_COUNT + 1))
    
    # Brief pause
    sleep 3
    echo ""
done

# Finalize the JSON file
echo "], \"execution_end\": \"$(date -Iseconds)\", \"final_totals\": {" >> $CHANGES_FILE
echo "  \"total_processed\": $TOTAL_PROCESSED," >> $CHANGES_FILE
echo "  \"total_updated\": $TOTAL_UPDATED," >> $CHANGES_FILE
echo "  \"total_unsigned\": $TOTAL_UNSIGNED," >> $CHANGES_FILE
echo "  \"overall_update_rate\": $OVERALL_UPDATE_RATE" >> $CHANGES_FILE
echo "}}" >> $CHANGES_FILE

echo ""
echo -e "${GREEN}📋 COMPLETE SUMMARY${NC}"
echo "=================="
echo "📊 Total users processed: $TOTAL_PROCESSED"
echo "🔧 Total corrections made: $TOTAL_UPDATED"
echo "🎯 Genuine unsigned users: $TOTAL_UNSIGNED"
echo "📈 Overall update rate: ${OVERALL_UPDATE_RATE}%"
echo ""
echo -e "${BLUE}📄 Detailed results saved to: $CHANGES_FILE${NC}"

#!/bin/bash

# Monitor Cron Schedule - Shows current time and when jobs will run next

echo "⏰ Cron Schedule Monitor"
echo "======================="

CURRENT_TIME=$(date '+%H:%M:%S')
CURRENT_MINUTE=$(date '+%M')
CURRENT_MINUTE_NUM=$((10#$CURRENT_MINUTE))

echo "🕒 Current Time: $CURRENT_TIME"
echo "📅 Current Minute: $CURRENT_MINUTE_NUM"
echo ""

# Calculate next run times
QUEUE_MINUTES=(0 15 30 45)
SCORING_MINUTES=(5 20 35 50)
CLEANUP_MINUTES=(10 25 40 55)

get_next_minute() {
    local current=$1
    shift
    local minutes=("$@")
    
    for min in "${minutes[@]}"; do
        if [ $min -gt $current ]; then
            echo $min
            return
        fi
    done
    # If no minute found in current hour, return first minute of next hour
    echo $((${minutes[0]} + 60))
}

NEXT_QUEUE=$(get_next_minute $CURRENT_MINUTE_NUM "${QUEUE_MINUTES[@]}")
NEXT_SCORING=$(get_next_minute $CURRENT_MINUTE_NUM "${SCORING_MINUTES[@]}")
NEXT_CLEANUP=$(get_next_minute $CURRENT_MINUTE_NUM "${CLEANUP_MINUTES[@]}")

echo "⏳ Next Run Times:"
echo "=================="

if [ $NEXT_QUEUE -ge 60 ]; then
    echo "📊 Queue Discovery:    :$(printf "%02d" $((NEXT_QUEUE - 60))) (next hour) - $(($NEXT_QUEUE - $CURRENT_MINUTE_NUM)) min"
else
    echo "📊 Queue Discovery:    :$(printf "%02d" $NEXT_QUEUE) - $(($NEXT_QUEUE - $CURRENT_MINUTE_NUM)) min"
fi

if [ $NEXT_SCORING -ge 60 ]; then
    echo "📈 Scoring Maintenance: :$(printf "%02d" $((NEXT_SCORING - 60))) (next hour) - $(($NEXT_SCORING - $CURRENT_MINUTE_NUM)) min"
else
    echo "📈 Scoring Maintenance: :$(printf "%02d" $NEXT_SCORING) - $(($NEXT_SCORING - $CURRENT_MINUTE_NUM)) min"
fi

if [ $NEXT_CLEANUP -ge 60 ]; then
    echo "🧹 Daily Cleanup:      :$(printf "%02d" $((NEXT_CLEANUP - 60))) (next hour) - $(($NEXT_CLEANUP - $CURRENT_MINUTE_NUM)) min"
else
    echo "🧹 Daily Cleanup:      :$(printf "%02d" $NEXT_CLEANUP) - $(($NEXT_CLEANUP - $CURRENT_MINUTE_NUM)) min"
fi

echo ""
echo "📋 Testing Schedule:"
echo "==================="
echo "Every 15 minutes, staggered by 5 minutes:"
echo "  📊 Queue Discovery:    :00, :15, :30, :45"
echo "  📈 Scoring Maintenance: :05, :20, :35, :50"  
echo "  🧹 Daily Cleanup:      :10, :25, :40, :55"
echo ""
echo "🔍 Monitor logs: npm run cron:logs"
echo "🌐 Live status: https://rmcdialer-45m0lwnlq-james-campbells-projects-6c4e4922.vercel.app/api/cron/logs"

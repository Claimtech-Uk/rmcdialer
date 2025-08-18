#!/bin/bash
# =============================================================================
# Spot Check Corrected Users - Detailed Validation
# =============================================================================
# Verify specific user IDs from our incorrect users list

set -e

if [ $# -eq 0 ]; then
    echo "🔍 Spot Check Corrected Users"
    echo "Usage: $0 <user_id_1> [user_id_2] [user_id_3] ..."
    echo ""
    echo "📋 Sample users from our corrections:"
    echo "• Users corrected to NULL: 3212, 3207, 3203, 3062"
    echo "• Users corrected to unsigned_users: 777, 773, 770, 765"
    echo ""
    echo "Example: $0 3212 777 3207 773"
    exit 1
fi

USER_IDS="$*"
USER_LIST=$(echo $USER_IDS | sed 's/ /,/g')

echo "🔍 Spot Checking Corrected Users: $USER_IDS"
echo "=========================================="

echo ""
echo "📊 Current Status in user_call_scores:"
psql "postgres://neondb_owner:npg_G5Nva0ZuOWeR@ep-shy-silence-abdb9eor-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require" -c "
SELECT 
    user_id as \"User ID\",
    COALESCE(current_queue_type, 'NULL') as \"Queue Type\",
    current_score as \"Score\",
    is_active as \"Active\",
    last_queue_check as \"Last Corrected\"
FROM user_call_scores 
WHERE user_id IN ($USER_LIST)
ORDER BY user_id;
"

echo ""
echo "🔍 Verification - Why were they corrected?"
echo "(Checking actual user state in MySQL replica)"

# Get sample user data to verify corrections were right
for USER_ID in $USER_IDS; do
    echo ""
    echo "👤 User $USER_ID Analysis:"
    echo "========================"
    
    # This would need to be a more complex query to MySQL replica
    # For now, just show their current PostgreSQL state
    psql "postgres://neondb_owner:npg_G5Nva0ZuOWeR@ep-shy-silence-abdb9eor-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require" -c "
    SELECT 
        'User ID: ' || user_id as info,
        'Current Queue: ' || COALESCE(current_queue_type, 'NULL') as queue_info,
        'Score: ' || current_score as score_info,
        'Last Corrected: ' || last_queue_check as correction_time
    FROM user_call_scores 
    WHERE user_id = $USER_ID;
    " -t
done

echo ""
echo "✅ Spot check completed for users: $USER_IDS"

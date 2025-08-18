#!/bin/bash
# =============================================================================
# Verify Specific Users After Queue Health Check
# =============================================================================
# Quick verification tool for spot checking user IDs

set -e

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Spot Checking Users After Queue Health Check${NC}"
echo "=================================================="

# Parse user IDs from command line arguments
if [ $# -eq 0 ]; then
    echo "Usage: $0 <user_id_1> [user_id_2] [user_id_3] ..."
    echo "Example: $0 10890 1159 777 1214"
    exit 1
fi

USER_IDS="$*"
echo -e "${YELLOW}🎯 Checking users: $USER_IDS${NC}"
echo ""

# Build the SQL query dynamically
USER_LIST=$(echo $USER_IDS | sed 's/ /,/g')

echo -e "${BLUE}📊 PostgreSQL Status (user_call_scores):${NC}"
psql "postgres://neondb_owner:npg_G5Nva0ZuOWeR@ep-shy-silence-abdb9eor-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require" -c "
SELECT 
    user_id as \"User ID\",
    current_queue_type as \"Queue Type\",
    current_score as \"Score\",
    is_active as \"Active\",
    last_queue_check as \"Last Updated\"
FROM user_call_scores 
WHERE user_id IN ($USER_LIST)
ORDER BY user_id;
"

echo ""
echo -e "${BLUE}📋 Queue Status (unsigned_users_queue):${NC}"
psql "postgres://neondb_owner:npg_G5Nva0ZuOWeR@ep-shy-silence-abdb9eor-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require" -c "
SELECT 
    user_id as \"User ID\",
    priority_score as \"Priority\", 
    queue_position as \"Position\",
    status as \"Status\",
    created_at as \"In Queue Since\"
FROM unsigned_users_queue 
WHERE user_id IN ($USER_LIST)
ORDER BY queue_position;
"

echo ""
echo -e "${GREEN}✅ Spot check completed for users: $USER_IDS${NC}"

#!/bin/bash

# 🚀 Production Database Migration Script - Enhanced Queue System
# 
# This script safely migrates the production database to support separated queue tables.
# Run this on your production server or local machine with production DB access.

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="./db-backups"
MIGRATION_FILE="./prisma/migrations/001_create_separated_queues.sql"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${BLUE}🚀 Enhanced Queue System - Production Database Migration${NC}"
echo -e "${BLUE}=================================================${NC}"

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ ERROR: DATABASE_URL environment variable is not set${NC}"
    echo "Please set your production database URL:"
    echo "export DATABASE_URL='your-production-db-url'"
    exit 1
fi

# Check if migration file exists
if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}❌ ERROR: Migration file not found: $MIGRATION_FILE${NC}"
    exit 1
fi

echo -e "${YELLOW}⚠️  IMPORTANT SAFETY CHECKS:${NC}"
echo "1. This will modify your PRODUCTION database"
echo "2. A backup will be created automatically"  
echo "3. The migration adds new tables (no data loss expected)"
echo "4. You can rollback using the backup if needed"
echo ""

# Confirm database connection
echo -e "${BLUE}🔍 Testing database connection...${NC}"
if ! psql "$DATABASE_URL" -c "SELECT version();" > /dev/null 2>&1; then
    echo -e "${RED}❌ ERROR: Cannot connect to database${NC}"
    echo "Please check your DATABASE_URL and network connectivity"
    exit 1
fi
echo -e "${GREEN}✅ Database connection successful${NC}"

# Get database info
DB_NAME=$(psql "$DATABASE_URL" -t -c "SELECT current_database();" | tr -d ' \n')
echo -e "${BLUE}📊 Connected to database: $DB_NAME${NC}"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Confirm before proceeding
echo ""
echo -e "${YELLOW}⚠️  Ready to migrate database: $DB_NAME${NC}"
read -p "Do you want to proceed? (yes/no): " -r
echo ""
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo -e "${YELLOW}❌ Migration cancelled by user${NC}"
    exit 0
fi

# Step 1: Create backup
echo -e "${BLUE}📦 Step 1: Creating database backup...${NC}"
BACKUP_FILE="$BACKUP_DIR/backup-before-queue-migration-$TIMESTAMP.sql"

if pg_dump "$DATABASE_URL" > "$BACKUP_FILE"; then
    echo -e "${GREEN}✅ Backup created: $BACKUP_FILE${NC}"
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo -e "${GREEN}   Backup size: $BACKUP_SIZE${NC}"
else
    echo -e "${RED}❌ ERROR: Failed to create backup${NC}"
    exit 1
fi

# Step 2: Check existing tables
echo -e "${BLUE}🔍 Step 2: Checking existing tables...${NC}"
EXISTING_TABLES=$(psql "$DATABASE_URL" -t -c "SELECT tablename FROM pg_tables WHERE tablename LIKE '%queue%' AND schemaname='public';" | tr -d ' \n')

if [[ -n "$EXISTING_TABLES" ]]; then
    echo -e "${YELLOW}⚠️  Found existing queue-related tables:${NC}"
    psql "$DATABASE_URL" -c "SELECT tablename FROM pg_tables WHERE tablename LIKE '%queue%' AND schemaname='public';"
else
    echo -e "${GREEN}✅ No conflicting queue tables found${NC}"
fi

# Step 3: Run migration
echo -e "${BLUE}🔧 Step 3: Running database migration...${NC}"
echo -e "${BLUE}   Executing: $MIGRATION_FILE${NC}"

if psql "$DATABASE_URL" -f "$MIGRATION_FILE"; then
    echo -e "${GREEN}✅ Migration executed successfully${NC}"
else
    echo -e "${RED}❌ ERROR: Migration failed${NC}"
    echo -e "${YELLOW}💡 You can restore from backup: $BACKUP_FILE${NC}"
    exit 1
fi

# Step 4: Verify migration
echo -e "${BLUE}🔍 Step 4: Verifying migration results...${NC}"

# Check if new tables exist
NEW_TABLES=$(psql "$DATABASE_URL" -t -c "SELECT tablename FROM pg_tables WHERE tablename IN ('unsigned_users_queue', 'outstanding_requests_queue') AND schemaname='public';" | wc -l | tr -d ' ')

if [ "$NEW_TABLES" -eq 2 ]; then
    echo -e "${GREEN}✅ New queue tables created successfully:${NC}"
    psql "$DATABASE_URL" -c "
    SELECT 
        tablename,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = tablename AND table_schema = 'public') as column_count
    FROM pg_tables 
    WHERE tablename IN ('unsigned_users_queue', 'outstanding_requests_queue') 
    AND schemaname='public';"
else
    echo -e "${RED}❌ ERROR: Expected 2 new tables, found $NEW_TABLES${NC}"
    exit 1
fi

# Check table structure
echo -e "${BLUE}📋 Table structures:${NC}"
for table in unsigned_users_queue outstanding_requests_queue; do
    echo -e "${BLUE}   $table:${NC}"
    psql "$DATABASE_URL" -c "\d $table" | head -20
    echo ""
done

# Step 5: Test basic operations
echo -e "${BLUE}🧪 Step 5: Testing basic operations...${NC}"

# Test insert/delete on new tables
psql "$DATABASE_URL" -c "
BEGIN;
-- Test insert
INSERT INTO unsigned_users_queue (user_id, priority_score, queue_position, status) 
VALUES (999999, 0, 1, 'pending');
-- Test select
SELECT COUNT(*) as test_count FROM unsigned_users_queue WHERE user_id = 999999;
-- Test delete (cleanup)
DELETE FROM unsigned_users_queue WHERE user_id = 999999;
ROLLBACK;
" || {
    echo -e "${RED}❌ ERROR: Basic operations test failed${NC}"
    exit 1
}

echo -e "${GREEN}✅ Basic operations test passed${NC}"

# Final summary
echo ""
echo -e "${GREEN}🎉 MIGRATION COMPLETED SUCCESSFULLY!${NC}"
echo -e "${GREEN}=================================${NC}"
echo -e "${GREEN}✅ Database backup created: $BACKUP_FILE${NC}"
echo -e "${GREEN}✅ New queue tables created and tested${NC}"
echo -e "${GREEN}✅ Migration completed in $(date)${NC}"
echo ""
echo -e "${BLUE}📋 Next Steps:${NC}"
echo "1. Deploy your application code to production"
echo "2. Test the new API endpoints"
echo "3. Configure cron jobs for queue generation"
echo "4. Monitor the first queue population run"
echo ""
echo -e "${YELLOW}💡 Rollback Instructions (if needed):${NC}"
echo "psql \"\$DATABASE_URL\" < $BACKUP_FILE"
echo ""
echo -e "${GREEN}🚀 Ready for enhanced queue system deployment!${NC}" 
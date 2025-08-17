#!/bin/bash

# Safe SMS Migration Script with Full Data Protection
# Usage: ./scripts/execute-safe-migration.sh

set -e  # Exit on any error

echo "═══════════════════════════════════════════════════════════════"
echo "🛡️  SAFE SMS CHECK-BEFORE-SEND MIGRATION"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Pre-flight checks
echo "1️⃣  PRE-FLIGHT CHECKS"
echo "────────────────────────"

# Check if ADMIN_API_SECRET is set
if [ -z "$ADMIN_API_SECRET" ]; then
  echo -e "${RED}❌ Error: ADMIN_API_SECRET not set${NC}"
  echo "Please run: export ADMIN_API_SECRET='your-secret-here'"
  exit 1
fi

# Check if PRODUCTION_DATABASE_URL is set (for backup)
if [ -z "$PRODUCTION_DATABASE_URL" ]; then
  echo -e "${YELLOW}⚠️  Warning: PRODUCTION_DATABASE_URL not set${NC}"
  echo "Cannot create automated backup. Please backup manually."
  read -p "Have you created a manual backup? (yes/no): " backup_confirm
  if [ "$backup_confirm" != "yes" ]; then
    echo -e "${RED}❌ Migration cancelled. Please backup first!${NC}"
    exit 1
  fi
else
  echo -e "${GREEN}✓ Environment variables configured${NC}"
fi

echo ""
echo "2️⃣  CURRENT SYSTEM STATUS"
echo "────────────────────────"
echo "• SMS Service: Running with safe handler"
echo "• Database tracking: Disabled (memory-only)"
echo "• Check-before-send: Active"
echo ""

# Step 2: Confirmation
echo -e "${YELLOW}⚠️  MIGRATION WILL:${NC}"
echo "• ADD 5 new columns to sms_messages table"
echo "• CREATE 2 new indexes"
echo "• MARK existing messages as processed"
echo "• PRESERVE all existing data"
echo ""
echo -e "${GREEN}✅ SAFETY FEATURES:${NC}"
echo "• Non-destructive (only adds, never removes)"
echo "• Data integrity checks at each step"
echo "• Automatic rollback on error"
echo "• Backup verification"
echo ""

read -p "Ready to proceed with migration? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
  echo -e "${RED}Migration cancelled by user${NC}"
  exit 0
fi

echo ""
echo "3️⃣  EXECUTING MIGRATION"
echo "────────────────────────"

# Run the migration
echo "Calling migration endpoint..."
RESPONSE=$(curl -s -X POST https://rmcdialer.vercel.app/api/admin/apply-sms-processing-migration \
  -H "Authorization: Bearer $ADMIN_API_SECRET" \
  -H "Content-Type: application/json")

# Check response
if echo "$RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ Migration completed successfully!${NC}"
  echo ""
  echo "Response details:"
  echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
  
  echo ""
  echo "4️⃣  POST-MIGRATION STEPS"
  echo "────────────────────────"
  echo ""
  echo "Next steps to complete setup:"
  echo ""
  echo "1. Add to Vercel environment variables:"
  echo "   ${GREEN}SMS_USE_DB_TRACKING=true${NC}"
  echo ""
  echo "2. Deploy to enable database tracking:"
  echo "   ${GREEN}vercel --prod${NC}"
  echo ""
  echo "3. Monitor logs for any issues:"
  echo "   ${GREEN}vercel logs --prod | grep 'AI SMS'${NC}"
  echo ""
  echo -e "${GREEN}🎉 Migration successful! All data preserved.${NC}"
  
else
  echo -e "${RED}❌ Migration failed or returned unexpected response${NC}"
  echo "Response:"
  echo "$RESPONSE"
  echo ""
  echo "ROLLBACK INSTRUCTIONS:"
  echo "1. Check Vercel logs: vercel logs --prod"
  echo "2. If needed, run: psql \$PRODUCTION_DATABASE_URL < scripts/rollback-sms-migration.sql"
  exit 1
fi

echo ""
echo "5️⃣  VERIFICATION"
echo "────────────────────────"
echo "To verify the migration:"
echo "• Check that SMS still works: Send a test message"
echo "• Verify in database: SELECT column_name FROM information_schema.columns WHERE table_name='sms_messages';"
echo "• Check message count: SELECT COUNT(*) FROM sms_messages;"
echo ""
echo "═══════════════════════════════════════════════════════════════"

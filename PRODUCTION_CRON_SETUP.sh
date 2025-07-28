#!/bin/bash

# 🚀 Production Cron Jobs Setup - Enhanced Queue System
# 
# This script sets up the cron jobs for your enhanced queue system on production

echo "🚀 Setting up Enhanced Queue System Cron Jobs"
echo "=============================================="

# Backup existing crontab
echo "📦 Backing up existing crontab..."
crontab -l > crontab-backup-$(date +%Y%m%d_%H%M%S).txt 2>/dev/null || echo "No existing crontab found"

# Create new crontab with enhanced queue jobs
echo "🔧 Creating enhanced queue cron jobs..."
cat << 'EOF' > enhanced-queue-crontab.txt
# Enhanced Queue System Cron Jobs
# ================================

# Queue level monitoring (every 5 minutes)
# Checks queue levels and triggers auto-regeneration if needed
*/5 * * * * curl -s -X GET https://rmcdialer.vercel.app/api/cron/queue-level-check >> /var/log/queue-monitor.log 2>&1

# Full hourly queue refresh (safety net)
# Ensures queues are always populated even if auto-regeneration fails
0 * * * * curl -s -X GET https://rmcdialer.vercel.app/api/cron/populate-separated-queues >> /var/log/queue-generation.log 2>&1

# Existing cron jobs (keep these)
# ===============================
EOF

# Append existing cron jobs (excluding old queue-related ones)
echo "📋 Preserving existing non-queue cron jobs..."
crontab -l 2>/dev/null | grep -v -E "(queue|Queue)" >> enhanced-queue-crontab.txt || echo "# No existing cron jobs to preserve"

# Install new crontab
echo "⚡ Installing enhanced cron jobs..."
crontab enhanced-queue-crontab.txt

# Verify installation
echo "🔍 Verifying cron jobs installation..."
echo ""
echo "📋 Current crontab:"
crontab -l | grep -E "(queue|Queue|curl.*rmcdialer)"

echo ""
echo "✅ Enhanced Queue System Cron Jobs Installed!"
echo ""
echo "📊 Monitoring:"
echo "   • Queue levels checked every 5 minutes"
echo "   • Auto-regeneration when < 20 users"
echo "   • Full refresh every hour as backup"
echo ""
echo "📁 Log files:"
echo "   • Queue monitor: /var/log/queue-monitor.log"
echo "   • Queue generation: /var/log/queue-generation.log"
echo ""
echo "🎯 Your enhanced queue system is now fully automated!"
echo "   Agents will never run out of users to call! 🚀" 
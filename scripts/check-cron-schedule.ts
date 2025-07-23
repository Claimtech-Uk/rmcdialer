#!/usr/bin/env tsx

// Helper script to predict when cron jobs will next run

const cronSchedules = [
  {
    name: 'Queue Discovery',
    path: '/api/cron/discover-new-leads',
    schedule: '0 * * * *',
    description: 'Runs at the top of every hour (e.g., 14:00, 15:00, 16:00)'
  },
  {
    name: 'Scoring Maintenance',
    path: '/api/cron/scoring-maintenance', 
    schedule: '15 * * * *',
    description: 'Runs 15 minutes past every hour (e.g., 14:15, 15:15, 16:15)'
  },
  {
    name: 'Daily Cleanup',
    path: '/api/cron/daily-cleanup',
    schedule: '0 2 * * *',
    description: 'Runs daily at 2:00 AM UTC'
  }
];

function getNextRunTime(cronExpression: string): Date {
  const now = new Date();
  const [minute, hour, day, month, dayOfWeek] = cronExpression.split(' ');
  
  // Simple calculation for our specific cron patterns
  if (cronExpression === '0 * * * *') {
    // Every hour at minute 0
    const next = new Date(now);
    next.setMinutes(0, 0, 0);
    if (next <= now) {
      next.setHours(next.getHours() + 1);
    }
    return next;
  }
  
  if (cronExpression === '15 * * * *') {
    // Every hour at minute 15
    const next = new Date(now);
    next.setMinutes(15, 0, 0);
    if (next <= now) {
      next.setHours(next.getHours() + 1);
    }
    return next;
  }
  
  if (cronExpression === '0 2 * * *') {
    // Daily at 2:00 AM UTC
    const next = new Date(now);
    next.setUTCHours(2, 0, 0, 0);
    if (next <= now) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
    return next;
  }
  
  return new Date(); // fallback
}

function formatTimeUntil(targetTime: Date): string {
  const now = new Date();
  const diff = targetTime.getTime() - now.getTime();
  
  if (diff <= 0) return 'Now!';
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

console.log('⏰ VERCEL CRON SCHEDULE PREDICTION');
console.log('==================================');
console.log(`🕐 Current time: ${new Date().toISOString()}`);
console.log(`📍 Current timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
console.log(`🌍 Note: Vercel crons run in UTC timezone\n`);

cronSchedules.forEach(job => {
  const nextRun = getNextRunTime(job.schedule);
  const timeUntil = formatTimeUntil(nextRun);
  
  console.log(`📋 ${job.name}`);
  console.log(`   Schedule: ${job.schedule}`);
  console.log(`   Description: ${job.description}`);
  console.log(`   Next run: ${nextRun.toISOString()}`);
  console.log(`   Time until: ${timeUntil}`);
  console.log('');
});

console.log('🚀 DEPLOYMENT TIMING:');
console.log('• Cron jobs activate IMMEDIATELY after successful deployment');
console.log('• Jobs will run according to their next scheduled time');
console.log('• You can manually trigger jobs for immediate testing');
console.log('• Check Vercel Functions dashboard for execution logs');

// Simple CI env reporter (sanitized)
// Prints presence (not values) of critical env vars to help diagnose Amplify builds

const keys = [
  'ENVIRONMENT_NAME',
  'NODE_ENV',
  'DATABASE_URL',
  'REPLICA_DATABASE_URL',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
  'AI_SMS_TEST_NUMBER',
  'MAIN_APP_URL',
  'TRUSTPILOT_REVIEW_URL',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'CRON_SECRET'
];

console.log('--- CI Environment Report (presence only) ---');
for (const k of keys) {
  const val = process.env[k];
  const present = val && String(val).length > 0;
  const preview = typeof val === 'string' && val.length > 6 ? val.slice(0, 6) + '…' : undefined;
  console.log(`${k}=${present ? 'SET' : 'MISSING'}${present && preview ? ` (${preview})` : ''}`);
}
console.log('-------------------------------------------');




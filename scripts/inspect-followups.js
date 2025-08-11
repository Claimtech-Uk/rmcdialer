// Script to inspect SMS follow-ups stored in Redis
// Usage: node -r ts-node/register scripts/inspect-followups.js [phone_number]

// Import the cache service from your project
const { cacheService } = require('../lib/redis.ts');

async function inspectFollowups(phoneNumber = null) {
  try {
    console.log('🔍 SMS Follow-ups Inspector\n');

    if (phoneNumber) {
      // Inspect specific phone number
      await inspectPhoneFollowups(phoneNumber);
    } else {
      // Show all phones with follow-ups
      await showAllPhonesWithFollowups();
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    redis.disconnect();
  }
}

async function showAllPhonesWithFollowups() {
  // Get the index of all phones with follow-ups
  const phones = await redis.get('sms:followups:index');
  const phonesList = phones ? JSON.parse(phones) : [];

  console.log(`📱 Phones with follow-ups: ${phonesList.length}\n`);

  if (phonesList.length === 0) {
    console.log('No phones have scheduled follow-ups.');
    return;
  }

  for (const phone of phonesList) {
    console.log(`📞 ${phone}`);
    await inspectPhoneFollowups(phone, true);
    console.log(''); // Empty line between phones
  }
}

async function inspectPhoneFollowups(phoneNumber, brief = false) {
  const key = `sms:followups:${phoneNumber}`;
  const followupsData = await redis.get(key);
  
  if (!followupsData) {
    console.log(`❌ No follow-ups found for ${phoneNumber}`);
    return;
  }

  const followups = JSON.parse(followupsData);
  
  if (!brief) {
    console.log(`📞 Phone: ${phoneNumber}`);
    console.log(`📋 Follow-ups: ${followups.length}\n`);
  }

  const now = Date.now();
  
  followups.forEach((followup, index) => {
    const isDue = followup.dueAt <= now;
    const timeRemaining = followup.dueAt - now;
    const status = isDue ? '🔴 DUE' : '⏳ PENDING';
    
    const dueDate = new Date(followup.dueAt).toLocaleString();
    const createdDate = new Date(followup.createdAt).toLocaleString();
    
    if (brief) {
      console.log(`  ${status} ${followup.text.slice(0, 50)}...`);
    } else {
      console.log(`${index + 1}. ${status} ${followup.id}`);
      console.log(`   📝 Text: "${followup.text}"`);
      console.log(`   📅 Created: ${createdDate}`);
      console.log(`   ⏰ Due: ${dueDate}`);
      
      if (!isDue) {
        const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
        const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
        console.log(`   ⏱️  Time remaining: ${hours}h ${minutes}m`);
      }
      
      if (followup.metadata) {
        console.log(`   🏷️  Metadata:`, JSON.stringify(followup.metadata, null, 4));
      }
      console.log('');
    }
  });
}

// Parse command line arguments
const phoneNumber = process.argv[2];

// Run the inspector
inspectFollowups(phoneNumber);

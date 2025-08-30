#!/usr/bin/env node

/**
 * Test script to simulate EXACTLY what PartyKit would do
 * when Hume calls the send_portal_link tool
 */

async function testSMSPortal() {
  console.log('🧪 TESTING SMS PORTAL LINK - Simulating PartyKit Tool Call');
  console.log('========================================================\n');
  
  // This is James Campbell's phone number (confirmed working)
  const phoneNumber = '+447738585850';
  const userId = 2064;  // We know this from our successful lookup
  const linkType = 'claims';  // Default portal link type
  
  console.log(`📞 Phone Number: ${phoneNumber}`);
  console.log(`👤 User ID: ${userId} (James Campbell)`);
  console.log(`🔗 Link Type: ${linkType}`);
  console.log(`⏰ Timestamp: ${new Date().toISOString()}\n`);
  
  // Simulate what PartyKit's handleSendPortalLink function does
  try {
    console.log('🔗 STEP 1: Generating portal link...');
    
    // Use CORRECT main app URL and AI magic link format  
    const baseUrl = 'https://claim.resolvemyclaim.co.uk';  // Main app, not dialer
    const token = Buffer.from(userId.toString()).toString('base64');  // AI magic link format
    const portalUrl = `${baseUrl}/claims?mlid=${token}`;  // Correct AI format
    
    console.log(`✅ Portal URL generated: ${portalUrl.substring(0, 60)}...`);
    
    console.log('\n📱 STEP 2: Sending SMS (as PartyKit would)...');
    
    // SMS API is on the dialer app, but portal links point to main app
    const smsApiUrl = `https://dev.solvosolutions.co.uk/api/ai-voice/send-portal-sms?x-vercel-protection-bypass=devtwiliobypass2024secureaivoice`;
    
    console.log(`📡 SMS API URL: ${smsApiUrl}`);
    
    const response = await fetch(smsApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ai-voice-token-1756549667-secure'
      },
      body: JSON.stringify({
        phoneNumber: phoneNumber,
        portalUrl: portalUrl,
        linkType: linkType
      })
    });
    
    console.log(`📨 SMS Response Status: ${response.status} ${response.statusText}`);
    console.log(`📋 SMS Response Headers:`);
    console.log(`  - Content-Type: ${response.headers.get('content-type')}`);
    console.log(`  - Content-Length: ${response.headers.get('content-length')}`);
    console.log('');
    
    const smsResult = await response.json();
    
    console.log('✅ SMS RESPONSE (what PartyKit receives):');
    console.log('----------------------------------------');
    console.log(JSON.stringify(smsResult, null, 2));
    console.log('');
    
    // Show what PartyKit would return to Hume
    if (smsResult.success) {
      console.log('🎯 SMS SENT SUCCESSFULLY - Building Hume Response...\n');
      
      const humeResponse = {
        success: true,
        message: `Perfect! I've sent your ${linkType} portal link to ${phoneNumber.replace('+44', '0')}. You should receive it shortly.`,
        data: {
          phone: phoneNumber,
          link_type: linkType,
          portal_sent: true,
          message_id: smsResult.messageSid
        }
      };
      
      console.log('🤖 HUME WOULD RECEIVE THIS TOOL RESPONSE:');
      console.log('==========================================');
      console.log(JSON.stringify(humeResponse, null, 2));
      
    } else {
      console.log('❌ SMS FAILED - Building Hume Error Response...\n');
      
      const humeResponse = {
        success: false,
        message: "I'm having trouble sending the portal link right now. Let me try another way to help you.",
        error: smsResult.error,
        data: {
          phone: phoneNumber,
          link_type: linkType,
          portal_sent: false
        }
      };
      
      console.log('🤖 HUME WOULD RECEIVE THIS ERROR RESPONSE:');
      console.log('===========================================');
      console.log(JSON.stringify(humeResponse, null, 2));
    }
    
  } catch (error) {
    console.error('❌ ERROR (what PartyKit would handle):');
    console.error('--------------------------------------');
    console.error(error);
    console.log('');
    
    const errorResponse = {
      success: false,
      message: "I'm having trouble sending the portal link right now. Please bear with me for a moment.",
      error: error.message
    };
    
    console.log('🤖 HUME WOULD RECEIVE THIS ERROR RESPONSE:');
    console.log('===========================================');
    console.log(JSON.stringify(errorResponse, null, 2));
  }
  
  console.log('\n========================================================');
  console.log('🧪 SMS PORTAL TEST COMPLETE');
}

// Note: Using AI magic link format (base64 encoded user ID) 
// This matches the proven working AI magic link generator

// Run the test
testSMSPortal().catch(console.error);

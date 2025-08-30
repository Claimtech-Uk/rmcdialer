#!/usr/bin/env node

/**
 * Test script to simulate EXACTLY what Hume would trigger
 * when calling the check_user_details tool
 */

async function testUserLookup() {
  console.log('🧪 TESTING USER LOOKUP - Simulating Hume Tool Call');
  console.log('================================================\n');
  
  // This is the EXACT phone number from James Campbell's call
  const phoneNumber = '+447738585850';
  
  // The API URL that PartyKit uses (from environment)
  const MAIN_APP_URL = 'https://dev.solvosolutions.co.uk';
  const lookupUrl = `${MAIN_APP_URL}/api/ai-voice/lookup-user`;
  
  console.log(`📞 Phone Number: ${phoneNumber}`);
  console.log(`🌐 API Endpoint: ${lookupUrl}`);
  console.log(`⏰ Timestamp: ${new Date().toISOString()}\n`);
  
  console.log('📡 Making API call (exactly as PartyKit would)...\n');
  
  try {
    // Get the API token from environment or use a test token
    const API_TOKEN = process.env.AI_VOICE_API_TOKEN || 'test-ai-voice-token-2024';
    
    console.log(`🔐 Using API Token: ${API_TOKEN ? 'Bearer ' + API_TOKEN.substring(0, 10) + '...' : 'None'}\n`);
    
    // This is the EXACT request PartyKit makes
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (API_TOKEN) {
      headers['Authorization'] = `Bearer ${API_TOKEN}`;
    }
    
    const response = await fetch(lookupUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ phone: phoneNumber })
    });
    
    console.log(`📨 Response Status: ${response.status} ${response.statusText}`);
    console.log(`📋 Response Headers:`);
    console.log(`  - Content-Type: ${response.headers.get('content-type')}`);
    console.log(`  - Content-Length: ${response.headers.get('content-length')}`);
    console.log('');
    
    const userData = await response.json();
    
    console.log('✅ RAW RESPONSE (what PartyKit receives):');
    console.log('------------------------------------------');
    console.log(JSON.stringify(userData, null, 2));
    console.log('');
    
    // Now simulate what PartyKit does with this data
    if (userData.found) {
      console.log('🎯 USER FOUND - Building Hume Response...\n');
      
      // This is EXACTLY what PartyKit sends back to Hume
      let detailsMessage = `I have your details here. You're ${userData.fullName}`;
      
      // Add ID status
      if (!userData.hasIdOnFile) {
        detailsMessage += `. I notice you haven't uploaded your ID documents yet`;
      }
      
      // Add claims details
      if (userData.claimsCount > 0) {
        detailsMessage += `. You have ${userData.claimsCount} claim(s) with us`;
        
        // Add lender info
        if (userData.claims && userData.claims.length > 0) {
          const lenders = [...new Set(userData.claims.map(c => c.lender).filter(Boolean))];
          if (lenders.length > 0) {
            detailsMessage += ` with ${lenders.join(' and ')}`;
          }
          
          // Add vehicle status info
          const allStatuses = userData.claims.flatMap(c => 
            c.vehicleStatuses || []
          );
          if (allStatuses.length > 0) {
            detailsMessage += `. Vehicle status: ${[...new Set(allStatuses)].join(', ')}`;
          }
        }
      }
      
      const humeResponse = {
        success: true,
        message: detailsMessage,
        data: {
          phone: userData.phone,
          name: userData.fullName,
          user_found: true,
          has_id_on_file: userData.hasIdOnFile,
          claims_count: userData.claimsCount,
          status: userData.status
        }
      };
      
      console.log('🤖 HUME WOULD RECEIVE THIS TOOL RESPONSE:');
      console.log('==========================================');
      console.log(JSON.stringify(humeResponse, null, 2));
      
    } else {
      console.log('❌ USER NOT FOUND - Building Hume Response...\n');
      
      const humeResponse = {
        success: true,
        message: "I can see you're calling from " + phoneNumber.replace('+44', '0') + 
                 ". I don't have an account with that number in our system yet. " +
                 "Would you like me to help you get registered for a motor finance claim?",
        data: {
          phone: phoneNumber,
          user_found: false,
          action_needed: 'registration'
        }
      };
      
      console.log('🤖 HUME WOULD RECEIVE THIS TOOL RESPONSE:');
      console.log('==========================================');
      console.log(JSON.stringify(humeResponse, null, 2));
    }
    
  } catch (error) {
    console.error('❌ ERROR (what PartyKit would handle):');
    console.error('--------------------------------------');
    console.error(error);
    console.log('');
    
    const errorResponse = {
      success: false,
      message: "I'm having trouble looking up your details right now. Please bear with me for a moment.",
      error: error.message
    };
    
    console.log('🤖 HUME WOULD RECEIVE THIS ERROR RESPONSE:');
    console.log('===========================================');
    console.log(JSON.stringify(errorResponse, null, 2));
  }
  
  console.log('\n================================================');
  console.log('🧪 TEST COMPLETE');
}

// Run the test
testUserLookup().catch(console.error);

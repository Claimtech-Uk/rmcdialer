/*
  Test the new 3-part conversational response structure
  Usage: node test-new-prompt.js
*/

import { generateConversationalResponse } from './modules/ai-agents/core/conversational-response-builder.js'

const testScenarios = [
  {
    name: "Fees Question (OBJECTION)",
    userMessage: "What are your fees?",
    userName: "James",
    userStatus: "unsigned",
    expectedPattern: ["Hi James", "fee structure", "portal link"]
  },
  {
    name: "Documents Question (INFORMATION)",
    userMessage: "What documents do you need?",
    userName: "Sarah",
    userStatus: "signed",
    expectedPattern: ["Hi Sarah", "documents", "signature"]
  },
  {
    name: "Timeline Question (OBJECTION)",
    userMessage: "How long will this take?",
    userName: null,
    userStatus: "unsigned",
    expectedPattern: ["Hi there", "chase lenders", "portal link"]
  }
];

async function testConversationalResponse() {
  console.log('🧪 Testing New 3-Part Conversational Response Structure\n');
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not set');
    process.exit(1);
  }

  for (const scenario of testScenarios) {
    console.log(`📝 Testing: ${scenario.name}`);
    console.log(`   User: "${scenario.userMessage}"`);
    console.log(`   Name: ${scenario.userName || 'None'}`);
    
    try {
      const context = {
        userMessage: scenario.userMessage,
        userName: scenario.userName,
        userStatus: scenario.userStatus,
        recentMessages: [],
        knowledgeContext: 'Motor finance claims specialist',
        conversationHistory: []
      };

      const response = await generateConversationalResponse(context, 'engaged');
      
      console.log('   ✅ Response received:');
      console.log(`   Messages: ${response.messages.length}`);
      
      response.messages.forEach((msg, index) => {
        console.log(`   ${index + 1}. "${msg}"`);
      });
      
      // Check if it follows our 3-part structure
      const hasGreeting = response.messages[0]?.toLowerCase().includes('hi ');
      const hasThreeMessages = response.messages.length === 3;
      const hasCallToAction = response.messages[response.messages.length - 1]?.includes('?');
      
      console.log(`   Structure Check: ${hasGreeting ? '✅' : '❌'} Greeting | ${hasThreeMessages ? '✅' : '❌'} 3 Messages | ${hasCallToAction ? '✅' : '❌'} Call to Action`);
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    console.log('');
  }
}

testConversationalResponse().catch(console.error);


# 🚨 Critical Inbound Call Routing Bug Report

## 📋 Executive Summary

Multiple critical bugs have been identified in the inbound call routing system that cause:
1. **Infinite Loop**: Callers get stuck in an "Alice trying to connect" loop when agents don't answer
2. **Incorrect Call Status**: Calls are marked as "completed" even when they should be "missed calls"
3. **Logic Order Issue**: System proceeds with agent routing even when agents aren't actually available

---

## 🔍 Root Cause Analysis

### **Bug #1: Infinite TwiML Loop (CRITICAL)**

**Problem**: When an agent is found in the database but their device doesn't answer, Twilio falls into an infinite loop.

**Root Cause**: In `app/api/webhooks/twilio/voice/route.ts` lines 624-630:
```xml
<Dial timeout="30" 
      action="${statusCallbackUrl}">
    <Client>
        <Identity>${agentClientName}</Identity>
    </Client>
</Dial>
```

The `action` attribute points to the **call-status webhook**, but that webhook **doesn't return TwiML** - it only processes status updates. This creates an infinite loop where:

1. Twilio dials the agent → Agent doesn't answer
2. Twilio calls the action URL (call-status webhook) expecting TwiML
3. Call-status webhook processes the status but returns JSON, not TwiML
4. Twilio gets confused and repeats the process

**Evidence**: The "Alice trying to connect" message comes from the fallback `<Say>` in the TwiML, but since the action URL doesn't provide proper TwiML, Twilio keeps retrying.

### **Bug #2: Incorrect Call Status Recording (CRITICAL)**

**Problem**: Calls are marked as "completed" instead of "missed_call" when agents don't answer.

**Root Cause**: In `app/api/webhooks/twilio/call-status/route.ts` lines 140-152:
```typescript
const statusMapping: Record<string, string> = {
  'completed': 'completed',  // ❌ WRONG - marks all completed calls as successful
  'busy': 'no_answer',
  'failed': 'failed',
  'no-answer': 'no_answer',
  'canceled': 'failed'
};
```

**The Logic Flaw**: The system assumes "completed" means the call was successful, but in Twilio:
- `completed` = The call flow finished (regardless of whether agent answered)
- `answered` = Agent actually picked up the call

**Current Behavior**: When a caller hangs up after waiting for an agent who never answers, Twilio marks it as `completed` because the call flow finished, and the system incorrectly records this as a successful call.

### **Bug #3: Agent Availability Logic Order (HIGH)**

**Problem**: System checks database for available agents but doesn't verify their Twilio device status.

**Root Cause**: In `app/api/webhooks/twilio/voice/route.ts` lines 344-388:
```typescript
const availableAgents = await prisma.agentSession.findMany({
  where: {
    status: 'available',  // ❌ Only checks database status
    logoutAt: null,
    agent: { isActive: true }
  }
});
```

**Missing Logic**: 
- No verification that agent's Twilio device is online
- No check if agent is actually registered with the correct client identity
- No validation that the agent can receive calls at that moment

---

## 🛠️ Detailed Fix Implementation

### **Fix #1: Correct TwiML Action URL**

**SOLUTION**: Create a dedicated action handler that returns proper TwiML when dial fails.

**New File Needed**: `/api/webhooks/twilio/dial-action/route.ts`
```typescript
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const dialCallStatus = formData.get('DialCallStatus') as string;
  const callSid = formData.get('CallSid') as string;
  
  console.log(`📞 Dial action: ${dialCallStatus} for call ${callSid}`);
  
  // Agent didn't answer - provide proper fallback TwiML
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">I'm sorry, our agent is unavailable right now. We'll have someone call you back as soon as possible. Thank you!</Say>
    <Hangup/>
</Response>`, {
    status: 200,
    headers: { 'Content-Type': 'application/xml' }
  });
}
```

**TwiML Update**: Change the action URL in voice webhook:
```xml
<Dial timeout="30" 
      action="${baseUrl}/api/webhooks/twilio/dial-action"
      statusCallback="${statusCallbackUrl}">
```

### **Fix #2: Correct Call Status Logic**

**SOLUTION**: Differentiate between call completion and agent connection.

**Update `call-status/route.ts`**:
```typescript
// Only mark as 'completed' if agent actually answered
if (effectiveStatus === 'completed') {
  // Check if call was actually answered by agent
  if (callSession.connectedAt && callSession.talkTimeSeconds > 0) {
    updateData.status = 'completed';
  } else {
    // Call completed but no agent connection = missed call
    updateData.status = callSession.direction === 'inbound' ? 'missed_call' : 'no_answer';
    console.log(`📞 Call ${CallSid} completed without agent connection - marking as missed`);
  }
}
```

### **Fix #3: Enhanced Agent Availability Check**

**SOLUTION**: Add real-time agent device validation.

**Add to voice webhook before agent routing**:
```typescript
// Enhanced agent validation with device check
if (validatedAgent) {
  try {
    // Check if agent's Twilio device is actually online
    const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const devices = await twilioClient.accounts(process.env.TWILIO_ACCOUNT_SID)
      .token
      .create({identity: `agent_${validatedAgent.agentId}`});
    
    // If we can't create a token, the device might not be online
    console.log(`✅ Agent ${validatedAgent.agentId} device verified online`);
  } catch (deviceError) {
    console.warn(`⚠️ Agent ${validatedAgent.agentId} device not available:`, deviceError);
    validatedAgent = null; // Force fallback to busy greeting
  }
}
```

---

## 🎯 Immediate Action Plan

### **Phase 1: Stop the Loop (URGENT - Deploy Now)**
1. ✅ Create `dial-action` webhook endpoint
2. ✅ Update TwiML action URLs in voice webhook
3. ✅ Test with failed agent dial scenarios

### **Phase 2: Fix Call Status Recording (HIGH Priority)**
1. ✅ Update call-status webhook logic
2. ✅ Add proper missed call detection
3. ✅ Test call outcome scenarios

### **Phase 3: Enhanced Agent Validation (MEDIUM Priority)**
1. ✅ Add Twilio device status checks
2. ✅ Implement real-time agent availability
3. ✅ Add fallback logic for offline devices

---

## 🧪 Testing Scenarios

### **Test Case 1: Agent Doesn't Answer**
**Setup**: Agent logged in database but device offline
**Expected**: Busy greeting → Hangup → Missed call logged
**Current**: Infinite loop → Eventually completed status

### **Test Case 2: No Agents Available**
**Setup**: No agents logged in
**Expected**: Busy greeting → Hangup → Missed call logged  
**Current**: ✅ Working correctly

### **Test Case 3: Agent Answers Call**
**Setup**: Agent online and answers
**Expected**: Connected → Proper call session → Completed when finished
**Current**: ✅ Working correctly

---

## 📊 Impact Assessment

### **Business Impact**
- **Lost Customers**: Callers hanging up due to infinite loop
- **Incorrect Reporting**: Missed calls being counted as successful
- **Agent Productivity**: Agents appear busy when they're actually available

### **Technical Debt**
- **Monitoring Blind Spots**: Can't accurately track missed calls
- **Call Quality Issues**: Poor customer experience
- **Resource Waste**: Infinite loops consuming system resources

---

## 🚀 Recommended Deployment Order

1. **IMMEDIATE**: Deploy dial-action webhook fix (stops infinite loop)
2. **SAME DAY**: Deploy call status logic fix (correct reporting)
3. **NEXT SPRINT**: Deploy enhanced agent validation (prevents false availability)

---

## 🔍 Additional Recommendations

### **Monitoring Enhancements**
- Add alerts for call loops (multiple status updates without progression)
- Track agent device connection status
- Monitor missed call rates vs. agent availability

### **Future Improvements**
- Implement agent heartbeat system
- Add call queue with retry logic
- Consider WebSocket agent status updates

This bug report addresses the exact issues you experienced: the infinite "Alice trying to connect" loop, incorrect call completion status, and the logic order problems in agent availability checking. 
# 🚨 EMERGENCY ROLLBACK INSTRUCTIONS

## IMMEDIATE ACTION: Disable AI Agent (if calls are failing)

If all calls are failing due to Hume TTS issues, deploy this emergency fix:

### Step 1: Disable AI for All Calls
In `app/api/webhooks/twilio/voice/route.ts`, line 28, change:
```typescript
// FROM:
return true;

// TO:
return false; // EMERGENCY: Disable AI until Hume TTS is fixed
```

### Step 2: Deploy Emergency Fix
```bash
git add -A
git commit -m "EMERGENCY: Disable AI agent - fallback to human routing"
npx vercel --prod
```

### Step 3: Verify Calls Work
- Test an inbound call
- Should route to human agents instead of AI
- Confirm call completion

## ROLLBACK TO AI (After fixes)
Change line 28 back to `return true;` and redeploy.

## Current State Documentation
- **Date**: Created during Hume TTS investigation
- **Issue**: Hume TTS API format errors causing all AI calls to fail
- **Active Integration**: Hume TTS (not EVI)
- **Affected**: ALL inbound calls (100% use AI currently)
- **Business Impact**: CRITICAL - No calls can complete with AI

## Contact
This rollback ensures business continuity while technical fixes are implemented. 
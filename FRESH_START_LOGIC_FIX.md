# Fresh Start Logic Fix

## Issue Summary
User 2064 (who has been in the system for a while) was being treated as a "new user" and getting their score reset to 0 on every call outcome, instead of receiving the proper +25 penalty for hanging up.

## Root Cause
The fresh start logic was incorrectly using `lastResetDate` to determine if a user is "new":

```typescript
// BROKEN LOGIC:
const isNewUser = !context.lastResetDate // ❌ Anyone without lastResetDate = "new"
```

This meant:
- **Truly new users**: No user_call_score record → Treated as new ✅ 
- **Existing users with null lastResetDate**: Have a record but lastResetDate = null → Treated as new ❌

## Fix Applied

### 1. Enhanced Scoring Context
Added `hasExistingRecord` to distinguish truly new users from existing users:

```typescript
// In call.service.ts:
const scoringContext = {
  // ... existing fields ...
  hasExistingRecord: !!userScore,  // NEW: Whether user_call_score record exists
  currentScore: userScore?.currentScore || 0
};
```

### 2. Fixed Fresh Start Logic
Changed to only treat users as "new" if they have no record at all:

```typescript
// FIXED LOGIC:
const isTrulyNewUser = context.hasExistingRecord === false // ✅ Only if no record exists

// Fresh start conditions:
const isFreshStart = isTrulyNewUser || queueTypeChanged || hasNewRequirements;
```

### 3. Set lastResetDate for Existing Users
Ensure existing users get their `lastResetDate` set to prevent future fresh start treatment:

```typescript
// FIXED: Set lastResetDate for existing users who don't have it
lastResetDate: needsReset ? new Date() : (userScore?.lastResetDate || new Date()),
```

## Expected Behavior Now

### For User 2064 (Existing User):
- **Before**: Always treated as "new user" → Score reset to 0 every call ❌
- **After**: Treated as existing user → Gets proper outcome penalties ✅
  - Hung up: Current score + 25 penalty + attempt penalty = Proper score increase
  - No answer: Current score + 10 penalty + attempt penalty  
  - Call back: Current score - 15 bonus + attempt penalty

### For Truly New Users:
- **Still get fresh start treatment** → Base score 0 + outcome adjustments ✅
- Hung up: 0 (base) + 25 (penalty) + attempt penalty = ~25-30 score

## Files Modified
1. **`modules/scoring/types/scoring.types.ts`** - Added `hasExistingRecord` field
2. **`modules/scoring/services/priority-scoring.service.ts`** - Fixed fresh start logic  
3. **`modules/calls/services/call.service.ts`** - Enhanced context & ensured lastResetDate is set

## Testing
User 2064 should now:
1. Not be treated as "new user" anymore
2. Receive proper score penalties for negative outcomes
3. Have their `lastResetDate` set after the next call outcome

## Status: FIXED ✅
Existing users will no longer be incorrectly reset to score 0 on every call. 
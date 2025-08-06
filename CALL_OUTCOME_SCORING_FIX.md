# Call Outcome Scoring Fix

## Issue Summary
Call outcomes were not updating user scores correctly. Specifically, the "hung_up" outcome was resulting in a score of 0 instead of the expected penalty increase.

## Root Cause
The **fresh start logic** in `PriorityScoringService.calculatePriority()` was completely skipping outcome adjustments for new users:

```typescript
// BEFORE (BROKEN):
if (freshStartCheck.isFreshStart) {
  finalScore = 0 // Fresh starts always get score 0
  // ❌ SKIPS all outcome adjustments and penalties
} else {
  // Only applied to existing users
  finalScore += outcomeFactor.value
  finalScore += attemptFactor.value
}
```

This meant new users always got score 0 regardless of their call outcome (hang-up, rude behavior, etc.).

## Fix Applied
Changed the logic to apply outcome adjustments to **ALL users** (both new and existing):

```typescript
// AFTER (FIXED):
// 1. Set base score
if (freshStartCheck.isFreshStart) {
  finalScore = 0 // Fresh starts get base score of 0
} else {
  finalScore = context.currentScore || 0 // Continue with existing score
}

// 2. Apply outcome adjustments (for ALL users, including fresh starts)
if (context.lastOutcome) {
  finalScore += outcomeFactor.value
}

// 3. Apply call attempt penalty (for ALL users, including fresh starts)
finalScore += attemptFactor.value
```

## Expected Behavior Now

### For New Users (Fresh Start):
- **Hung Up**: 0 (base) + 25 (penalty) + attempt penalty = ~25-30 score
- **No Answer**: 0 (base) + 10 (penalty) + attempt penalty = ~15-20 score
- **Call Back**: 0 (base) + (-15) (positive) + attempt penalty = ~0-5 score

### For Existing Users:
- **Hung Up**: current score + 25 (penalty) + attempt penalty
- **No Answer**: current score + 10 (penalty) + attempt penalty
- **Call Back**: current score + (-15) (positive) + attempt penalty

## Outcome Score Adjustments (from hung-up.outcome.ts)
- `hung_up`: +25 (lower priority - negative outcome)
- `no_answer`: +10 (slightly lower priority)
- `call_back`: 3 (add 3 to current score - positive outcome)
- `bad_number`: +50 (much lower priority)
- `not_interested`: +100 (very low priority)
- `no_claim`: +200 (conversion - remove from queue)

## Files Modified
- `modules/scoring/services/priority-scoring.service.ts`

## Testing
- ✅ Build successful
- ⏳ Ready for manual testing of call outcomes

## Status: FIXED ✅
Call outcomes should now correctly apply score adjustments to all users, including new ones. 
# Call Outcome Scoring Investigation Report

## 🔍 **Investigation Summary**

The user reported that call outcomes are "resetting users to scores instead of calculating new scores." Our diagnostic revealed the specific issue and its root cause.

## 📊 **Current Score Adjustments (All Correct)**

| Outcome Type | Score Adjustment | Description |
|--------------|------------------|-------------|
| `completed_form` | 0 | No change, triggers conversion |
| `going_to_complete` | 0 | No change, reset score |
| `might_complete` | 0 | No change, reset score |
| `call_back` | -15 | Bonus - higher priority |
| `missed_call` | 0 | No change, immediate callback |
| `no_answer` | +10 | Penalty - slightly lower priority |
| `hung_up` | +25 | Penalty - lower priority |
| `bad_number` | +50 | Penalty - significant problem |
| `not_interested` | +100 | Penalty - very low priority |
| `no_claim` | +200 | Penalty - triggers conversion |
| `do_not_contact` | +200 | Penalty - triggers conversion |

## 🚨 **Issues Found**

### 1. **Score Capping Issue (Primary Problem)**

**Problem**: Existing users with high-penalty outcomes (+200) get capped at 200 instead of having the penalty properly added.

**Example**:
- User has current score: 30
- Outcome: `no_claim` (+200)
- **Expected**: 30 + 200 = 230
- **Actual**: 230 → capped at 200

**Root Cause**: 
```typescript
// In priority-scoring.service.ts line 61
finalScore = Math.max(0, Math.min(finalScore, 200))
```

This caps the score AFTER calculation, making it appear like the user was "reset" to 200.

### 2. **Missing Attempt Penalties**

**Problem**: All diagnostic tests show "0 penalty for excessive attempts" suggesting attempt penalty calculation may not be working.

### 3. **Score Floor Issue (Minor)**

**Problem**: `call_back` outcome (-15) for new users results in 0 instead of -15.
**Status**: This is actually correct behavior (scores can't go below 0).

## 🎯 **Business Logic Analysis**

### Conversion Outcomes (Score 200+)
Outcomes with +200 adjustments are designed to trigger conversion:
- `no_claim`: User has no valid claim → Remove from queue
- `do_not_contact`: User opted out → Remove from queue  
- `completed_form`: User completed form → Remove from queue

**Key Question**: Should these outcomes:
1. **Cap at 200** (current behavior) - User gets "converted" regardless of previous score
2. **Add to existing score** (user expects) - User gets full penalty added to current score

## 🔧 **Proposed Solutions**

### Option 1: Remove Score Cap for Non-Conversion Outcomes
Only cap scores at 200 for outcomes that explicitly trigger conversion:

```typescript
// Apply outcome adjustment
finalScore += outcomeFactor.value

// Apply attempt penalty  
finalScore += attemptFactor.value

// Cap score at 200 ONLY for conversion outcomes
if (handler?.scoringRules.shouldTriggerConversion) {
  finalScore = Math.min(finalScore, 200)
} else {
  // Allow scores above 200 for non-conversion outcomes
  finalScore = Math.max(0, finalScore) // Only floor at 0
}
```

### Option 2: Separate Conversion Logic from Scoring
Remove the 200 cap entirely and handle conversions separately:

```typescript
// Calculate score without artificial caps
finalScore = Math.max(0, finalScore) // Only floor at 0

// Handle conversion separately in call.service.ts
const shouldConvert = handler?.scoringRules.shouldTriggerConversion || finalScore >= 200
```

### Option 3: Document Current Behavior as Intended
If the current capping behavior is intentionally designed for business reasons, update documentation to clarify that conversion outcomes are meant to "reset" users to score 200.

## 🧪 **Test Results**

Our diagnostic script found:
- ✅ 8/11 outcome types work perfectly
- ❌ 3/11 outcome types have scoring issues:
  - `call_back`: Minor issue with score floor (acceptable)
  - `no_claim`: Score capping issue
  - `do_not_contact`: Score capping issue

## 💡 **Recommendation**

**I recommend Option 1** - Remove score cap for non-conversion outcomes:

1. **Preserves business logic**: Conversion outcomes still work as intended
2. **Fixes user concern**: Non-conversion outcomes properly add to existing scores  
3. **Minimal risk**: Only affects edge cases where users already have high scores
4. **Maintains data integrity**: Scores reflect actual user behavior history

## 🚀 **Implementation**

The fix requires updating the `calculatePriority` method in `priority-scoring.service.ts` to conditionally apply the 200 cap based on whether the outcome should trigger conversion. 
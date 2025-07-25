# HUME TTS API FORMAT FIX - IMPLEMENTATION PLAN

## 🎯 GOAL: Fix Hume TTS API format to restore call functionality

### Phase 4: Code Changes (Estimated: 2 hours)

#### Step 4.1: Fix API Request Format
**File**: `modules/ai-voice-agent/services/hume-tts.service.ts`
**Lines to Change**: 40-52

```typescript
// CURRENT (WRONG)
body: JSON.stringify({
  utterances: [utterance],
  format: 'wav'
})

// CHANGE TO (CORRECT)
body: JSON.stringify({
  text: text.trim(),
  voice: this.voiceId ? { id: this.voiceId } : undefined,
  description: !this.voiceId ? this.voiceDescription : undefined,
  format: "wav",
  speed: 1.0
})
```

#### Step 4.2: Fix Response Parsing
**File**: Same file, lines 58-65

```typescript
// CURRENT (WRONG)
const generation = response.generations[0];
return {
  audio: generation.audio,
  generationId: generation.generation_id
};

// CHANGE TO (CORRECT)
return {
  audio: response.audio,
  generationId: response.id || `gen_${Date.now()}`,
  duration: response.duration || 1000,
  isComplete: true
};
```

#### Step 4.3: Remove Unused HumeClient SDK
Since we're using direct fetch, remove the SDK dependency:

```typescript
// REMOVE
import { HumeClient } from 'hume';
private hume: HumeClient;
this.hume = new HumeClient({ apiKey });
```

### Phase 5: Testing Plan

#### Step 5.1: Local Testing
1. Test TTS service in isolation
2. Verify audio generation works
3. Check audio format compatibility

#### Step 5.2: Staging Testing  
1. Deploy to staging environment
2. Test full call flow
3. Verify audio playback quality
4. Check μ-law conversion

#### Step 5.3: Production Validation
1. Deploy with monitoring
2. Test with real phone call
3. Monitor error rates
4. Have rollback ready

### Phase 6: Deployment Strategy

#### Step 6.1: Gradual Rollout
```bash
# Option 1: Immediate fix (recommended)
git add -A
git commit -m "fix: Correct Hume TTS API format and response parsing"
npx vercel --prod

# Option 2: Staged rollout (if nervous)
# Deploy with AI disabled first, then enable
```

#### Step 6.2: Monitoring
- Watch Vercel logs for TTS errors
- Monitor call completion rates  
- Check audio quality reports
- Ready to disable AI if issues persist

### Rollback Plan
If issues occur:
1. Set `shouldUseAIAgent()` to return `false`
2. Deploy immediately  
3. All calls route to human agents
4. Debug offline

### Success Criteria
- ✅ Hume TTS API calls succeed (200 status)
- ✅ Audio files generated successfully
- ✅ Calls complete without TTS errors
- ✅ Audio quality is acceptable
- ✅ No increase in call failure rate 
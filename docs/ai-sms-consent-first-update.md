## AI SMS: Consent-First Conversational Update

### Summary
- Shifted Sophie to a consent-first, less pushy style.
- Sends portal links only on explicit request, with a cooldown to avoid repeats.
- Prompts emphasize offering choices and answering questions before nudging.

### Changes
1) Prompts
- Updated `modules/ai-agents/prompts/system.base.ts`:
  - Removed emoji allowance; added permission-based tone.
  - Actions now say “offer link and ask first; prefer choices.”
- Updated `modules/ai-agents/prompts/sms.policy.ts`:
  - Added “ask permission before sending links” and “offer choices.”
  - Removed obsolete tools; allowed: `send_sms`, `send_magic_link`, `none`.
- Updated `modules/ai-agents/prompts/examples.ts`:
  - Few-shots rewritten to model consent-first phrasing.
- Updated `modules/ai-agents/core/prompt-builder.ts`:
  - Output guidance now: “Ask permission before sending links and prefer offering choices.”

2) Runtime behavior
- File: `modules/ai-agents/core/agent-runtime.service.ts`
  - Tightened heuristic: link is sent only on explicit user request (send/resend/text/share + portal/link).
  - Removed implicit “reply implies sending” heuristic.
  - Added link send cooldown (default 60 minutes) via memory.

3) Memory store
- File: `modules/ai-agents/core/memory.store.ts`
  - Added `getLastLinkSentAt`, `setLastLinkSentAt` to track per-number cooldown.

### Env / Config
- `AI_SMS_LINK_COOLDOWN_SECONDS` (optional): seconds between allowed portal link sends; default 3600.

### Expected Impact
- More human, less pushy: users get answers first and are offered choices.
- Fewer duplicate links: explicit consent + cooldown reduces spammy feel and SMS costs.
- Clearer logs: link sends happen only when intent is explicit.

### QA Checklist
- Unsigned asks “Is it safe?” → reply explains safety, asks if they want the portal link; no auto-send.
- User says “send me the link” → link sent from test number; respect cooldown thereafter.
- Hesitant user asks multiple questions → no repeated offers each turn; only occasional, choice-based offers.
- STOP → still acknowledged immediately; no further messages.



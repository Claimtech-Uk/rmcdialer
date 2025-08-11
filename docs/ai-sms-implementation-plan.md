### AI SMS implementation plan (aligned with `@aismsplan.mdc`)

Goal: evolve the current AI SMS into a multi‑agent, profile‑aware, consent‑first system that follows sticky sessions, compliance rules, and clear telemetry—without large rewrites. Work in small, verifiable steps until the agent behaves exactly as planned.

### Current state snapshot
- Profiles: scaffolded (`customer_service`, `unsigned_chase`, `requirements`, `review_collection`) with prompt addenda.
- Router + sessions: Redis‑backed sticky sessions with TTLs; simple goal completion checks.
- Prompt stack: system + policy + knowledge digests + examples; strict JSON (`AssistantTurn`).
- Actions: `send_magic_link`, `send_sms` (with link cooldown), reply formatting, STOP handling, PII redaction, loop prevention.

### Gaps vs plan (high level)
- No cadence/business-hours dispatcher; no ResponsePlan guards; limited telemetry; review monthly throttle only scaffolded; no complaint/abuse taxonomy; no KB IDs; no per‑profile examples and policies; no event bus hooks.

### Work plan (phased, small edits)

#### Phase 1 — Routing and prompts (done/partial)
- [x] Add Redis session store `modules/ai-agents/core/session.store.ts`.
- [x] Add router `modules/ai-agents/channels/sms/router/sms-agent-router.ts` with TTLs and goal detection.
- [x] Add minimal profiles and wire prompt addendum in `agent-runtime.service.ts` → `buildSystemPrompt(addendum)`.
- [x] Add route decision logs: “AI SMS | 🧭 …”.

Output: profile‑aware replies with sticky session selection that won’t break existing flows.

#### Phase 2 — Profile quality and examples
- [ ] Expand per‑profile tone/goals/examples:
  - `agents/*profile.ts`: add concise objectives and 2–3 examples each.
  - `prompts/examples.ts`: split per profile (or embed addenda in profile files).
- [ ] Update `system.base.ts` to defer to profile goals when present (no duplication).

Output: clearer guidance for model, less pushiness, better topic control per agent.

#### Phase 3 — Review monthly throttle and end‑of‑flow
- [x] Add helpers `getLastReviewAskAt`/`setLastReviewAskAt` in `memory.store.ts`.
- [ ] In runtime, when route.type === `review_collection`:
  - Check 30‑day throttle before offering link.
  - On successful link send action, immediately call `completeSession(phone)`.

Output: review flow respects monthly limit and ends cleanly after link.

#### Phase 4 — Minimal telemetry (per turn)
- [ ] Emit one structured log on every turn (server‑only):
  - `{ phone, agentType, reason, actions: [...], goalClosed?: bool }`.
  - Location: end of `sms-agent.service.ts` turn handling.
- [ ] Add counters (optional): simple Redis `INCR` keys per action type.

Output: traceability for A/B and debugging without DB migrations.

#### Phase 5 — Complaint/abuse detection and safe handoff
- [ ] Add `containsComplaintIntent`/`containsAbuseIntent` in `core/guardrails.ts`.
- [ ] In webhook or runtime, if detected:
  - Stop automation for 24h (Redis key `sms:halt:{phone}` with TTL),
  - Send a brief de‑escalation/ack message,
  - Log “needs human follow‑up”.

Output: aligned with escalation rules in the plan.

#### Phase 6 — Cadence and business‑hours (MVP, no migrations)
- [ ] Add simple “business hours” guard (08:00–20:00 Europe/London) for AI‑initiated follow‑ups (we currently reply to inbound immediately; keep that).
- [ ] Introduce minimal follow‑up scheduler stub (Redis + cronless delay):
  - Store `sms:followup:{phone}` with `{ at, text, type }` and check at turn start; if due and inside hours, send and clear.
  - Used by profiles to set the “ladder” (e.g., 2h CS close, 24h unsigned).

Output: basic cadence without new infra; respects hours and cancel‑on‑inbound.

#### Phase 7 — Output contract evolution (incremental)
- [ ] Extend `AssistantTurn` gradually toward `ResponsePlan`:
  - Add optional `plan_version`, `guards.business_hours`, `analytics.labels` in model output (non‑breaking; tolerate absence).
  - Validate presence when present; otherwise fall back to current behavior.

Output: prepares migration to full planner/dispatcher contract while keeping compatibility.

#### Phase 8 — Knowledge base indexing and IDs
- [ ] Add stable KB IDs to `knowledge-index.ts` and reference in prompts.
- [ ] Emit `kb_ids_used: []` in telemetry when we answer from a KB snippet.

Output: consistent copy and compliance traceability.

#### Phase 9 — Tests & QA
- [ ] Golden tests for prompt → output shape (snapshots) per profile.
- [ ] E2E happy paths (local script): unsigned ask → consent → link; requirements prompt → upload guidance; review ask → throttle.
- [ ] Log assertions: ensure route logs and telemetry appear.

#### Phase 10 — Rollout
- [ ] Feature flag per profile activation.
- [ ] Shadow mode for telemetry only (no follow‑ups) → then enable follow‑ups.
- [ ] Monitor reply rate, opt‑outs, complaints, duplicate sends.

### File map (touch list)
- Routing: `modules/ai-agents/channels/sms/router/sms-agent-router.ts` (keep small, pure functions).
- Sessions: `modules/ai-agents/core/session.store.ts` (Redis only).
- Profiles: `modules/ai-agents/channels/sms/agents/*.profile.ts` (short addenda + examples).
- Runtime: `modules/ai-agents/core/agent-runtime.service.ts` (profile addendum, review throttle, telemetry callouts).
- Guardrails: `modules/ai-agents/core/guardrails.ts` (STOP, complaint, abuse).
- Memory: `modules/ai-agents/core/memory.store.ts` (cooldowns, throttles, short summaries).
- Prompts: `modules/ai-agents/prompts/*.ts` (keep global system lean; push specifics into profiles).

### Acceptance criteria
- Sticky sessions: unsigned/requirements/review threads remain on track until goal met or TTL.
- Consent‑first: links only on explicit request; review link only once per month.
- Business hours guard for proactive follow‑ups; cancel on inbound; respect STOP immediately.
- Telemetry present per turn with agentType, actions, and outcomes.
- Tests pass; production logs show “AI SMS | 🧭 …” and telemetry entries for each turn.

### Operational notes
- No DB migrations; Redis keys documented above.
- Ensure env vars: `MAIN_APP_URL`, `AI_SMS_LINK_COOLDOWN_SECONDS`, `TZ=Europe/London` (for business hours), `AI_SMS_TEST_NUMBER`.

---

Use this file as the running checklist. We’ll tick items as we ship each slice.



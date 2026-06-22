# Aavtaar AI-Calling Integration — Design & Implementation Plan

> Status: **DRAFT for review.** Nothing here is built yet. This document is the
> design + phased plan for integrating Aavtaar.ai's autonomous AI voice agent
> into the lead CRM, driven by the existing workflow engine.
>
> Legend: ✅ confirmed against code/docs · 🟡 assumed, confirm at build time ·
> ⛔ blocked on a vendor answer.

---

## 0. TL;DR — the decisions that shape everything

1. **Aavtaar is an autonomous AI voice agent, not a bridge dialer.** It is
   **Plivo-backed** (recording URLs on Plivo DigitalOcean Spaces, Plivo
   `hangupCause` codes, `call_uuid`). It dials one leg (the lead) and an AI
   persona ("Aarushi") talks. There is **no counsellor leg** to bridge, unlike
   Exotel/Vonage. Transfer-to-human is **DTMF "press 9"**, handled provider-side.
2. **The call outcome arrives via a webhook we must build** — not from the
   `click-to-call` HTTP response (that returns a free-text string). The webhook
   carries disposition, lead rating, AI summary, extracted Q&A, recording URL,
   callback time, and transfer signals.
3. **It is driven by the existing workflow engine as a re-entrant, phase-routed
   state machine.** This is forced by one engine fact: `WorkflowResumeJob`
   resumes a paused execution by calling `workflowEngineService.run(...)`, which
   **restarts from the start node** and re-evaluates routing against the updated
   context. So every side-effect node must be guarded, and a start `ROUTER` reads
   a `phase` context variable to jump to the right branch. (Same pattern the
   existing `DELAY` node already relies on.)
4. **Policy is configuration, the graph is fixed.** The workflow DAG routes on a
   small, stable set of outcome **buckets** (GOOD / CALLBACK / NEUTRAL / BAD /
   NO-CONNECT). Everything variable — which disposition maps to which bucket,
   what status to set, which pool to assign, the retry numbers — lives in a
   per-institute `AI_CALLING_SETTING` JSON read at runtime. One workflow, every
   institute, business-user editable.
5. ⛔ **One linchpin vendor question:** does the **outbound** webhook echo back
   the `metadata{}` we send on `click-to-call`? That is our correlation path to
   the paused execution. We will build with a `provider_call_id` / phone
   fallback so we are not blocked, but this must be confirmed.

---

## 1. Goal & scope

### In scope (v1)
- **Outbound AI-calling workflow**: trigger → AI call → on outcome, assign a
  counsellor (good response) or retry within a calling window/daily-cap (no
  answer / incomplete), then mark a terminal status.
- **Inbound AI-sales recording**: receive inbound call webhooks, match/create the
  lead, enrich with the AI's extracted Q&A + summary, set status, route to a
  counsellor for follow-up.
- **Configurable policy** per institute (disposition→action mapping, retry policy,
  statuses, assignment).
- Persisting every call + its AI outcome against the lead (audit + UI).

### Out of scope (v1, revisit later)
- Bulk-contact-upload campaign dispatch via `/upload-contacts` (we start with
  per-lead `click-to-call`).
- Programmatic mid-call transfer control (transfer is DTMF press-9, provider-side).
- A visual workflow-builder UI for the AI nodes (we seed the template; editing the
  policy is via the settings screen, not the DAG).

---

## 2. Provider model — Aavtaar.ai (Plivo-backed)

### 2.1 Documented APIs ✅
Base: `https://webapi.aavtaar.ai/api/v1/partner/<CompanyCode>/` (e.g.
`partner/shikshanation/`). Headers on all: `Content-Type: application/json`,
`Authorization: Bearer <token>`, `CampaignId: <id>`.

| API | Method / path | Notes |
|---|---|---|
| Click-to-Call | `POST .../click-to-call` | body: `phoneNumber`*, `customerName`, `customerEmail`, `campaignId`*, `metadata{}` (arbitrary). Response `data` is a **free-text string** (`"1 call - queued: 1"`) — unusable as an id. |
| Bulk Upload | `POST .../upload-contacts` | body: `listName`, `data[]{number*, firstName, middleAndLastName, metadata{}}`. Returns `{contactlistId, totalContactsReceived, totalValidContactsAdded, totalInvalidContactsSkipped}`. Out of v1 scope. |
| Unsubscribe | mentioned, **undocumented** | spec to be obtained from vendor. |

### 2.2 Auth & creds ✅/🟡
- Bearer token is per-environment, long-lived JWT (HS256). `CompanyCode` is in the
  URL path; `CampaignId` selects the AI script/persona.
- ⚠️ A **live production Bearer JWT for Shiksha Nation was shared in a doc/chat** —
  it must be **rotated** before go-live and stored encrypted (never in the repo).

### 2.3 The webhook — call status + inbound metadata 🟡
This is the heart of the integration. The sample we have was a **pandas/Excel
export** (literal `NaN`, a `"Customer Name.1"` duplicate-column suffix, Title-Case
keys) — i.e. a multi-row report, **not** the real-time per-call POST body. ⛔ **We
must obtain the actual webhook JSON contract** (single-call object, exact key
names/types, `null` not `NaN`, timestamp timezone, signing). The *fields*, however,
are clear and rich. Observed payload (one call):

| Field (sample) | Meaning | Maps to |
|---|---|---|
| `call_uuid` | Plivo call id (stable) | `telephony_call_log.provider_call_id` |
| `Phone Number` + `Dial Code` | caller/callee | lead lookup / `to_number` |
| `Campaign Type` (`inbound`) | direction | `telephony_call_log.direction` |
| `Status` (`completed`) | call status | `CallStatus` (need full outbound vocab ⛔) |
| `Duration` (seconds, float) | talk time | `duration_seconds` |
| `Call Start` (`19-06-2026 11:56 AM`) | start (no tz ⛔) | `start_time` |
| `Disposition` / `Lead Response` | **conversational outcome** | `ai_call_result.disposition` → policy bucket |
| `Lead Rating` / `Call Rating` (4–9) | AI lead score | `ai_call_result.lead_rating` → `lead_tier` |
| `Lead Summary` / `Call Summary` | AI summary | counsellor handoff note |
| `Child's Class`, `…Percentage`, `Weak Subjects`, `Program Discussed`, `Key Concern`, `Customer Interest Level`, … | **extracted Q&A** | `ai_call_result.extracted_qa` (jsonb) |
| `Callback` / `Callback Timestamp` (`2026-06-19T16:00:00+0530`) / `Callback Time` | callback request | retry/callback scheduling |
| `transfer_call`, `nine_pressed`, `transfer_status`, `Transfer Triggered` | human handoff | `ai_call_result.transfer_*` |
| `hangupCause` / `hangupCauseCode` (4000, 4010) / `hangupSource` | Plivo termination | `termination_reason` |
| `Recording URL` | Plivo DO Spaces mp3 | `recording_url` → copy to our S3 |
| `Call Transcript` | (was `NaN` in all samples) | `ai_call_result.transcript` if available ⛔ |

Observed `Disposition` vocabulary: `Interested`, `Likely_Interested`, `Callback`,
`Not_Interested`, `Requirement_Not_Clear`, `Incomplete`. (Open/extensible — the
policy has a default bucket for unmapped values.)

### 2.4 Transfer = DTMF press-9 ✅
The lead presses **9** during the AI call to be transferred to a human; Aavtaar/Plivo
handles the bridge. We do **not** orchestrate transfer via API — we only **observe**
`nine_pressed` / `transfer_status` in the webhook. (Open: which number press-9
routes to, and whether it can be set per-call/lead — §15.)

### 2.5 Recording = Plivo DO Spaces 🟡
URLs look like `https://plivo-recordings.blr1.digitaloceanspaces.com/…/<call_uuid>.mp3`
and appear **publicly readable**. ⚠️ Compliance: these are recordings of parents
discussing minors — a public URL is a PII exposure. Plan: **pull and re-store
privately** in our `media_service` S3 on receipt (reusing
`RecordingPersistenceService`), regardless of the URL's TTL/auth.

### 2.6 Open vendor questions (⛔ tracked in §15)
Outbound `metadata` echo; full outbound `Status` vocabulary (no-answer / busy /
failed); real webhook JSON schema + signing + retries; recording URL auth/TTL;
press-9 transfer target; unsubscribe/DNC spec.

---

## 3. Architecture — how it fits

### 3.1 Telephony side (reuse the provider abstraction) ✅
We add a new provider under the existing SPI rather than a parallel stack:
- New adapter package `features/telephony/providers/aavtaar/` (mirrors
  `providers/exotel/`).
- Add `AAVTAAR` to the provider type enum; register in `TelephonyProviderRegistry`.
- Reuse `telephony_call_log` (generic), `RecordingPersistenceService`,
  `TokenEncryptionService`, and the webhook-controller dispatch pattern.
- Aavtaar-specific outcome fields live in a **sibling table `ai_call_result`** (1:1
  with `telephony_call_log`) so the generic call log stays provider-agnostic — per
  the "generic core never reads provider-specific data" rule in
  `EXOTEL_CALL_INTEGRATION.md` §2.3.

### 3.2 Workflow side — the re-entrancy constraint ✅ (critical)
Verified mechanics (`features/workflow`):
- `NodeHandler.handle(Map<String,Object> context, String nodeConfigJson,
  Map<String,NodeTemplate> nodeTemplates, int countProcessed) → Map` — returned map
  is merged into context via `ctx.putAll(changes)`.
- **Pause** = a handler returns `{"__workflow_paused": true}` after persisting a
  `WorkflowExecutionState{executionId, pausedAtNodeId, serializedContext (jsonb),
  resumeAt, pauseReason, status:"WAITING"}` and setting the `WorkflowExecution`
  to `PAUSED`. (This is exactly what `DelayNodeHandler` does.)
- **Resume** = `WorkflowResumeJob` polls `status='WAITING' AND resumeAt<=now`,
  restores `serializedContext`, and calls
  `workflowEngineService.run(workflowId, resumeContext)` — which **starts from the
  start node and re-evaluates all CONDITION/ROUTER routing** against the updated
  context. The next node is **not** fixed at pause time.
- Handlers `@RequiredArgsConstructor`-inject Spring services (proven by
  `CombotNodeHandler`, `SendEmailNodeHandler`, `UpdateRecordNodeHandler`), so our
  nodes can call `CounselorAssignmentService` / `LeadStatusService` directly.

**Consequence:** the AI-calling workflow is modelled as a **re-entrant state
machine**. A start `ROUTER` inspects `ctx.phase` (+ presence of `ctx.callOutcome`)
and routes to the correct branch; every side-effect node is idempotent/guarded so
re-running from the start node is safe.

### 3.3 The one new engine capability — webhook→resume bridge
Today the engine only resumes by **time**. We add **resume-by-event**: the Aavtaar
webhook controller loads the paused `WorkflowExecutionState` (by our correlation
id = `executionId`), merges the outcome into context, and calls the **same**
`workflowEngineService.run(...)` that `WorkflowResumeJob` uses, then marks the state
`RESUMED`. The `resumeAt` safety-timeout stays armed so a missing webhook is
reconciled by the time-based job (which can then pull a GET-status if the vendor
exposes one). This is additive — no change to existing time-based resume.

---

## 4. The outbound AI-calling workflow

### 4.1 Context shape (persisted in `serializedContext`)
```
leadId, userId, phone, campaignId, instituteId,
phase            : "NEW" | "DIALING" | "WAITING" | "RETRY" | "DONE"
attempt          : int
callOutcome      : { disposition, status, durationSec, callbackAt, rating,
                     summary, qa{} }   // injected by the webhook on resume
// resolved by EVALUATE from AI_CALLING_SETTING:
bucket, targetStatus, assignMode, assignPoolId, doRetry, doEnrich
```

### 4.2 The node graph
```
TRIGGER (lead enters "AI-calling" pool / manual) → seed ctx{phase:NEW, attempt:0} → run()
        │
        ▼
① START ROUTER          callOutcome present → ⑤ EVALUATE
                        phase NEW|RETRY      → ② PRE-DIAL GATE
                        phase DONE           → END
        │
        ▼
② PRE-DIAL GATE         opted-out/DNC?       → ⑦ SET_STATUS(opt-out) → END
                        attempt ≥ maxRetries → ⑧ EXHAUSTED
                        outside window/over cap → ⑥ PAUSE-until(next slot) → resume →①
                        eligible             → ③ CALL_AI
        │
        ▼
③ CALL_AI (NEW)         POST click-to-call{phone,campaignId,
                          metadata:{correlationId:executionId, attempt}}
                        upsert telephony_call_log(AAVTAAR,OUTBOUND,INITIATED,
                          workflow_execution_id)
                        ctx{phase:WAITING, attempt++, callOutcome:null}
        │
        ▼
④ WAIT_CALL_OUTCOME(NEW) persist WorkflowExecutionState(pauseReason:AI_CALL_WAIT,
                          resumeAt: now+20m SAFETY); return __workflow_paused
        ⋮  (parked)
   webhook → BRIDGE: merge ctx.callOutcome, run() → re-enters ①
        │
        ▼
⑤ EVALUATE (NEW)        read AI_CALLING_SETTING → resolve bucket + action params:
   axis1: status≠completed OR durationSec<connectThreshold → NO-CONNECT
   axis2: disposition → GOOD | CALLBACK | NEUTRAL | BAD (else defaultBucket)
        │
        ▼  ROUTER on ctx.bucket
   GOOD     → ⑨ ENRICH → ⑦ SET_STATUS → ⑩ ASSIGN_COUNSELLOR → notify(+WhatsApp) → DONE
   CALLBACK → ⑨ ENRICH → ⑦ SET_STATUS → ⑥ PAUSE-until(callbackAt) phase:RETRY → ①
   NEUTRAL  → attempt<max ? ⑥ PAUSE-until(next slot) phase:RETRY → ① : ⑧ EXHAUSTED
   BAD      → ⑦ SET_STATUS(Not interested) → DONE
   NO-CONNECT → attempt<max ? ⑥ PAUSE-until(next slot+backoff) phase:RETRY → ① : ⑧ EXHAUSTED

⑧ EXHAUSTED  → ⑦ SET_STATUS("AI no-answer exhausted") → (opt) ⑩ ASSIGN_COUNSELLOR → DONE
```

### 4.3 New node types
Add to `NodeType`: **`CALL_AI`**, **`WAIT_CALL_OUTCOME`**. The branch/router logic
reuses the existing `ROUTER`/`CONDITION` node types (SpEL on `#ctx['bucket']`).
Assignment / status / enrich are implemented as new handler beans (`ASSIGN_COUNSELLOR`,
`SET_LEAD_STATUS`, `ENRICH_LEAD`) that call existing services — or, where a plain
field write suffices, as `UPDATE_RECORD` nodes. `EVALUATE` is a new handler that
resolves policy into context.

---

## 5. Configurable policy — `AI_CALLING_SETTING`

### 5.1 The bucket model
The DAG branches only on five **stable buckets**. The mapping from Aavtaar
dispositions to buckets, and the action for each, is **per-institute config** read
at runtime by the `EVALUATE` node. New/unknown dispositions fall to `defaultBucket`.

### 5.2 JSON schema (stored in the institute setting envelope) 🟡
```jsonc
{
  "campaign": { "companyCode": "shikshanation", "campaignId": "6a34fb1f…" },
  "connectThresholdSec": 20,
  "retry": { "maxRetries": 3, "backoff": ["PT3H","P1D","P1D"],
             "window": { "start": "09:00", "end": "21:00", "tz": "Asia/Kolkata" },
             "maxCallsPerDayPerLead": 3 },
  "defaultBucket": "NEUTRAL",
  "rules": [
    { "dispositionIn": ["Interested","Likely_Interested"], "bucket": "GOOD",
      "actions": { "setStatus": "AI Qualified",
                   "assign": { "mode": "ROUND_ROBIN", "poolId": "…" },
                   "enrich": true, "whatsapp": { "template": "…" } } },
    { "dispositionIn": ["Callback"], "bucket": "CALLBACK",
      "actions": { "setStatus": "Callback scheduled",
                   "callback": { "mode": "AI", "fallback": "HUMAN" } } },
    { "dispositionIn": ["Incomplete","Requirement_Not_Clear"], "bucket": "NEUTRAL",
      "actions": { "retry": true,
                   "onExhaust": { "setStatus": "Needs human", "assign": { "mode": "ROUND_ROBIN" } } } },
    { "dispositionIn": ["Not_Interested"], "bucket": "BAD",
      "actions": { "setStatus": "Not interested", "stop": true } }
  ],
  "noConnect": { "retry": true,
                 "onExhaust": { "setStatus": "AI no-answer exhausted", "assign": { "mode": "ROUND_ROBIN" } } },
  "leadRatingToTier": [ { "min": 8, "tier": "HOT" }, { "min": 6, "tier": "WARM" }, { "min": 0, "tier": "COLD" } ]
}
```

### 5.3 Outcome → action defaults (the reviewed table)
| Disposition | Bucket | Action |
|---|---|---|
| `Interested`, `Likely_Interested` | GOOD | Assign counsellor, status "AI Qualified" |
| `Callback` (+ timestamp) | CALLBACK | Re-call at requested time (AI), fallback human |
| `Incomplete`, `Requirement_Not_Clear` | NEUTRAL | Retry (limited), then assign to human |
| `Not_Interested` | BAD | Status "Not interested", stop |
| `status≠completed` or `duration<20s` | NO-CONNECT | Retry w/ backoff until max, then "exhausted" |

### 5.4 Retrial policy defaults
`maxRetries: 3` · `backoff: +3h, +1d, +1d` · `window: 09:00–21:00 Asia/Kolkata` ·
`maxCallsPerDayPerLead: 3` · `connectThresholdSec: 20` · exhausted leads assigned to
a human. Window + cap are enforced at the **pre-dial gate** on every (re-)entry.

### 5.5 Status catalog linkage
`setStatus` values reference the institute's existing `LeadStatus` catalog. We
**provision the AI statuses once** per institute (AI Qualified / Callback scheduled /
Needs human / AI no-answer exhausted / Not interested) so the settings UI offers them
as a dropdown. Status writes go through `LeadStatusService` (records history, emits
`LEAD_STATUS_CHANGED`, mirrors to `user_lead_profile` — note the dual-store).

### 5.6 Mid-flight edit semantics
Because policy is read at runtime (not baked into the paused execution), an edit
applies to in-flight leads **on their next step**. Default: **latest config wins**.
Optional: snapshot the policy into `serializedContext` at trigger time to pin a run
(flag `pinPolicyAtStart`).

---

## 6. The webhook receiver & correlation

### 6.1 Endpoint
`POST /admin-core-service/v1/telephony/webhook/aavtaar` (+ `?corr=` optional). Verify
the vendor signature (⛔ scheme TBD); accept and persist regardless, normalize, then act.

### 6.2 Normalization
`AavtaarPayloadNormalizer`: payload → `NormalizedCallEvent` (generic call-log fields)
+ `AiCallResult` (Aavtaar-specific). Upsert `telephony_call_log` by `call_uuid` using
the existing rank-ordered, idempotent `applyEvent` so duplicate/out-of-order
deliveries can't regress state.

### 6.3 Correlation resolution
- **Outbound**: read our `correlationId` (= `executionId`) echoed in `metadata` ⛔.
  Fallback: match `telephony_call_log` by `provider_call_id`; last resort, by
  `to_number` + recent INITIATED row.
- **Inbound**: match the lead by phone; create a new lead if unknown (§7).

### 6.4 Resume bridge
If the call is workflow-driven, load the paused `WorkflowExecutionState` by
`executionId` + `status='WAITING'`, build `resumeContext = serializedContext +
{callOutcome}`, call `workflowEngineService.run(workflowId, resumeContext)`, mark
state `RESUMED`. Idempotent: if already `RESUMED`, ignore. Always upsert the call
log + recording even when there is no workflow (record-only).

---

## 7. Inbound AI-sales flow
No retrial loop (the AI answered; press-9 transfer already happened provider-side).
On an inbound webhook: upsert `telephony_call_log` (`direction=INBOUND`) →
**match-or-create** the lead by phone → `ENRICH` with Q&A/summary/rating → set status
by disposition → if GOOD or a transfer was attempted, assign/notify a counsellor for
follow-up. Optionally fire a lightweight `INBOUND_AI_CALL` workflow trigger so the
same configurable policy applies. Inbound uses the same normalizer + `ai_call_result`.

---

## 8. Data model — Flyway migrations (DB schema via migrations only)

> Next free version (current head ≈ `V336`, **verify** at build time).

**8.1 `institute_ai_calling_config`** — encrypted creds + defaults
```
id PK, institute_id FK, company_code, api_token_enc, default_campaign_id,
webhook_secret_enc, enabled bool, created_at, updated_at
```
Reuses `TokenEncryptionService` (AES-256-GCM) and a Caffeine config cache (mirror
`TelephonyConfigCache`).

**8.2 `ai_call_result`** — 1:1 with `telephony_call_log`
```
id PK, call_log_id FK UNIQUE, disposition, lead_response, lead_rating int,
call_rating int, interest_level, ai_summary text, extracted_qa jsonb,
callback_requested bool, callback_at timestamptz, transfer_attempted bool,
nine_pressed bool, transfer_status, hangup_cause, hangup_source,
campaign_type, transcript text, created_at, updated_at
```

**8.3 `telephony_call_log` extension** — `ADD COLUMN workflow_execution_id` (nullable;
links a workflow-driven call to its execution for the resume bridge). Add `AAVTAAR`
to the provider-type enum/values.

**8.4 Settings** — `AI_CALLING_SETTING` lives in the institute setting JSON envelope
(no migration). New `SettingKeyEnums` entry + optional strategy handler.

---

## 9. Credentials & security/compliance
- **Rotate** the leaked Shiksha Nation Bearer JWT; store the new one encrypted.
- **Recordings**: pull-and-store privately in `media_service` S3 on receipt; never
  surface the public DO Spaces URL to the UI (PII — minors).
- **DNC/consent**: pre-dial gate checks our opt-out flag; obtain the vendor
  unsubscribe spec and (ideally) a DNC pre-check; honor the 09:00–21:00 IST window.
- **Webhook auth**: verify the vendor signature (⛔ scheme TBD) before acting.
- **Idempotency**: `click-to-call` is a real-money side effect; key each attempt
  (executionId+attempt) so retries/replica double-fires don't double-dial.

---

## 10. Reuse vs build

| Area | Reuse | Build |
|---|---|---|
| Engine | pause/resume, `WorkflowExecutionState`, `WorkflowResumeJob`, `run()`, ROUTER/CONDITION, context persistence, idempotency | `CALL_AI` + `WAIT_CALL_OUTCOME` handlers; **webhook→resume bridge**; `EVALUATE` policy handler |
| Telephony | `telephony_call_log`, provider registry/SPI, `RecordingPersistenceService`, webhook dispatch | `AavtaarClient`, `AavtaarWebhookController`, `AavtaarPayloadNormalizer`, `AAVTAAR` provider type, `ai_call_result` |
| Lead | `CounselorAssignmentService`, `LeadStatusService`, `LeadAssignmentNotifier`, WhatsApp `COMBOT` node | workflow-callable wrappers (`source=WORKFLOW`); `ENRICH_LEAD` writer; AI status provisioning |
| Scheduling | DELAY-style pause + `WorkflowResumeJob` | `CallingWindowService` (tz + window + daily-cap "next eligible slot") |
| Config | institute setting JSON, `TokenEncryptionService`, config cache | `institute_ai_calling_config`, `AI_CALLING_SETTING` + `AiCallingPolicyService` |

---

## 11. Implementation plan (phases + file manifest)

**Phase 0 — Prereqs (no code).** ⛔ Vendor confirms (§15); rotate + receive prod
creds; obtain sandbox + the real webhook JSON schema.

**Phase 1 — Provider client + webhook receiver (record-only).** Get data flowing
with no workflow yet; testable against the sample payload.
- New: `providers/aavtaar/AavtaarClient`, `AavtaarWebhookController`,
  `AavtaarPayloadNormalizer`, `AavtaarCallWebhookHandler`.
- New entity/repo: `AiCallResult` / `ai_call_result`.
- Modify: provider-type enum (`AAVTAAR`); `telephony_call_log.workflow_execution_id`.
- Migration: `institute_ai_calling_config`, `ai_call_result`, call-log column.

**Phase 2 — Settings + AI statuses.**
- `SettingKeyEnums.AI_CALLING_SETTING` + DTO + `AiCallingPolicyService` (load/parse/cache).
- `institute_ai_calling_config` CRUD controller (encrypted creds).
- AI `LeadStatus` provisioning per institute.

**Phase 3 — AI-call node + wait node + resume bridge.**
- `NodeType`: `CALL_AI`, `WAIT_CALL_OUTCOME`.
- `CallAiNodeHandler`, `WaitCallOutcomeNodeHandler`.
- `WorkflowExecutionStateRepository.findFirstByExecutionIdAndStatus(...)`.
- Wire `AavtaarWebhookController` → resume bridge (idempotent); extend
  `WorkflowResumeJob` safety-timeout reconcile path.

**Phase 4 — EVALUATE + policy + action nodes.**
- `EvaluateOutcomeNodeHandler` (resolves bucket + action params from policy).
- `AssignCounsellorNodeHandler`, `SetLeadStatusNodeHandler`, `EnrichLeadNodeHandler`.
- Expose `CounselorAssignmentService.assignForWorkflow(...)` +
  `LeadStatusService.changeStatus(source=WORKFLOW)`.

**Phase 5 — Retrial scheduling (window + cap) + callback.**
- `CallingWindowService` (institute tz; next eligible slot; daily cap via call-log count).
- Pre-dial gate; retry pause; honor `Callback Timestamp`.

**Phase 6 — Inbound flow.**
- `AavtaarInboundService` (match-or-create lead, enrich, status, assign/notify);
  optional `INBOUND_AI_CALL` trigger.

**Phase 7 — Frontend + workflow template + rollout.**
- Settings UI (`AI_CALLING_SETTING` + creds) on the institute settings screen.
- Seed the outbound workflow template (node mappings + routes).
- Per-institute feature flag; staged rollout; observability.

---

## 12. Config properties (`application-*.yml`) 🟡
```
aavtaar.base-url: https://webapi.aavtaar.ai/api/v1/partner
aavtaar.webhook.verify-signature: true
aavtaar.call.safety-timeout: PT20M
aavtaar.recording.copy-to-s3: true
```

## 13. REST surface added
- `POST /v1/telephony/webhook/aavtaar` — status + inbound webhook receiver.
- `POST/GET /v1/telephony/ai-config` — per-institute Aavtaar creds + defaults (admin).
- `GET/POST /institute/setting/v1` (existing) — `AI_CALLING_SETTING` read/write.

## 14. Testing
- Replay the sample export rows as synthetic webhook POSTs → assert `telephony_call_log`
  + `ai_call_result` upserts and correct disposition→bucket resolution.
- Workflow: unit-test re-entrancy (resume from start lands on the right branch per
  `phase`/`callOutcome`); idempotent CALL_AI (no double-dial on duplicate resume).
- Window/cap: leads outside window park and resume at the next slot; daily cap blocks.
- Sandbox end-to-end once vendor creds + real webhook are available.

---

## 15. Open questions / decisions to confirm

**For the vendor (⛔):**
1. Does the **outbound** webhook echo our `metadata{}` (correlationId)? *(linchpin)*
2. The **real-time webhook JSON schema** (single-call shape, key names/types, `null`
   not `NaN`, timestamp timezone) + **signing** + retry policy.
3. Full **outbound `Status` vocabulary** (no-answer / busy / failed).
4. **Recording URL** — public or signed/expiring? TTL? auth?
5. **Press-9 transfer target** — fixed per campaign, or settable per call/lead?
6. **Unsubscribe / DNC** spec (and pre-dial DNC check).

**For you (product):**
7. Confirm the §5.3 mapping + §5.4 retry defaults (or adjust).
8. Callback handling: AI re-call at the requested time vs assign a human? (default: AI, fallback human).
9. Mid-flight edits: latest-config-wins vs pin-at-start? (default: latest wins).
10. Assign exhausted/no-answer leads to a human anyway? (default: yes).
11. Counsellor assignment mode + which pool (default: ROUND_ROBIN over the AI-calling pool; honor team-hierarchy scoping).

---

## 16. References (source files)
- Telephony: `features/telephony/{spi,providers/exotel,core,controller,persistence}`;
  `docs/crm/EXOTEL_CALL_INTEGRATION.md`, `docs/crm/VONAGE_VBC_INTEGRATION.md`.
- Workflow engine: `features/workflow/{enums/NodeType, engine/NodeHandler,
  engine/DelayNodeHandler, scheduler/WorkflowResumeJob, service/WorkflowEngineService,
  entity/WorkflowExecutionState, repository/WorkflowExecutionStateRepository}`.
- Lead: `features/counselor_pool/service/CounselorAssignmentService`;
  `features/audience/service/{LeadStatusService, LeadAssignmentNotifier, TokenEncryptionService}`;
  `docs/crm/LEAD_ASSIGNMENT_AND_COUNSELOR_POOLS.md`.
- Settings: `features/institute/service/setting/InstituteSettingService`.

---

## 17. What's implemented (2026-06-20) + how to test

### Implemented
- **Provider abstraction (SOLID/OCP)**: ports `AiOutboundCaller` + `AiCallReportParser` (+ neutral DTOs `AiCallSpec`/`AiCallHandle`/`AiCallReport`), `AiVoiceProviderRegistry`. Aavtaar is a thin adapter (`AavtaarOutboundCaller` + `AavtaarReportParser`). **A new AI-voice provider = two adapter beans, zero core changes.** The call-log write reuses the existing `CallLogService.applyEvent(NormalizedCallEvent)` (rank-ordered idempotency).
- **Webhook receiver** (`/v1/telephony/webhook/aavtaar` + generic `/v1/telephony/webhook/ai-voice/{provider}`) → `ai_call_result` landing table (V336), idempotent on `call_uuid`.
- **Click-to-AI-call**: `AavtaarHttpClient` + `AiCallService` + `POST /v1/telephony/ai-call/connect`.
- **AI Calling settings**: `AI_CALLING_SETTING` + the settings tab (frontend) + `AiCallingSettingsService` (server read).
- **Per-audience trigger**: `AiCallCampaignService` + `POST /v1/telephony/ai-call/campaign/{audienceId}`.
- **Outcome → action**: `AiCallOutcomeClassifier` (pure, unit-tested) + `AiCallOutcomeProcessor` — on each end-of-call webhook it binds the call to the lead, promotes it to `telephony_call_log`, and **assigns a counsellor or stamps a status per the settings**.
- **CALL_AI** workflow node (`NodeType.CALL_AI`).

### Deferred (tracked)
Recording copy to our S3 (needs an Aavtaar `RecordingFetcher`); the **timed retry re-dialer** (RETRY currently stamps `AI_RETRY_PENDING` only); the engine pause/resume bridge (the direct processor covers the core flow). Per-institute encrypted creds (pilot uses config props).

### Unit tests
```bash
cd vacademy_platform/admin_core_service
./mvnw -Dtest=AiCallOutcomeClassifierTest test     # 11 cases — assign / stop / retry / exhausted / not-connected
```

### Manual end-to-end test

**0. Config** (pilot — Shiksha Nation):
```
aavtaar.api.token=<rotated prod JWT>
aavtaar.api.company-code=shikshanation
aavtaar.webhook.secret=<secret you embed in the webhook URL>
```
Provision the lead-status catalog keys for stamping to take effect (optional — assignment works without them): `AI_QUALIFIED`, `AI_NOT_INTERESTED`, `AI_NO_ANSWER`, `AI_RETRY_PENDING`.

**1. Save settings** — Settings → "AI Calling": enable, set the Campaign ID, save. (Or POST `AI_CALLING_SETTING` to `/institute/setting/v1/save-setting`.)

**2. Place an AI call** (JWT required):
```bash
curl -X POST "http://localhost:8072/admin-core-service/v1/telephony/ai-call/connect" \
  -H "Authorization: Bearer <JWT>" -H "Content-Type: application/json" \
  -d '{"instituteId":"<inst>","userId":"<leadUserId>","phoneNumber":"9999999999","responseId":"<audienceResponseId>","campaignId":"<campaignId>"}'
# → { callLogId, status:"QUEUED", dispatched:true }  ; a telephony_call_log row (INITIATED→QUEUED) appears.
```

**3. Simulate the end-of-call webhook** (public — no JWT; use the `callLogId` from step 2 as the correlation id):
```bash
curl -X POST "http://localhost:8072/admin-core-service/v1/telephony/webhook/aavtaar?instituteId=<inst>&token=<secret>" \
  -H "Content-Type: application/json" \
  -d '{"call_uuid":"test-uuid-001","Campaign Type":"outbound","Phone Number":"9999999999",
       "Status":"completed","Duration":145.0,"Disposition":"Interested","Lead Rating":8,
       "Call Summary":"Interested in MIP.","Recording URL":"https://plivo-recordings.blr1.digitaloceanspaces.com/x.mp3",
       "Call Start":"20-06-2026 11:00 AM","metadata":{"correlationId":"<callLogId>"}}'
# → { isSuccess:true, data:{received:1,...} }
```
Inbound variant: drop `metadata`, set `"Campaign Type":"inbound"` and a `Phone Number` that matches a lead's `parent_mobile` — it's matched by phone.

**4. Verify** (SQL):
```sql
SELECT processing_status, call_log_id FROM ai_call_result WHERE call_uuid='test-uuid-001';   -- PROCESSED + linked
SELECT status, provider_call_id, recording_url FROM telephony_call_log WHERE id='<callLogId>'; -- COMPLETED + test-uuid-001
SELECT assigned_counselor_id FROM user_lead_profile WHERE user_id='<leadUserId>';              -- set (if the audience has a pool)
SELECT lead_status_id FROM audience_response WHERE id='<audienceResponseId>';                  -- AI_QUALIFIED (if provisioned)
```
Try `"Disposition":"Not_Interested"` → STOP (no assignment); `"Disposition":"Incomplete"` → RETRY (`AI_RETRY_PENDING`); `"Status":"no-answer"` with retries exhausted → assign-to-human.

**5. Audience campaign** (JWT required):
```bash
curl -X POST "http://localhost:8072/admin-core-service/v1/telephony/ai-call/campaign/<audienceId>?instituteId=<inst>" \
  -H "Authorization: Bearer <JWT>"
# → { total, placed, skipped, failed }  — one AI call per lead with a phone + user id.
```

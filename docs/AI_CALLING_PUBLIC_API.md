# Telleo AI Calling API v1

Engineering reference for the public AI calling API: what it does, how it is wired and
what it promises. The client-facing guide lives at https://docs.telleo.ai (Mintlify).

- **Base URL:** `https://api.telleo.ai/v1`. The `vacademy_devops/telleo-api-ingress.yaml`
  ingress rewrites this to `/admin-core-service/open/ai-calling/v1/...` on admin_core.
- **Code:**
  - `admin_core_service/.../telephony/publicapi/` (controller, service, views, webhooks, auth)
  - migration `V572__Ai_calling_public_api_v1.sql`; human calls (v1.2, §10): `V594__Human_call_public_api.sql`

## 1. What a client can do

| Method | Path | Scope | Purpose |
|---|---|---|---|
| POST | `/calls` | calls:write | Start one call (queued, dialled as soon as a line is free) |
| GET | `/calls` | calls:read | List calls, newest first (`batch_id`, `external_id`, `created_after`, `limit` 1–100, `starting_after`) |
| GET | `/calls/{id}` | calls:read | One call with status, recording and outcome |
| POST | `/calls/{id}/cancel` | calls:write | Cancel a call that is still queued |
| POST | `/batches` | calls:write | Up to 1000 calls in one request; each row is accepted or rejected on its own |
| GET | `/batches/{id}` | calls:read | Batch progress: counts per status |
| GET | `/agents` | calls:read | Agents the key can name, plus the `{{variables}}` each one's script uses |
| GET | `/credits` | calls:read | Credit balance, can_place_calls, calls_waiting |
| GET | `/usage` | calls:read | Calls, connected, talk seconds, credits per day |
| GET / PUT / DELETE | `/webhook` | webhooks:manage | The one webhook endpoint per account |
| POST | `/webhook/rotate-secret` | webhooks:manage | New signing secret, shown once |
| POST | `/webhook/test` | webhooks:manage | Send a `webhook.test` event now and report the answer |

### Conventions

- JSON in and out is snake_case; camelCase input is also accepted.
- Every response carries `X-Request-Id` and `Cache-Control: no-store`.

## 2. Authentication

- **Header:** `X-API-Key: vak_call_…`, or `Authorization: Bearer vak_call_…`.
- **Issuing keys:** an institute ADMIN issues keys in Settings → AI calling → API & webhooks.
  - Endpoint: `POST /admin-core-service/v1/api-keys` with `product: "ai_calling"`.
  - Storage: SHA-256 hashed in `institute_api_key`, shown once.
  - Self-serve: no platform switch is needed, and there is no daily cap.
  - Scopes: `calls:read`, `calls:write`, `webhooks:manage`. All three are granted when the request leaves them empty.
- **Legacy keys:** `vak_live_…` keys (`ai_call_api_key`, issued before v1) are still accepted, with every scope.
- **Rate limit:** 300 requests per minute per key, counted in memory per pod. Over the limit: 429 `rate_limited` with `Retry-After`.

## 3. Calls

### Request

```json
POST /v1/calls
Idempotency-Key: lead-8812            (optional, up to 255 chars)
{
  "agent_id": "17ea33d2-…",
  "phone_number": "+919876543210",
  "contact": {"name": "Asha Verma", "email": "asha@example.com", "external_id": "lead-8812"},
  "variables": {"course": "NEET 2027", "city": "Indore"},
  "metadata": {"crm_owner": "u_42"},
  "test": false
}
```

### Validation

**Phone number:**
- Must be E.164.
- Spaces, dashes, dots and parentheses are stripped, and a leading `00` becomes `+`.

**Contact:**
- `name`: at most 120 characters.
- `email`: must be a valid email address.
- `external_id`: at most 255 characters.

**Variables:**
- At most 50 per call.
- Keys match `^[A-Za-z][A-Za-z0-9_ ]{0,39}$`.
- Values are scalars of at most 500 characters.
- Keys named like a built-in placeholder (`name`, `lead_name`, the clock words `day`, `today`,
  `date`, `time`, `datetime`, `now`, `tomorrow`, `year`, `month`) are accepted with a
  `warnings[]` entry (`reserved_variable`) on the create response. They reach the bot as lead
  fields but never fill the placeholder: `_fill_placeholders` resolves its own values first.

**Metadata:**
- Any JSON object up to 8 KB.
- Echoed back unchanged; the agent never sees it.

### What the agent sees

- `{{name}}` is filled from `contact.name`.
- Every other variable is filled from `variables`, through the call context: `VoiceBotInternalController` reads `ai_call_api_call` when the call log's subject is `API_CONTACT`.
- `GET /v1/agents` lists the variables each agent's script uses, so a CRM knows which ones to send.

### Placing the call

- **Queue:** each call goes through `ai_call_queue` with `CallTrigger.API`.
  - These rules apply: the daily cap, the per-number cap, the recall gap, the duplicate window and the calling hours.
  - The assigned-lead guard does not apply, because API contacts are not CRM leads.
- **Single calls** are queued at interactive priority and dialled at once when a line is free (`dispatchNowIfLineFree`).
- **Batch calls** wait their turn behind interactive work.
- **Outside calling hours** a call stays `queued`, with `scheduled_for` set.

### Errors

| Situation | Status | Error code |
|---|---|---|
| A number that already has a call waiting | 409 | `call_already_queued` (includes the existing `call_id`) |
| Out of credits | 402 | `insufficient_credits` |

### Idempotency

- **Same key, same body:** returns the first call with 200 and `idempotent_replay: true`.
- **Same key, different body:** 409 `idempotency_key_reused`.
- **Two requests at the same moment:** a unique index decides the winner.
- **Batches** (v1.1.1): each accepted row is stored as `key#index`, so a batch key is at most
  251 characters (400 otherwise; `#999` must fit `VARCHAR(255)`). A replay must match: the
  `test` flag, and every stored row equal to the row at its index (409
  `idempotency_key_reused`, `details.batch_id`). A matching replay places nothing and returns
  the stored rows as `calls` plus `rejected` recomputed from the request (validation,
  agent, `duplicate_in_batch`). A row that passes those checks but has no stored call was
  dropped after acceptance (`call_failed` / `call_already_queued`; only accepted rows are
  stored, no response cache) and comes back as `call_not_placed`. While the newest stored
  row is under 2 minutes old such a row means the first request may still be running: 409
  `request_in_progress`, `Retry-After: 30`. A concurrent first request that loses the
  insert of a `key#index` row gets the same 409. A batch that stored no row at all is not
  remembered.

### Test mode

`test: true` places a MOCK call:
- No phone rings, no credits are used, and no line is taken.
- The call finishes at once as `completed`, with a sample outcome.
- The webhook fires as for a real call.

### Statuses

| Status | Meaning | Final |
|---|---|---|
| queued | Waiting for a line or for calling hours | no |
| dialing | Being placed / ringing | no |
| in_progress | Connected | no |
| completed | Connected and ended. Becomes final once the AI outcome is attached, or 10 minutes after the end without one | yes* |
| no_answer, busy, failed | Did not connect | yes |
| canceled | Canceled before it was dialled | yes |
| expired | No line became free before the queue item expired | yes |

### The call object

- Returned by `GET /v1/calls/{id}` and in webhook `data`.
- **Fields:**
  - `id`, `object: "call"`, `status`, `status_reason`, `scheduled_for`
  - `agent_id`, `phone_number`, `contact`, `variables`, `metadata`, `batch_id`, `test`
  - timing: `duration_seconds`, `created_at`, `dialed_at`, `ended_at`
  - recording: `recording_url` (pre-signed, valid 24 h; fetch again for a fresh one) and `recording_expires_at`
- **`outcome`:**
  - `disposition`, `summary`
  - `answers`: the agent's extraction questions mapped to the answers given
  - `lead_rating`: an integer from 1 to 10
  - `callback_requested`, `callback_time_text`
  - `follow_up` (`CALL` | `CALL_LATER` | `SKIP`), `follow_up_note`
  - `meeting`: `{requested, at, time_text, type}`, read from the report's `raw_payload`
  - `transcript`: a list of `{speaker: agent|contact, text}`
  - `outcome` is null until the AI result is processed.
- **Lists:** `GET /calls` returns the same full object. `GET /batches/{id}` returns counts only.

### Billing

- API calls bill like any other AI call, per connected minute, through the existing call billing.
- They create no CRM lead and run no lead workflows: the subject is `API_CONTACT`, and the call is tied to a deterministic pseudo user id derived from institute + phone.

## 4. Batches

- **Request:** `POST /v1/batches {agent_id, test, calls: [{phone_number, contact, variables, metadata, agent_id?}]}`. Each row may override `agent_id`.
- **Response:** 201 with `accepted_count`, `rejected_count`, `calls: [{index, id, phone_number, external_id}]` and `rejected: [{index, phone_number, code, message, call_id?}]`.
- **Rejection codes:** `invalid_request`, `duplicate_in_batch`, `call_already_queued`, `call_failed` (placement threw; the row is deleted).
- **Progress:** `GET /v1/batches/{id}` returns `total`, `finished` and `counts` per status.

## 5. Webhooks

**Events:**
- `call.completed`: the call connected; `data` is the full call, outcome included.
- `call.not_connected`: no_answer, busy, failed, canceled or expired.
- Each is sent once, when the call becomes final.

**Delivery:**
- An HTTPS POST of `{id, object: "event", type, created_at, data}`.
- **Headers:**
  - `Telleo-Event-Id`: stable across retries; dedupe on it.
  - `Telleo-Event-Type`
  - `Telleo-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256(secret, t + "." + raw body)>`
  - `User-Agent: Telleo-Webhooks/1.0`

**Verifying:**
1. Compute the HMAC over the raw bytes.
2. Compare in constant time.
3. Reject a `t` older than 5 minutes.

**Retries:**
- Any non-2xx answer or a timeout (10 s) is retried after 1 min, 5 min, 30 min, 2 h and 6 h. That is 6 attempts over about 9 hours.
- After the last attempt the delivery is marked FAILED. The call itself stays readable through `GET /v1/calls/{id}`.

**URL rules:**
- https only; redirects are not followed.
- Hosts that resolve to private, loopback, link-local, CGNAT or ULA addresses are refused.

**Engine:** an outbox on `ai_call_api_call` (`final_*` and `webhook_*` columns), run by two ShedLock'd jobs:
- `AiCallingApiFinalize`: every 15 s, scans the last 7 days of open calls.
- `AiCallingApiWebhooks`: every 5 s, delivers due events.

## 6. Errors

```json
{"error": {"code": "invalid_request", "message": "phone_number must be in E.164 format, e.g. +919876543210.",
           "request_id": "…", "details": {"errors": [{"field": "phone_number", "message": "…"}]}}}
```

| Status | Codes |
|---|---|
| 400 | `invalid_request` (also unreadable JSON, a missing header, a wrong content type) |
| 401 | `missing_api_key`, `invalid_api_key` |
| 402 | `insufficient_credits` |
| 403 | `insufficient_scope`, `product_not_enabled` |
| 404 | `not_found`, `agent_not_found` |
| 405 | `method_not_allowed` |
| 409 | `call_already_queued`, `idempotency_key_reused`, `request_in_progress`, `call_not_cancelable`, `agent_disabled`, `agent_inbound_only`, `conflict` |
| 429 | `rate_limited` |
| 500 | `internal_error` |
| 503 | `auth_unavailable` |

## 7. Admin dashboard

- **Location:** Settings → AI calling → **API & webhooks** (`AiCallingApiCard.tsx`). It appears only when the institute uses the VACADEMY_AI provider.
- **What it does:**
  - issues and revokes keys;
  - lists agent ids;
  - sets the webhook, tests it, rotates its secret and removes it, through `/admin-core-service/v1/telephony/ai-call/webhook?instituteId=` (ADMIN only).

## 8. Changes from the pre-v1 endpoint

The old `POST /admin-core-service/open/ai-calling/v1` (`numbers[]`, `mode: CLICK_TO_CALL | BULK_CALL`) and `GET …/{callLogId}` were removed. They:
- dialled up to 1000 numbers at once as MANUAL calls, skipping the caps, calling hours and the queue;
- ignored `agentId`;
- could not pass a name or variables;
- had no results or webhooks.

Only one `vak_live_` key was ever issued (an internal test). Such keys keep working on the v1 routes.

## 9. v1.1 (2026-10-14): review fixes, credits and usage

A 7-dimension review with independent verification (63 confirmed findings) led to:

- **Row writes are targeted.** After the insert nothing saves a whole `ai_call_api_call` row
  (repository `setQueueItemId`, `setCallLogIdIfNull`, `setTerminalSeenAtIfNull`,
  `markChecked`, `finalizeIfOpen`, `recordDelivery`). A finaliser snapshot taken before
  `queue_item_id` was written used to overwrite it and mark a live call failed. A row with
  neither a queue item nor a call log is "being created" (not final) for 5 minutes.
- **Finality.** The outcome wait counts from `terminal_seen_at` (V573), not from
  `telephony_call_log.updated_at`, which is never bumped. A connected call is final when the
  outcome is PROCESSED and the recording is saved (test calls: outcome only). It is also
  final 3 min after the outcome without a recording, or 10 min after the end regardless. A
  call log or dispatched queue item with no end after 2 h is final `failed` ("No result was
  received for this call.").
- **Fairness.**
  - `findOpen` orders by `checked_at` (V573), so the finaliser round-robins.
  - `findWebhooksDue` takes at most 10 rows per institute.
  - `deliverPass` runs institutes in parallel (8 threads, 4-min pass deadline) and stops an
    institute at its first failure in the pass.
  - Deliveries read only the status line (`ofInputStream` + close), so the total time is
    bounded.
- **Webhook guard.**
  - Only ports 443 and 8443 are allowed.
  - `telephony.ai.api.webhook.denied-addresses` (CSV of IPs) blocks our own ingress and nodes.
  - Errors use coarse words: timeout, connection failed, TLS handshake failed, HTTP n.
  - Test events are limited to 5 per minute per institute.
- **Calls.**
  - Batch rows honour their own `agent_id`.
  - Batches accept `Idempotency-Key`, stored per row as `key#index`.
  - Replays compare the whole normalised request, `test` included.
  - Keys expire after 24 h (cleared by the finaliser pass).
  - Test calls are limited to 500 per 24 h (`429 test_limit_reached`) and skip the 30 s duplicate window.
  - A create that fails after enqueue cancels the queue item it made (`abandon`).
  - Over-long contact fields are rejected.
  - The clock placeholders and `name` / `lead_name` were rejected as variables; v1.1.1
    accepts them again with a warning (they never fill the built-in placeholder).
  - `institute_name`, `lead_source` and `booked_slot` are client variables (mirrored to the
    bot's "institute name" / "booked slot" lead-field names).
- **Dispatch.**
  - The drain job cancels an API item whose agent is off or deleted ("The agent was turned
    off or deleted.").
  - The inline dial path reserves interactive slots for non-manual triggers.
  - Capacity counts DISPATCHING items, so parallel inline dials cannot oversubscribe.
  - Items queued outside calling hours get a status reason.
- **Voice bot context.**
  - API calls get no send rules (`sendArtefacts*`, `sendOffers`, `sendConditions`).
  - Mid-call `/action` is a no-op for API calls.
- **Outcome.** `call_quality` is `failed` when `AiCallOutcomeProcessor.isUntrustworthyCall`
  (RED + silence/loop fault); then the disposition is `Incomplete` and `lead_rating` is null.
- **Credits and usage** (`AiCallingUsageService`, scope `calls:read`):
  - `GET /v1/credits` reads `institute_credits` directly. The ai_service balance route
    auto-grants 100 credits to unknown institutes, so it is not used.
  - `GET /v1/usage?from&to&timezone&source=api|all` joins call logs to `credit_transactions`
    through the billing `external_reference_id` keys.
  - `cost {credits, billed}` on every call object.
  - "Not yet billed" (v1.1.1) = a leg `CallBillingService` will still charge: the voice
    leg on PLIVO / VACADEMY_AI (COMPLETED, duration > 0, `telephony_call_log.credits_billed_at`
    NULL), or the AI leg on VACADEMY_AI / AAVTAAR (`ai_call_result` PROCESSED, status
    completed, duration NULL or > 0, a call_uuid or correlation_id, `credits_billed_at`
    NULL). Reading only the call log's stamp counted every AAVTAAR call as unbilled forever.
- **Errors.** A `/**` fallback returns 404 `not_found` / 405 `method_not_allowed` in the
  envelope. Spring's `/error` dispatch used to answer 403.
- **Dashboard.**
  - Call Log rows for `API_CONTACT` show `contact_name`, hide the pseudo `user_id` (no
    "View lead" or assign), and are searchable by name.
  - The Call Queue shows `customer_name` and the source label "API (your systems)".
  - The card asks before rotating the secret and keeps the new-key dialog open until the key
    is copied.

v1.1.1 (same day, review of v1.1): batch replays compare the request and return the same
accepted and rejected rows (see Idempotency above); batch keys are at most 251 characters;
reserved variable names are accepted with a warning; `calls_not_yet_billed` and
`cost.billed` follow the per-provider billing rule; `AiCallingApiViews.state()` and the
create paths no longer set fields on a managed `AiCallApiCall` (open-session-in-view is on
in admin_core, so a setter was flushed as a whole-row UPDATE over the finaliser's columns).

Not changed (noted): legacy `vak_live_` keys still authenticate; DNS-rebinding between
validation and send is not pinned; the bot still describes API variables as "from the form
they filled" (voice-bot change, separate deploy).

## 10. v1.2 (2026-10-17): human (counsellor) click-to-call

The API can ring one of the institute's own counsellors and connect them to a number,
on the institute's PRIMARY provider (PLIVO "Vacademy Voice", EXOTEL or AIRTEL). It is a
separate resource, `/v1/human-calls`, and deliberately NOT a mode of `/v1/calls`: the
pre-v1 `mode: CLICK_TO_CALL` (§8) dialled as MANUAL and skipped every guard. Here every
guard an API caller needs runs up front, and a call that cannot go out now is refused
(an immediate call cannot wait in a queue).

**Code:** `publicapi/HumanCallApiService` (create/list/get/disposition/counsellors),
`HumanCallViews` (object + finality), `HumanCallGuards` (hours, caps, live calls),
`HumanCallWebhookService` (finaliser + delivery), entity `HumanCallApiCall` (table
`human_call_api_call`, V594). Dial path: `CallOrchestrator.connectForCounsellor` →
`CallLifecycleTxOps.prepareAndPersistForCounsellor`, which share the dashboard's
`persist` / `dispatch` code moved verbatim out of `connect` / `prepareAndPersist`
(dashboard behaviour pinned by `CallOrchestratorEntryPointsTest`).

### Endpoints

| Route | Scope | |
|---|---|---|
| `GET /v1/counsellors` | calls:read | ACTIVE users with COUNSELLOR/COUNSELOR/ADMIN in the institute (auth_service users-of-status, the same set as the extension picker) with `can_call` / `blocked_reason`. No phone numbers. |
| `POST /v1/human-calls` | calls:write | `counsellor_id` xor `counsellor_email`, `phone_number`, `contact`, `metadata`, `analyze`. 201 human_call. |
| `GET /v1/human-calls` | calls:read | Keyset pagination like `/calls`; filters `counsellor_id`, `status` (the call log's last status), `phone_number`, `external_id`, `created_after`, `created_before`. |
| `GET /v1/human-calls/{id}` | calls:read | |
| `POST /v1/human-calls/{id}/disposition` | calls:write | `{key, notes}` → `CallDispositionService.applyDisposition` (institute-checked; may move a linked lead's status). `dispositioned_by` = `"api:" + keyId without hyphens` (the column is VARCHAR(36)). |
| `GET /v1/dispositions` | calls:read | The institute's catalog (seeded on first use), `changes_lead_status`, target `lead_status`. |

### Create: checks, in order

1. Idempotency-Key (24 h, full-request compare incl. `analyze`; the counsellor compares by
   whichever selector was sent): same → 200 replay; different → 409 `idempotency_key_reused`;
   first request still dialling (row has no call log, < 2 min) → 409 `request_in_progress`
   (Retry-After 5), also on the concurrent-insert race.
2. Validation (E.164, contact limits, 8 KB metadata — the AI API's rules) → 400.
3. PRIMARY provider enabled and not AI-only → else 422 `telephony_not_configured`.
4. Counsellor in the eligible list → else 404 `counsellor_not_found` (another institute's
   user is simply not in the list).
5. Readiness: Exotel/Plivo need a mobile on the user record (read from the list, no extra
   auth call); Airtel asks `AirtelOriginationResolver.callerBlockedReason` (now
   institute-filtered) → 422 `counsellor_cannot_call` with `details.reason`.
6. `HumanCallGuards`:
   - calling hours = the AI calling shifts exactly as the AI queue evaluates them
     (`CallingWindowUtil`) AND VOICE_CALLING_SETTING.compliance's window (start 9 /
     cutoff 21 in its timezone, on by default) → 422 `outside_calling_hours` +
     `next_allowed_at`. NOTE: the compliance block was not enforced anywhere before
     (AI queue included); it is enforced only here.
   - counsellor already on a live call (non-terminal row < 45 min; skipped on Airtel, whose
     rows stay QUEUED until the CDR import) → 409 `counsellor_busy`.
   - the number already live → 409 `call_in_progress`; ≥ `maxCallsPerDayPerLead`
     (AI setting, default 3) outbound calls placed (not FAILED/CANCELLED) to the number in
     24 h, AI and human, any provider → 422 `contact_daily_limit_reached`; a CONNECTED call
     started within `telephony.ai.min-recall-gap-minutes` (60) → 422
     `contact_called_recently` + Retry-After. Unlike the AI queue, a missed call does not
     start the gap (a counsellor retrying a missed call is normal, and for most providers
     we cannot tell which leg missed).
   - No DND/NCPR scrub: there is no registry in the platform (the AI queue has none either;
     `compliance.dndScrubEnabled` is not wired anywhere).
7. Lead link: exactly one live (non-duplicate, non-INACTIVE) lead of the institute with the
   number (parent_mobile last 10), else the auth user with that mobile having exactly one
   lead here → the call row gets `response_id` + the lead's user (subject type NULL, as on
   the dashboard), shows on the lead timeline and dispositions can move the lead. Otherwise
   `API_CONTACT` with subject_id = `hcall_…` and the AI API's pseudo user id.
8. Insert the API row, then `connectForCounsellor`: the voice credit gate (fails open, as on
   the dashboard; PLIVO only) → 402; provider refusals → 422/502/503. Any failure deletes
   the API row so the same Idempotency-Key can retry.

### Object and finality

`object: "human_call"`. Status from the call log: INITIATED/QUEUED → queued,
COUNSELLOR_RINGING → ringing_counsellor, COUNSELLOR_ANSWERED → connecting, IN_PROGRESS →
in_progress, then completed / no_answer / busy / failed / canceled. `status_updates`:
PLIVO realtime, EXOTEL final_only, AIRTEL delayed. Final: terminal, and for completed once
the recording is in (or recording off, or 10 min; 60 on Airtel). No end after 2 h (Airtel
24 h) → failed "No final status was received". `no_answer_by` only from an unambiguous
provider report (Exotel `Status` vs `DialCallStatus`; Plivo `DialBLeg*`), else null.
`cost`: PLIVO voice leg from the ledger (`voice_call:{log}`); Exotel/Airtel
`{0, billed:true, note:"billed_by_provider"}`. GET never mutates the entity (OSIV); the only
write is the targeted `terminal_seen_at` fill.

### Analysis

`analyze: true` → once the call is COMPLETED with a recording, the finaliser calls
`CallIntelligenceEnqueueService.enqueueRequested`: like `triggerManual` it skips the
source toggles and min duration, and additionally the institute's CRM Intelligence master
switch (off by default — `triggerManual` would return DISABLED). It never resets an
existing row (the recording flow may already have queued and be running it). ai_service
charges 0.15 credits per recorded minute (credit_pricing `call_intelligence`). The
`analysis` block reads `call_intelligence` (summary, short_update, call_type,
inferred_goal, generic_status → `outcome`, lead_sentiment → `sentiment`,
conversion_likelihood, ratings, credits).

### Webhooks

Same endpoint (`ai_call_webhook`), signing, retries, SSRF checks and per-institute
fairness; `AiCallingWebhookService.deliver` sends. Own scheduled passes
(`HumanCallApiFinalize` 15 s, `HumanCallApiWebhooks` 5 s), ShedLocks and a 4-thread pool,
so human-call traffic never delays AI events. Events: `human_call.completed` /
`human_call.not_connected` (id `evt_hc_…`, outbox = final_* / webhook_* columns) and, for
`analyze` calls that connected, `human_call.analysis_ready` (id `evt_hca_…`, outbox =
analysis_* columns) once the analysis is completed or failed.

### Usage

`/v1/usage` appends `human_calls {totals, days}` after the v1.1 fields (unchanged):
outbound counsellor calls on non-AI providers; `source=api` = rows in human_call_api_call.

### Security fixes shipped alongside (separate commit)

`/v1/telephony/calls/connect`, `/calls/options`, `GET /calls`, `GET /calls/{id}/recording`
and every `/v1/telephony/counsellor-endpoints` route now require staff of the institute
(`requireInstituteStaff`); `resolveSubject` refuses another institute's lead; an endpoint
upsert can no longer move another institute's row; Airtel origination only uses the dialling
institute's extension.


# Telleo AI Calling API v1

Engineering reference for the public AI calling API: what it does, how it is wired and
what it promises. The client-facing guide lives at https://docs.telleo.ai (Mintlify).

- **Base URL:** `https://api.telleo.ai/v1`. The `vacademy_devops/telleo-api-ingress.yaml`
  ingress rewrites this to `/admin-core-service/open/ai-calling/v1/...` on admin_core.
- **Code:**
  - `admin_core_service/.../telephony/publicapi/` (controller, service, views, webhooks, auth)
  - migration `V572__Ai_calling_public_api_v1.sql`

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
  - `lead_rating`
  - `callback_requested`, `callback_time_text`
  - `follow_up`, `follow_up_note`
  - `transcript`: a list of `{speaker: agent|contact, text}`
  - `outcome` is null until the AI result is processed.
- **Lists:** list endpoints return a shorter object, without the outcome and recording.

### Billing

- API calls bill like any other AI call, per connected minute, through the existing call billing.
- They create no CRM lead and run no lead workflows: the subject is `API_CONTACT`, and the call is tied to a deterministic pseudo user id derived from institute + phone.

## 4. Batches

- **Request:** `POST /v1/batches {agent_id, test, calls: [{phone_number, contact, variables, metadata, agent_id?}]}`. Each row may override `agent_id`.
- **Response:** 201 with `accepted_count`, `rejected_count`, `calls: [{index, id, phone_number, external_id}]` and `rejected: [{index, phone_number, code, message, call_id?}]`.
- **Rejection codes:** `invalid_request`, `duplicate_in_batch`, `call_already_queued`.
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
| 409 | `call_already_queued`, `idempotency_key_reused`, `call_not_cancelable`, `agent_disabled`, `agent_inbound_only`, `conflict` |
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

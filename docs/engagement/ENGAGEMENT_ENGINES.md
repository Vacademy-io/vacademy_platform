# Vacademy Engagement Engines — Design

> **Status: DESIGN ONLY — nothing built.** Grounded in a verified 10-area recon of the
> monorepo (announcements, WhatsApp/Meta, email/push/logs, CRM, workflow engine, scheduler
> infra, learner data, ai_service, channel accounts, task prior-art), three independent
> architectures, and three adversarial red-team passes. Every class/table/endpoint named here
> was read in source. Where the recon was wrong, this doc says so.
>
> Companion docs: [`../crm/VACADEMY_AI_AGENT.md`](../crm/VACADEMY_AI_AGENT.md),
> [`../crm/VACADEMY_VOICE_INTEGRATION.md`](../crm/VACADEMY_VOICE_INTEGRATION.md),
> [`../scheduler_infra/README.md`](../scheduler_infra/README.md) (**read before touching the scheduler**),
> [`../../notification_service/NOTIFICATION_API.md`](../../notification_service/NOTIFICATION_API.md).

---

## 0. Locked decisions

| # | Decision | Choice |
|---|---|---|
| D1 | Where the brain runs | **admin_core_service (Java)** — not ai_service. See §2. |
| D2 | Workflow engine | **Take its seams, decline its interpreter.** New feature package. |
| D3 | Scheduler | Per-member `next_action_at` + **lease** claim under `FOR UPDATE SKIP LOCKED`, driven by an engine-level `next_due_at` cursor. Deterministic `should_wake()` gate before any LLM call. |
| D4 | Data points | Spring `List<DataPointProvider>` registry; `fetch(List<subject>)` — batch-only by construction. |
| D5 | Ledger | New `notification_log.correlation_id` (V31) + capture the **wamid** in the bulk send path. Phase 0, blocks everything. |
| D6 | Tasks | New `engagement_action` table = decision + ledger + task + audit, one row. `lead_followup` is lead-bound and unassignable — do not extend it. |
| D7 | Prompt | Immutable `base_text` + append-only delta chain → compiled. Behavioral diff on **admin edits**, not just autotune. |
| D8 | Templates | LLM proposes → **human approves** → `submitToMeta`. Category is never LLM-chosen. |
| D9 | Replies | Claim by Meta's inbound `context.id` → engine wamid. Else keyword → chatbot. Else chatbot. Else engine. |
| D10 | Frequency cap | **Institute-wide, cross-engine, per-user.** Per-engine caps do not cap anything. |
| D11 | Phase 1 | The engine that can only **make tasks** — ranked and budgeted. Automation is Phase 2. |

---

## 1. The seven facts that shape this design

Everything below follows from these. All verified in source.

1. **WhatsApp read receipts already exist — the earlier "impossible" verdict was wrong.**
   Two webhook pipelines exist. `MetaWebhookController` (`notification-service/webhook/v1/meta`) is **dead
   code**: it is not in `WebSecurityConfig.ALLOWED_PATHS` (only `…/webhook/v1/wati/**` is), and
   `/notification-service/v1/**` does not match it, so Meta gets a 401. Every doom-finding about it
   (untyped `WHATSAPP_STATUS_EVENT`, the 60s dedup that eats transitions, the stubbed signature check)
   is real **and irrelevant**.
   The **live** path is `CombotWebhookController` @ `/notification-service/v1/webhook` — permitAll,
   validates `hub.verify_token`, and parses WhatsApp Cloud format. `CombotWebhookService.processMessageStatusFromWebhook`
   writes **typed** rows via `CombotNotificationType.fromStatus()`: `WHATSAPP_MESSAGE_SENT` /
   `_DELIVERED` / `_READ` / `_FAILED`, each with `source_id` = wamid, `source` = the original outbound
   log id, plus `user_id` / `institute_id` copied from the original.
2. **…but the bulk send path throws the wamid away.** `WhatsAppService.logWhatsAppMessages:477-478`
   hardcodes `source="whatsapp-service"`, `source_id=templateName`. The provider returns
   `List<Map<String,Boolean>>` — success flags only; Meta's wamid is discarded. So
   `findOutgoingByMessageId(wamid)` misses and falls back to `findOutgoingByPhone(recipientId)` =
   *most recent outbound to that phone*. **Aggregate read-rate works today. Per-message attribution
   is a heuristic that degrades exactly where an engine hurts most — messaging the same person repeatedly.**
3. **Everything the brain must obey is Java, in admin_core.** `AudienceOptOutService`,
   `bounced_emails`, `UserAnnouncementPreferenceService`, `NotificationRateLimitService` (V181),
   `CallAiNodeHandler`'s shift planner, `LeadDistributionService`, and the credit tables themselves
   (`institute_credits`, V100 — **admin_core's Flyway**). ai_service reads admin_core's DB but has
   **no Flyway at all** (12 hand-run `.sql` files under `app/migrations/`).
4. **The workflow engine is a node-graph interpreter, and its resume is broken for our purposes.**
   `WorkflowResumeJob.resumeWorkflow` calls `run(workflow.getId(), ctx)` — it **replays from the start
   node**, not `paused_at_node_id`. Duplicate sends are prevented only by soft in-context flags
   (`__executed_notification_nodes`). Plus `guard++ < 100` node visits per run and a serial unbatched
   poller. Its good parts: `NodeHandlerRegistry` (drop a bean, get a node type) and the pieces in D2.
5. **The safe-concurrency pattern is already proven here — three times.** `claimForResume`,
   `LeadFollowupRepository.claimDueTransition`, `AudienceRepository.tryClaimAiCampaign` are all
   conditional-UPDATE claim-per-row. ShedLock **is** wired (V382, `masterDataSource`, `usingDbTime()`,
   8 jobs incl. `MetaLeadPollingJob` — this supersedes the old "Meta poller fans out to 4 replicas"
   note). Quartz is `RAMJobStore` in **both** services — it gives triggers, never replica safety.
6. **Three things the spec assumes exist, don't.** No human-task queue (`lead_followup` is
   `audience_response_id NOT NULL` with **no `assigned_to`**; `announcement_tasks` is *learner
   homework*). No AI-voice medium (`MediumType` is exactly `{WHATSAPP, PUSH_NOTIFICATION, EMAIL}`).
   No template auto-registration (`createDraft` + `submitToMeta` are the primitives; nothing calls them
   automatically).
7. **An AI that decides what to say cannot freely say it on WhatsApp.** Proactive WhatsApp = a
   *Meta-pre-approved template* + variable values. Free-form is legal only inside a 24-hour window the
   **user** opened. The product is "AI picks template #3 of 7, fills the variables, and chooses the
   hour" — which is a good product, but it must be said out loud before the demo, not after.

---

## 2. D1 — The brain runs in admin_core_service

The tempting answer is ai_service: it shares admin_core's Postgres, and `call_intelligence_poller`
is already this exact shape (asyncio, `FOR UPDATE SKIP LOCKED`, per-institute rubric from
`institutes.setting_json`, `CreditService.deduct_credits` with an idempotency key). **Reject it.**

| Claim for ai_service | Why it fails |
|---|---|
| "Only Python can meter fail-closed — `CreditClient.checkCredits` fails open" | The credit tables are **admin_core's** (V100). Java reads `institute_credits.current_balance` in-process. Don't call the fail-open client; read the table. |
| "admin_core has no safe recurring loop" | ShedLock is wired (V382) and claim-per-row is proven 3× in prod. `FOR UPDATE SKIP LOCKED` is a **Postgres** feature, not a Python one. Conflates "Quartz is RAMJobStore" (true) with "no safe loop exists" (false). |
| "asyncio gives free I/O concurrency for LLM fan-out" | Real, and answerable: a dedicated `ThreadPoolTaskExecutor` (the codebase already does named executors — `TelephonyAsyncConfig`, `announcementDeliveryExecutor`). These are I/O-bound HTTPS calls. **Do not use `spring.task.scheduling.pool.size=4`** for this. |

And the kill shot: **ai_service has no Flyway.** Putting the platform's hottest table in a service
whose DDL is a boot-time `ensure_*_schema` is not a trade worth making. Meanwhile every consent, cap,
suppression, and shift rule the engine must obey is Java — reimplementing that set in Python is how
you message someone who opted out.

Precedent that closes it: **`WorkflowAiDraftService` already calls Claude directly from admin_core**
(`workflow.ai.draft.model`), with a validate→repair→strict-JSON-re-emit loop. The brain is not a new
capability for this service.

```
admin_core_service  (the whole brain — control plane AND decision loop)
  EngagementSweepJob      @Scheduled(60s) + @SchedulerLock  ── waste-reducer only
    └─ engine cursor scan (O(engines))  →  per-engine member claim (SKIP LOCKED + lease)
       └─ DataPointRegistry.hydrate(cohort)   ── one batched query per provider per cohort
          └─ shouldWake(member, bundle)       ── DETERMINISTIC. no tokens. kills ~most ticks.
             └─ EngagementBrain.decide(...)   ── LLM, batched by engine (shared cache prefix)
                └─ PolicyGate  ── consent → quiet hours → institute cap → credits.  BEFORE dispatch.
                   ├─ automation ON  → EngagementDispatcher → POST /notification-service/internal/v1/send
                   └─ automation OFF → engagement_action(kind=TASK) → team inbox
notification_service  (actuation + the ledger)      ai_service  (metering only)
```

**Metering:** Java mints `action_id` **before** the LLM call and pins it across retries, then calls
`CreditClient.deductPrecomputed(..., idempotencyKey=action_id)` — idempotent via the
`external_reference_id` partial unique index (V243). This is the fix for the double-charge-on-timeout
hole that the HTTP-`decide` designs all had: they let Python mint the key, so a Java read-timeout
retried with a *new* key and charged twice.

---

## 3. Data model

`admin_core` migration **V385** (V384 is the current head — re-verify at build time).

```sql
CREATE TABLE engagement_engine (
  id              VARCHAR(255) PRIMARY KEY,
  institute_id    VARCHAR(255) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  status          VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',   -- DRAFT|DRY_RUN|ACTIVE|PAUSED|ARCHIVED
  approval_mode   VARCHAR(20)  NOT NULL DEFAULT 'ALL_TASKS', -- ALL_TASKS|FIRST_N|AUTO
  approval_n      INT          NOT NULL DEFAULT 20,
  data_points     JSONB        NOT NULL DEFAULT '[]',      -- selected provider keys
  channels        JSONB        NOT NULL DEFAULT '{}',      -- {WHATSAPP:{auto:true,provider:'META'},EMAIL:{auto:false,emailType:'UTILITY_EMAIL'},...}
  audience        JSONB        NOT NULL DEFAULT '[]',      -- recipient selectors, mirrors announcement_recipients
  quiet_hours     JSONB        NOT NULL DEFAULT '{}',      -- {start:21,end:9,tz:'Asia/Kolkata'}
  daily_task_budget INT        NOT NULL DEFAULT 50,        -- human attention is the scarce resource
  next_due_at     TIMESTAMP,                               -- DRIVER: makes institute selection O(engines)
  last_swept_at   TIMESTAMP,
  created_by, created_at, updated_at
);
CREATE INDEX idx_ee_due ON engagement_engine (next_due_at) WHERE status IN ('ACTIVE','DRY_RUN');

CREATE TABLE engagement_member (
  id                  VARCHAR(255) PRIMARY KEY,
  engine_id           VARCHAR(255) NOT NULL,
  institute_id        VARCHAR(255) NOT NULL,
  user_id             VARCHAR(255),          -- NULLABLE: an unconverted lead has NO user_id
  audience_response_id VARCHAR(255),         -- the lead row, when the subject is a lead
  status              VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE|PAUSED|EXITED|OPTED_OUT
  tier                SMALLINT    NOT NULL DEFAULT 2,          -- 0 HOT 1 WARM 2 COOL 3 DORMANT
  next_action_at      TIMESTAMP   NOT NULL,
  last_decided_at     TIMESTAMP,
  consecutive_no_ops  SMALLINT    NOT NULL DEFAULT 0,
  wake_fingerprint    VARCHAR(64),           -- QUANTIZED features, see §4.3
  memory_json         JSONB       NOT NULL DEFAULT '{}',
  created_at, updated_at
);
-- Identity: NULLs are distinct in Postgres, so a naive UNIQUE(engine_id, user_id) lets the SAME
-- unconverted lead be enrolled N times — N independent decisions, N messages, to the population
-- with the highest brand risk. COALESCE both keys.
CREATE UNIQUE INDEX ux_em_subject ON engagement_member
  (engine_id, COALESCE(user_id,''), COALESCE(audience_response_id,''));
CREATE INDEX idx_em_due ON engagement_member (engine_id, tier, next_action_at) WHERE status='ACTIVE';
ALTER TABLE engagement_member ADD CONSTRAINT ck_em_subject
  CHECK (user_id IS NOT NULL OR audience_response_id IS NOT NULL);

CREATE TABLE engagement_action (           -- decision = ledger = task = dry-run = audit. ONE row.
  id              VARCHAR(255) PRIMARY KEY,   -- == correlation_id stamped on the send. Minted PRE-dispatch.
  engine_id, member_id, institute_id VARCHAR(255) NOT NULL,
  prompt_version_id VARCHAR(255),
  kind            VARCHAR(20) NOT NULL,       -- SEND|TASK|NO_OP
  channel         VARCHAR(20),                -- WHATSAPP|EMAIL|PUSH|IN_APP|AI_CALL
  status          VARCHAR(20) NOT NULL,       -- PENDING|DISPATCHING|SENT|FAILED|UNKNOWN|SIMULATED|
                                              -- OPEN|DONE|DISMISSED|EXPIRED
  assigned_to     VARCHAR(255),               -- the column lead_followup never had
  template_name   VARCHAR(255),
  variables_json  JSONB,
  draft_body      TEXT,                       -- for TASK/SIMULATED only — see §9 on the dry-run lie
  rationale       TEXT,                       -- "why did it send this?" — the trust surface
  priority        NUMERIC(5,2),               -- ranks against daily_task_budget
  scheduled_for, expires_at, dispatched_at, completed_at TIMESTAMP,
  outcome         VARCHAR(30),                -- ACCEPTED|EDITED|DISMISSED — the autotune label
  error_message   TEXT,
  created_at, updated_at
);
CREATE INDEX idx_ea_inbox ON engagement_action (institute_id, assigned_to, status, scheduled_for)
  WHERE kind='TASK';
CREATE INDEX idx_ea_member ON engagement_action (member_id, created_at DESC);

CREATE TABLE engagement_prompt_version (
  id, engine_id, institute_id VARCHAR(255) NOT NULL,
  version         INT NOT NULL,
  base_text       TEXT NOT NULL,     -- IMMUTABLE. never re-summarized.
  delta_text      TEXT,              -- what the admin typed THIS time
  compiled_text   TEXT NOT NULL,     -- base + deltas, deterministically assembled
  source          VARCHAR(20) NOT NULL,  -- ADMIN|AUTOTUNE
  status          VARCHAR(20) NOT NULL,  -- ACTIVE|SHADOW|SUPERSEDED|REJECTED
  created_by, created_at
);
CREATE UNIQUE INDEX ux_epv ON engagement_prompt_version (engine_id, version);
```

`notification_service` migration **V31** (V30 is the head):

```sql
ALTER TABLE notification_log ADD COLUMN correlation_id VARCHAR(255);
CREATE INDEX idx_nl_correlation ON notification_log (correlation_id) WHERE correlation_id IS NOT NULL;
-- At-most-once backstop for engine sends:
CREATE UNIQUE INDEX ux_nl_engine_corr ON notification_log (correlation_id)
  WHERE correlation_id IS NOT NULL AND source = 'ENGAGEMENT_ENGINE';
```

**Why a new column and not `source_id`.** Two contracts want `source_id` and they are incompatible:
the status webhook joins on `source_id = wamid` (`findOutgoingByMessageId`), and the engine wants
`source_id = action_id` for attribution. One column, two truths. `correlation_id` carries the
action_id; `source_id` keeps the wamid so the **exact** status join works. Both contracts satisfied,
no collision.

---

## 4. D3 — The scheduler (the answer to "won't this be bulky?")

Your instinct — *"if the level is high priority then only we check, else we put a future date"* — is
exactly right, and it has a name here: **cost scales with decisions, not with enrolled users.** A
member is invisible until `next_action_at <= now()`. 300k members with a 72h cadence is ~4k due rows
an hour, not 300k.

### 4.1 The loop

```java
// EngagementSweepJob — @Scheduled(fixedDelay=60_000)
// @SchedulerLock(name="EngagementSweep", lockAtMostFor="PT9M", lockAtLeastFor="PT10S")
//   ^ waste-reducer ONLY. The per-row lease is what protects correctness — and it survives
//     the lock expiring mid-run, which at LLM latencies it will.
for (engine : repo.findDueEngines(now, limit=25)) {          // O(engines) via idx_ee_due — NOT O(due rows)
    var members = repo.claimDueMembers(engine.id, batch=200); // one round trip, see 4.2
    var cohort  = registry.hydrate(engine.dataPoints, members); // one query per provider per cohort
    for (m : members) executor.submit(() -> decideOne(engine, m, cohort.get(m)));
    repo.bumpEngineCursor(engine.id, now);                    // round-robin: fairness lives in the OUTER loop
}
```

Fairness is in the outer loop, not the sort key. A single `ORDER BY tier, next_action_at LIMIT n`
with no institute predicate **is** the starvation mechanism — one 50k-member institute with chatty
users pins tier 0 forever and the 200-member tenant who just enabled their engine sees nothing all
day. And a `row_number() OVER (PARTITION BY institute_id …)` window function is worse: `LIMIT` cannot
push through it, so cold start materialises and sorts *every* due row to pick 200 — the only design
that gets **more expensive the further behind it falls**.

### 4.2 The claim: lease, not status-flip

```sql
WITH due AS (
  SELECT id FROM engagement_member
  WHERE engine_id = :engineId AND status = 'ACTIVE' AND next_action_at <= now()
  ORDER BY tier ASC, next_action_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT :batch)
UPDATE engagement_member m
   SET next_action_at = now() + interval '15 minutes'   -- the LEASE
  FROM due d WHERE m.id = d.id
RETURNING m.*;
```

**Never `SET status='CLAIMED'`.** A status flip is a *terminal state on pod death*: the row never
re-enters the due scan, the partial index makes it invisible to every diagnostic query, and that
member silently drops out of the engine **forever** — the worst failure class for an autonomous
system, because nothing ever tells you. The lease is immune by construction: a dead pod's rows simply
come due again in 15 minutes. `SKIP LOCKED` means replicas *cooperate*, which is strictly better than
`WorkflowExecutionJob`'s collide-and-lose-on-unique-index.

The lease's own risk — a batch outrunning 15 minutes and being double-decided — is closed by §6.3
(at-most-once at the sender), not by hoping.

### 4.3 `shouldWake()` — deterministic, and it must know what time it is

This is where the money is saved: **most ticks must cost zero tokens.** A deterministic gate beats a
cheap-model screen (zero tokens beats some tokens, and it dodges the cache floor in §12).

```java
boolean shouldWake(m, bundle) {
    if (bundle.incomplete())        return DEFER;     // a failed fetch is NOT "no data" — §5
    if (bundle.hasUnansweredReply()) return true;     // always
    if (fingerprint(bundle) != m.wake_fingerprint) return true;
    if (cadenceElapsed(m, engine))  return true;      // ← THE ONE THAT MUST NOT BE FORGOTTEN
    return false;
}
```

**The `cadenceElapsed` clause is the whole product.** Every digest-based design proposed
`hash(last N ledger events + tier + prompt_version)` — *with no clock in it*. That hash is identical
on day 7 and day 14 of silence. For a re-engagement engine **elapsed silence is the trigger**, so the
gate goes quiet in exactly the case that should fire, and `consecutive_no_ops` backoff then gives a
learner who stopped logging in **exponentially less** attention the longer they're gone. That is the
product inverted, defended as a cost optimisation.

**Quantize before hashing.** Hashing raw values (completion %, `last_activity_at`) saves money only
where there was none to save: a dormant user's raw digest is stable (you skip a call you didn't
want), while an *active* user's `PERCENTAGE_PACKAGE_SESSION_COMPLETED` moves every session so the
digest changes every tick and the gate **never fires**. The saving is anti-correlated with the value.
Fingerprint on *bands*: completion bucket, days-since-activity bucketed to 1/3/7/14, reply-count band.

**Backoff:** `next_action_at = now + base * 2^min(no_ops,5)`, capped per tier — but `cadenceElapsed`
always overrides, so a dormant member still gets re-engaged on schedule.

**Jitter, always:** enrol with `next_action_at = now() + random() * cadence`. Without it, activating a
2,000-member engine is a 2,000-row thundering herd where the gate *cannot* fire (no `last_decided_at`,
no fingerprint) — 100% LLM on the first pass. One line converts every activation and every
prompt-version invalidation from a spike into a flat line.

**Never invalidate on prompt change.** Putting `prompt_version` in the wake fingerprint means one
admin edit re-decides every member on that engine at once (2,000 × 3 engines = 6,000 forced calls per
edit), and a weekly autotune job then does it platform-wide on a cron — a cost control that
periodically disarms itself. New prompt applies at each member's next natural wake.

### 4.4 Events pull rows forward

Polling stays lazy because events promote: a reply does
`UPDATE engagement_member SET next_action_at=now(), tier=0 WHERE …`. That's the tiering you described,
driven by evidence rather than a fixed schedule.

---

## 5. D4 — The data-point registry

Same idiom as `RecipientResolverRegistry` — Spring collects `List<DataPointProvider>`; adding a data
point is **one new `@Component` file, zero core edits**.

```java
public interface DataPointProvider {
    String key();                      // "ledger", "profile", "crm_lead", "enrollment", …
    boolean alwaysOn();
    DataPointSpec declare();           // label, cost hint, SENSITIVITY, prompt schema fragment
    Map<String, JsonNode> fetch(FetchContext ctx, List<Subject> subjects);  // PLURAL — N+1 unrepresentable
    String render(JsonNode payload);   // → compact prompt block
}
```

`fetch(List<...>)` is the point: there is no signature in which an N+1 can be written.
`declare()` feeds prompt assembly, so a new data point becomes visible to the brain automatically —
the same catalog-as-grounding trick `WorkflowCatalogController` already uses for AI workflow drafting.
Unknown keys in `engagement_engine.data_points` warn and skip (forward-compatible: an engine
configured today survives a provider being renamed tomorrow).

**A failed fetch must DEFER the decision, never return empty.** This codebase's universal
catch→return-`List.of()` pathology (every `RecipientResolver` does it; a down auth_service yields
"delivered to 0 users" with only a log line) is survivable for a human-triggered announcement and
catastrophic for an autonomous sender: a 500 from assessment_service and "this learner has taken no
assessments" become **the same input to the model**. Mark the bundle incomplete and re-lease.

| V1 provider | Source | Cost |
|---|---|---|
| `ledger` *(always-on)* | `POST /notification-service/internal/v1/engagement/ledger-batch` — **new**, §6.2 | 1 HTTP call / cohort |
| `profile` *(always-on)* | SQL: users + `custom_field_values` via `findCustomFieldsWithKeysByUserIdsAndInstitute` | 1 query |
| `crm_lead` | SQL: `audience_response`, `user_lead_profile`, `lead_status`, `timeline_event`, `lead_followup` | 1 query |
| `enrollment` | SQL: SSIGM + `learner_operation.PERCENTAGE_PACKAGE_SESSION_COMPLETED` (a rollup — no computation) | 1 query |
| `calls` | SQL: `telephony_call_log` + `call_intelligence` dispositions/summaries | 1 query |

**Deferred to Phase 3, and why:** `assessments`
(`/assessment-service/internal/student-analysis/assessment-history`) and `login`
(`/auth-service/analytics/student-login-stats`) are **per-user** endpoints — a batch sibling must be
built first or they are an N+1 across a service boundary. Also: `student-login-stats` is
`permitAll` despite the class being named `…InternalController` (it has no `internal` in its path, so
`InternalAuthFilter` — which matches on `getRequestURI().contains("internal")` — never fires). That is
a live IDOR leaking any user's login history by `userId`; **file it separately, don't build on it.**

`declare().sensitivity` drives a wizard consent checkbox and prompt redaction. Piping a learner's
failed assessments and login gaps into an LLM that writes to their **parent** is a conversation an
institute must be given, not defaulted into.

---

## 6. D5 — The ledger (Phase 0 — blocks everything)

> The brain must know what was sent, when, whether it was read, and how the person responded —
> otherwise it re-sends messages assuming nothing was sent. That is the founder's stated fear and it
> is the correct one.

### 6.1 Capture the wamid (2 files, no schema change)

Thread Meta's message id back through the bulk send path — change the provider return from
`Boolean` to the message id, and set `source_id = wamid`, `correlation_id = action_id`,
`source = 'ENGAGEMENT_ENGINE'` in `logWhatsAppMessages`. That single change turns
`findOutgoingByMessageId` from *miss → most-recent-to-phone heuristic* into an **exact** join, and
the existing typed `WHATSAPP_MESSAGE_READ` rows become per-message truth. Everything else in the
ledger story is already built.

### 6.2 One batched read endpoint

`notification_log` lives in notification_service's DB; neither admin_core nor ai_service can read it
with SQL. So the `ledger` provider is **one HTTP call per cohort** (not per user):

```
POST /notification-service/internal/v1/engagement/ledger-batch   (HMAC)
  { instituteId, subjects:[{userId?,phone?,email?}], since }
→ { bySubject: { <key>: { lastSentAt, lastReadAt, lastReplyAt, replyText,
                          sends7d, reads7d, failures7d, lastFailureCode,
                          channelsObservable:["WHATSAPP"] } } }
```

`channelsObservable` is load-bearing: **tell the model what it cannot see.** Push writes *nothing* to
`notification_log` (verified: `setNotificationType` yields only EMAIL, EMAIL_EVENT, INBOUND_EMAIL,
ENGAGEMENT_TRIGGER, and the WhatsApp family — no PUSH, no SMS, no VOICE, no SYSTEM_ALERT). Email
inbound is off in prod (`aws.inbound.email.enabled=${INBOUND_EMAIL_ENABLED:false}` in **dev, stage and
prod**; `SqsInboundEmailListener` is `matchIfMissing=false`, so the bean doesn't exist). If the brain
can't distinguish *not read* from *not observable*, it will read silence as rejection and escalate.

### 6.3 At-most-once at the sender

Every design named duplicate sends as the central fear and left the last hop unguarded:
`UnifiedSendService` has **no dedup** — no key, no constraint, no check. A read timeout leaves the
caller unable to tell "not sent" from "sent, response lost", and then the lease re-fires, the LLM
re-decides, and the customer gets it twice. The gates don't save you: `notification_rate_limit` is
1000/day and a 3-per-7-days member cap permits the duplicate.

1. Mint `action_id` and write `engagement_action(status=PENDING)` **before** dispatch.
2. Claim: `UPDATE engagement_action SET status='DISPATCHING' WHERE id=? AND status='PENDING'` → 0 rows = someone else has it.
3. Stamp `options.source='ENGAGEMENT_ENGINE'`, `options.sourceId=action_id` → `correlation_id`.
4. On timeout/unknown → `status='UNKNOWN'`. **Do not auto-retry. Reconcile**: ask the ledger whether
   `correlation_id` landed, then settle to SENT or FAILED. Blind retry is how you double-send.
5. Backstop: the partial unique index on `notification_log(correlation_id)` (§3).

### 6.4 Gate on failure — the escalation loop nobody modelled

`WHATSAPP_MESSAGE_FAILED` rows carry Meta error codes (131049 / 130472 = quality-throttled). Left
ungated, the loop is: engine sends → WABA quality drops → sends fail → engine observes no READ →
brain concludes "not read" → **it sends more**. That ends with the institute's WhatsApp number
restricted — for every sender on it, OTPs included. `PolicyGate` must trip the engine to PAUSED and
raise a task on a rising `failures7d`.

---

## 7. D6 — Actions, tasks, and the automate-or-task path

`lead_followup` is the only human-task primitive and it is disqualified twice over:
`audience_response_id NOT NULL` (learners are unrepresentable) and **no `assigned_to`** (you can only
create a task *as yourself*; ownership is implied by `created_by`, while real lead ownership lives in
`user_lead_profile.assigned_counselor_id`). The helpdesk (`support_ticket`) models *Vacademy's own*
staff answering institutes — right design reference, wrong extension point.

So: `engagement_action` is new, and it is deliberately one row for decision + ledger + task +
dry-run + audit. One row explains itself.

```
decide → PolicyGate(consent, quiet hours, institute-wide cap, credits)   ← BEFORE the LLM where possible
       → channel automation ON and configured and template APPROVED?
            yes → dispatch (§6.3)
            no  → engagement_action(kind=TASK, assigned_to=LeadDistributionService.selectCounselor(...))
       → automation FAILED at runtime?  → ALSO write a TASK   ← the anti-silence invariant
```

**Task volume is the real constraint, and it is not credits — it is human attention.** Do the
arithmetic before celebrating "Phase 1 = tasks only, therefore safe": 50k learners on a 72h cadence
≈ 16k due/day; even at a 90% no-op gate that is ~1,600 tasks/day into `counselor_pool`, which is 2–5
people. Dead on arrival by week two. Worse, the failure is *self-concealing*: Phase 2's autotune is
justified by "the tasks aren't working" and rests on the accept/edit/dismiss labels Phase 1
generates — labels that will be **bulk-dismissed-because-the-inbox-was-unusable**, which is
indistinguishable from "the AI was wrong". **The safe phase silently corrupts the evidence the risky
phase depends on.**

Hence `daily_task_budget` + `priority`: the engine ranks and emits only the top N per institute per
day, and `expires_at` reaps the rest. An AI whose scarce resource is human attention must be
designed as such from day one.

---

## 8. D7 — The prompt that grows

> *"this prompt will be remade with the initial things and whatever changes… a prompt that grows with time"*

`base_text` is **immutable**; each admin edit appends a `delta_text`; `compiled_text` is
deterministically assembled. Never re-summarize the prompt with an LLM — that is drift-by-
resummarization and after six edits the engine is running something nobody wrote.

- **Admin edit** → new version, `status=SHADOW` → sampled against ACTIVE, decisions recorded and
  diffed, **never sent** → admin promotes.
- **Autotune** → same pipeline, `source=AUTOTUNE`, and restricted to **narrowing** amendments only
  (add a constraint, tighten a cadence) — mechanically checkable, so "the AI edited its own prompt"
  never means "the AI widened its own remit". Human approves. A tone change is *not* auto-applicable:
  tone **is** brand.
- Show a **behavioral diff, not a text diff.** A text diff is engineer UX; an admin cannot predict
  behavior from prose. Shadow mode was invented for the tuner but the risky edit is the human typing
  *"be more aggressive about fee reminders"* — point it at admin edits too.
- Bound `compiled_text`. It ships on every request, forever.

---

## 9. D8 — Templates, and the WhatsApp reality

`WhatsAppTemplateManagerService.createDraft` + `submitToMeta` are the primitives; the resumable
media-upload flow (Meta rejects public URLs for media headers — subcode 2388273 — so bytes must go
through `POST /{appId}/uploads` first) already exists. Auto-registration is `ensure`-on-compile:

```
prompt compile → LLM proposes required_templates[]  (name, body, body_variable_names, category)
  → upsert on the existing UNIQUE(institute_id, name, language)
  → HUMAN APPROVES THE TEXT AND THE CATEGORY          ← non-negotiable
  → submitToMeta → PENDING → a task, not a blocked send
  → the engine may only send APPROVED templates. TEMPLATE_PENDING → task.
```

**Never let the LLM pick `category`.** Meta templates are `MARKETING | UTILITY | AUTHENTICATION`;
Meta re-categorizes and rejects; rejections and low-quality marketing degrade the **phone number's**
quality rating, which throttles the institute's messaging tier (1K→10K→100K unique users/24h) for
every sender on that number. An LLM labeling *"Join our new batch!"* as UTILITY to dodge per-user
caps is a **policy violation, not a rejection**. Auto-submitting LLM-authored text under the
institute's WABA with no human in the loop is the single largest brand hazard in this design.

Write `body_variable_names` on the draft and `resolveTemplateVariablePositions()` gives the engine
semantic variables (`{"name":…, "payment_link":…}`) instead of positional `{{1}}` for free.

**And say the quiet part in the wizard.** Per §1.7 — proactive WhatsApp is template + variables.
A dry-run screen that renders `draft_body` as beautiful AI prose is **lying about the highest-stakes
channel**: what actually goes out is template #3 with a name substituted, or nothing at all. For
WhatsApp, DRY_RUN must render *the resolved template*, not the draft.

---

## 10. D9 — Replies

`ChatbotFlowEngine` and the legacy `channel_flow_config` router already compete for every inbound
message. A third claimant needs an explicit precedence rule that is **decidable inside the webhook**,
which rules out anything requiring notification_service to query admin_core's DB (it can't):

1. Meta inbound `context.id` matches an engine wamid → **engine**. Exact, and free once §6.1 lands.
2. Keyword matches a chatbot trigger → **chatbot**.
3. `ChatbotFlowEngine.handleIncomingMessage(...)` returns `handled` → chatbot.
4. Otherwise → engine.

Rejected: *"the system that spoke last owns the reply for 24h."* Engine nudges at 9am; learner texts
"FEES" at 2pm expecting the fee flow; the claim finds an engine row inside 24h and the institute's
**paid-for Jumpstart chatbot is dead for 24 hours**.

**Durable wake, not fire-and-forget.** A best-effort HMAC POST to admin_core is the fast path, but if
it 500s the wake is dropped — and the slow path (the next natural tick) is `base * 2^5` away for a
dormant member. A lead replying *"yes, send me the fee structure"* gets an answer **days later**,
precisely for the replies that matter most. So: fast-path POST **plus** a 2-minute
`inbound-since?instituteId=&since=` sweep per active institute (one cheap query) that promotes
matching members to tier 0. No outbox needed.

**Opt-out must be classified, not keyword-matched.** The STOP matcher was built for chatbot flows
where users tap buttons. An engine sending AI-authored prose provokes AI-authored replies: *"no
thanks"*, *"please stop"*, *"band karo"*, *"who is this"*. Keyword matching sees none of them, the
engine messages again in 48h, and in India that is a user report → quality collapse → WABA
restriction. **There is an LLM in the loop; use it to classify inbound intent for opt-out.** Note
also that WhatsApp-native *Block* and *Stop promotions* never reach `UserAnnouncementPreferenceService`
at all — the consent store will confidently say ALLOW for someone who already told Meta no.

---

## 11. D10 — Safety, consent, cost

- **Institute-wide cross-engine per-user cap.** Per-engine caps cap nothing: three engines × 3/week =
  **9 messages a week** to one learner, each engine correctly believing it was restrained. The first
  complaint is "why is it spamming?" and every audit log says it behaved.
- **Gate order: consent → quiet hours → cap → credits → LLM → dispatch.** Gating after the LLM pays
  for two of three decisions and throws them away.
- **Consent is a union, and it is fragmented.** `AudienceOptOutService` moves the user to an OPT_OUT
  audience and soft-deletes only their **most recent** active `audience_response` — a user in several
  audiences who opts out is still reachable from the others, and `sendAudienceMessage` performs **no**
  opt-out suppression at all. Read the union: OPT_OUT audience + `UserAnnouncementPreferenceService` +
  `bounced_emails` (note: `email` UNIQUE with **no institute_id** — one complaint anywhere blocks that
  address platform-wide, forever).
- **Kill switch must stop dispatch, not just decisions.** The dispatcher re-reads engine status at
  send time; PAUSE drains the queue. Pausing "decisions" while 200 queued sends fly is not a kill switch.
- **Rate-limit visibility.** `notification_rate_limit` is `UNIQUE(institute_id, channel)`,
  `daily_limit=1000` — **one bucket shared with announcements and workflow sends**. An engine silently
  eating 780 of 1,000 means the principal's 5,000-learner exam-day notice becomes "delivered to 0
  users". Surface engine consumption in the dashboard; never treat rate-limited as a silent DEFER.
  (Also: the naive `UPDATE … WHERE reset_date=CURRENT_DATE AND daily_used<daily_limit` returns 0 rows
  for *capped*, *stale reset_date*, **and** *row missing* — at 00:00 every engine reads "capped" and
  goes dark with no error. Insert-or-reset first, and note `CURRENT_DATE` resolves against the DB
  session TZ while `NotificationRateLimitService` rolls it with Java `LocalDate.now()`.)
- **Never inherit notification_service's auth posture.** That service is effectively
  `permitAll` (`ALLOWED_PATHS` includes `/notification-service/v1/**` and `/internal/**`;
  `HmacAuthFilter` is injected as a field but **never added to the filter chain**), and identity comes
  from request-body fields. Engine CRUD lives in admin_core under JWT; engine internals under
  `/admin-core-service/internal/**` under HMAC.
- **Membership reconciliation** (unspecified in every proposal): a nightly re-resolve via
  `POST /v1/recipient-resolution/centralized`, idempotent against `ux_em_subject`, that also sets
  `status='EXITED'` when someone leaves the audience. Without it an unenrolled learner keeps getting
  nurtured by an engine whose entire premise is enrollment. Note the resolver **cannot** resolve ROLE
  (roles live in auth_service's DB — pre-resolve to USER ids first, exactly as
  `RecipientResolutionService.preResolveToUserIds` does) and `RecipientType.AUDIENCE` reaches
  **converted leads only** (`findConvertedLeads` filters `user_id IS NOT NULL`) — so raw leads need
  the campaign-send path or a new resolver.

---

## 12. Cost model

Verified rates: **Opus 4.8 $5/$25 per MTok · Sonnet 5 $3/$15 ($2/$10 intro to 2026-08-31) ·
Haiku 4.5 $1/$5**. Batch API = **50% off**. Cache reads ≈ **0.1×**; writes **1.25×** (5-min TTL) /
**2×** (1h). Register `use_case='engagement'` in `ai_model_defaults` so the model is swappable
without a deploy (default `claude-opus-4-8`; `credit_multiplier` already exists per model).

At 50 institutes × 3 engines × 2,000 members = 300k members, ~3k input + ~200 output per decision:

| | LLM calls/day | Note |
|---|---:|---|
| Naive: evaluate every member daily | 300k | the thing we are not building |
| `shouldWake()` gate (deterministic, **quantized**) | ~30–120k | zero-token skip. The single biggest lever. |
| + prompt caching, batched **by engine** | same calls, ~56% less input | 1 cache write + N−1 reads |
| + Batch API for non-reply decisions | same calls, 50% off those | latency is already ~60s-tolerant; replies stay sync |

**The cache floor is a real trap and it bites Opus and Haiku hardest.** The minimum cacheable prefix
is **model-dependent**: 4,096 tokens for **Opus 4.8 and Haiku 4.5**, 2,048 for Sonnet 4.6/Fable 5,
1,024 for older Sonnets. A ~1,500-token compiled prompt + schema **silently will not cache** —
`cache_creation_input_tokens: 0`, no error. Pad the prefix to clear the floor with the `declare()`
catalog we already generate, keep it byte-identical across the engine's cohort (tools → system →
messages render order; volatile per-member data goes *after* the last breakpoint), and verify with
`usage.cache_read_input_tokens` rather than assuming.

**On the Haiku-screen cascade:** tempting, and mostly unnecessary — the deterministic gate already
removes the calls a cheap screen would have removed, at zero tokens instead of some. It also collides
with the 4,096-token Haiku floor, so the screen would run uncached. Keep the cascade as a Phase-3
tunable, not a founding assumption.

**Price a credit before Phase 2.** Against `ai_call_out` at 5.0 cr/min and a 200-credit starter grant,
an unpriced engine is a metered feature that meters nothing. Add an `ai_tool_pricing` row
(`unit_field='flat'`) and **mirror it in `tool_cost_estimator.DEFAULT_TOOL_PRICING`** — V321 says so
explicitly, and rates are already synced in three places. Note `ai_token_usage.request_type` is
CHECK-constrained (V325) and has no `engagement` value: either add a migration or use
`deductPrecomputed` (which sends no `usage_log_id`, so the CHECK never applies — the workaround
already in use).

---

## 13. Phasing

| Phase | Ships | Why this order |
|---|---|---|
| **0 — Ledger integrity** | wamid capture in `logWhatsAppMessages`; `correlation_id` (V31) + partial unique index; `ledger-batch` endpoint; failure-code ingest | Everything else is built on sand without it. ~2 files + 1 migration. |
| **1 — The engine that can only make tasks** | V385 schema; sweep + lease + `shouldWake`; registry (5 providers); prompt v1; audience picker (**extract `<RecipientPicker>` from the 4,115-line `create/index.lazy.tsx` first**); `channel-capabilities` aggregate over the 5 endpoints × 2 services; **ranked, budgeted** task inbox over `engagement_action` | Converts the risk story into a phase boundary. Automation OFF platform-wide. Generates real labels — *if* §7's budget keeps the inbox usable. |
| **2 — Automation** | WhatsApp (approved templates only) + email; `approval_mode=FIRST_N(20)`; dispatcher + reconcile; kill switch; credits priced; analytics | Only after a human has read N decisions and the template-approval flow exists. |
| **3 — Reply loop + reach** | inbound claim + LLM opt-out classification; AI-call channel (new `MediumType` — end-to-end, not a flag); assessments/login providers **with batch endpoints**; SHADOW autotune | Each needs something built first. |

**Explicitly deferred:** cross-engine orchestration; task reassignment UI; `engagement_trigger_config`
migration (V8's threshold-based triggers are this feature's ancestor — absorb, don't parallel);
in-app/push as *observable* channels (they write nothing to the ledger today).

**DRY_RUN is a switch, not a mandatory week.** A full-loop dry run with zero sends costs real money
producing nothing (~$4–10k platform-wide for a week) and contends with live traffic. Offer it;
don't mandate it. And make `SIMULATED` **terminal** — on DRY_RUN→ACTIVE a week of simulated actions
must never be picked up by the dispatcher.

---

## 14. Open questions

1. **Task budget default.** 50/day/institute is a guess. It should be a function of
   `counselor_pool` size — needs one prod query.
2. **Credit rate per decision.** Blocked on Phase-2 pricing; needs a founder call against the
   `ai_call_out` = 5.0 cr/min anchor.
3. **`engagement_trigger_config` (V8) + `channel_flow_config` (V7)** are this feature's ancestors.
   Absorb-and-deprecate, or coexist? Recommend absorb in Phase 3.
4. **Does the engine ever reach unconverted leads on WhatsApp?** The schema allows it
   (`audience_response_id`), the announcements path does not (converted-only). Confirms as a product
   call: lead-nurture is the highest-value use case *and* the highest brand risk.
5. **`/auth-service/analytics/**` is permitAll** — file separately as an IDOR; don't design on it.

---

## Appendix — corrections this design makes to its own recon

Recorded because two independent agents made the same mistake, and consensus is not evidence.

| Claim | Reality |
|---|---|
| "Per-message read attribution is IMPOSSIBLE — the single biggest blocker" | **Wrong.** Both agents read `MetaWebhookController`/`WebhookEventProcessor` — a pipeline that is unreachable (not in `ALLOWED_PATHS` → 401). The live `CombotWebhookService` writes typed `WHATSAPP_MESSAGE_READ` with wamid + a join to the original. The real defect is one discarded return value in the bulk send path. |
| "Minimum cacheable prefix is 2,048 tokens" | Model-dependent: **4,096** for Opus 4.8 **and Haiku 4.5**, 2,048 for Sonnet 4.6/Fable 5, 1,024 for older Sonnets. Worse than stated, and it defeats the proposed Haiku screen. |
| "ShedLock doesn't exist / the Meta poller fans out to 4 replicas" | ShedLock **is** wired (V382, `masterDataSource`, `usingDbTime()`); `MetaLeadPollingJob` is locked. ~19 other `@Scheduled` jobs still fan out — see `docs/scheduler_infra/README.md`. |
| "`ai_service` has no Flyway, therefore no SQL files" | No Flyway, but 12 hand-run `.sql` files under `app/migrations/` — schema drift is invisible to tooling, which is the actual argument against putting the hot table there. |

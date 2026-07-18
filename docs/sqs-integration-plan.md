# SQS Integration Plan — admin-core-service

**Status:** Proposed | **Date:** 2026-07-07
**Scope:** Introduce Amazon SQS for async post-processing in `admin_core_service`, reusing the SQS pattern already proven in `notification_service`. No cross-service messaging changes (admin_core → notification stays HTTP for now). All changes ship behind feature flags with a sync fallback.

---

## 0. Audit summary — where SQS helps

A full audit of admin_core_service identified these flows, in priority order:

| Priority | Flow | Today | Problem |
|---|---|---|---|
| **CRITICAL** | Payment webhook post-processing (Stripe/Razorpay/PhonePe/Cashfree) | Sync in webhook thread: invoice PDF (2–5s) + media-service S3 upload + confirmation email + renewal handling = **6–15s** | Gateways expect ack < 3s; timeouts cause gateway retries |
| **HIGH** | Workflow trigger/execution | `WorkflowTriggerService.handleTriggerEvents` runs `workflowEngineService.run()` inline; email nodes chunk 50 + 200ms throttle (~24s for 500 recipients) | Blocks enrollment/payment/lead request threads |
| **HIGH** | Telephony + AI recording persistence | `@Async` pools with hand-rolled `Thread.sleep` backoff [30s/45s/90s] for the CDN-lag race | Retries die with the pod; threads parked for minutes |
| **HIGH** | AI voice (Aavtaar) webhook outcome processing | Per-result lead-bind / call-log / workflow-resume loop in webhook thread | Slow ack, partial failures mid-loop |
| **MEDIUM** | Enrollment credential emails, fee receipt PDFs | `@Async` on tiny bounded pools (`emailTaskExecutor` 2/5/queue20) | Saturates on bulk enrollment; work lost on pod restart |
| **MEDIUM** | Referral benefit processing | Sync in enrollment/payment thread (auth-service HTTP + emails + credits) | Adds latency; failure risks inconsistent grants |
| **MEDIUM** | Bulk ops (learner assign/deassign, CSV student upload, bulk lead submit) | N×M sync loops in request threads incl. inline auth-service user creation | Request timeouts, no progress visibility |
| **LOW** | Ad-platform lead ingestion (Meta/Google) | `@Async("workflowTaskExecutor")` | Only if executor saturation observed |

### Explicit NON-candidates (do not migrate to SQS)

- **CallEventBus SSE fan-out** — broadcast pub/sub to all 4 replicas; SQS is point-to-point (one consumer per message). Wrong tool; future fix is Redis pub/sub or SNS. Frontend polling fallback already exists.
- **Eway polling** (`EwayPoolingService`) — Eway has no webhook; polling is inherent. Stays.
- **Call Intelligence — call transcription + AI analysis pipeline** — the `call_intelligence` table is a DB work queue **polled by the Python ai_service** (`ai_service/app/services/call_intelligence_poller.py`, `PENDING → TRANSCRIBING → ANALYZING`, writes results back directly). The consumer is Python and cannot reuse the Spring SQS config; the DB queue with crash recovery already works. Optional future: ai_service consumes SQS via boto3 — note only, no work planned.
- **ai_content_extraction / TranscriptionReconciliationJob** (video/content transcription in `features/ai_content`) — the 5-min reconciliation poll is a safety net, not a hot path. Stays.
- **Audit logs** (`AsyncAuditDispatcher`) — low value per message; `CallerRunsPolicy` is acceptable backpressure. Stays `@Async`.
- **admin_core → notification_service traffic** — keep HTTP `sendUnified`; moving it to SQS needs a notification-side consumer and is a separate design.

---

## 1. Goals

- Ack payment-gateway webhooks in **< 1s** (currently 6–15s).
- Move long-running side effects (invoice PDF, workflow runs, recording persistence, emails, referral benefits) off request threads and fragile in-JVM `@Async` executors.
- Replace hand-rolled `Thread.sleep` retry loops with SQS delayed redelivery.
- Survive pod restarts/deploys without losing in-flight async work (today, anything queued in an `@Async` executor dies with the pod).

---

## 2. Where the SQS plumbing lives

**Duplicate the small config in admin_core_service. Do NOT move it to common_service.**

- notification_service's `AwsSqsConfig` (~40 lines) and `SqsAutoConfigurationExcluder` (~50 lines) are trivially small — duplication cost is negligible.
- `common_service` is pulled by every service; adding `spring-cloud-aws-starter-sqs` there drags the AWS SDK v2 SQS stack + `SqsAutoConfiguration` into all of them, forcing every service to configure the excluder or fail at startup. Real blast radius, zero benefit.
- Extract to a shared module only when a **third** service needs SQS (rule of three).

**Files to create** (mirroring `notification_service/src/main/java/vacademy/io/notification_service/config/`):

- `admin_core_service/.../config/aws/AwsSqsConfig.java` — `@ConditionalOnProperty(name = "aws.sqs.enabled", havingValue = "true")`, builds `SqsAsyncClient` (SDK v2, `StaticCredentialsProvider` from `aws.accessKey`/`aws.secretKey`/`aws.region`) + `defaultSqsListenerContainerFactory` with `pollTimeout(20s)`, per-listener `maxConcurrentMessages`, acknowledgement `ON_SUCCESS`.
- `admin_core_service/.../config/aws/SqsAutoConfigurationExcluder.java` — `EnvironmentPostProcessor` excluding `SqsAutoConfiguration` when disabled; register in `META-INF/spring.factories`.

**pom change** (`admin_core_service/pom.xml`):

```xml
<dependency>
    <groupId>io.awspring.cloud</groupId>
    <artifactId>spring-cloud-aws-starter-sqs</artifactId>
    <version>3.1.0</version>
</dependency>
```

admin_core currently uses AWS **SDK v1** for S3 (BOM 1.11.1000). SDK v2 uses different coordinates (`software.amazon.awssdk`) and coexists cleanly — no S3 migration needed; notification_service already proves the combination under the same parent pom.

---

## 3. Queue topology — 4 standard queues + 4 DLQs

| Queue | taskTypes | Visibility timeout | maxReceiveCount → DLQ | Listener concurrency / pod |
|---|---|---|---|---|
| `vacademy-admin-core-payment-events` | `PAYMENT_WEBHOOK_POST_PROCESS` | 120s | 5 | 5 |
| `vacademy-admin-core-workflow-events` | `WORKFLOW_TRIGGER`, `WORKFLOW_RESUME` | 900s (engine runs can take minutes) | 3 | 2 |
| `vacademy-admin-core-media-tasks` | `TELEPHONY_RECORDING_PERSIST`, `AI_CALL_RECORDING_PERSIST` | 180s | 5 | 4 |
| `vacademy-admin-core-tasks` | `ENROLLMENT_CREDENTIAL_EMAIL`, `FEE_RECEIPT_GENERATE`, `REFERRAL_BENEFITS_PROCESS`, `AI_VOICE_OUTCOME_PROCESS`, `BULK_ASSIGNMENT_CHUNK`, `BULK_DEASSIGNMENT_CHUNK`, `LEAD_INGEST` | 120s | 4 | 10 |

DLQs: `…-payment-events-dlq`, `…-workflow-events-dlq`, `…-media-tasks-dlq`, `…-tasks-dlq`. Retention 14 days on DLQs, 4 days on main queues. All queues: `ReceiveMessageWaitTimeSeconds=20` (long polling).

**Why 4 and not more:** payment is isolated because it's business-critical and must never queue behind bulk emails; workflow is isolated because runs are long (large visibility timeout, low concurrency); media is isolated because it uses delayed-redelivery semantics; everything else shares the generic tasks queue and dispatches by `taskType`. New flows default into `vacademy-admin-core-tasks` unless they need different timeout/throughput characteristics.

**Why standard, not FIFO:** invoice generation already has a composite idempotency key + confirmation dedup; workflow triggers have the `workflow_execution` unique-key claim; handlers re-read current DB state by ID rather than trusting message order, so out-of-order duplicates converge. FIFO costs throughput (300 msg/s/group), complicates DLQ redrive, and buys nothing here. If a genuine ordering need appears, introduce one FIFO queue for that flow alone.

**Provisioning:** create in the same AWS account as `vacademy-ses-events` (same credentials). Document `aws sqs create-queue` commands + redrive policy JSON (`{"deadLetterTargetArn":"<dlq-arn>","maxReceiveCount":"5"}`) in vacademy_devops.

---

## 4. Producer abstraction

New package: `admin_core_service/.../features/queue/`

```
queue/
  QueuePublisher.java            // interface
  SqsQueuePublisher.java         // @ConditionalOnProperty aws.sqs.enabled=true
  InlineFallbackPublisher.java   // active when SQS disabled — dispatches to handler registry in-process
  QueueMessage.java              // envelope DTO
  QueueNames.java                // constants resolved from properties
  TaskType.java                  // enum of all taskTypes
  handler/
    QueueTaskHandler.java        // interface: taskType() + handle(QueueMessage)
    TaskHandlerRegistry.java     // Map<TaskType, QueueTaskHandler> from Spring context
  listener/
    PaymentEventsListener.java
    WorkflowEventsListener.java
    MediaTasksListener.java
    GenericTasksListener.java
```

**Envelope (JSON body):**

```json
{
  "messageId": "uuid",
  "taskType": "PAYMENT_WEBHOOK_POST_PROCESS",
  "version": 1,
  "instituteId": "…",
  "idempotencyKey": "webhook:<webHookId>",
  "attempt": 1,
  "publishedAt": "2026-07-07T10:00:00Z",
  "payload": { }
}
```

**Pass IDs, not blobs** (e.g. `webHookId`, not the Stripe payload) — the consumer reloads fresh committed state from the DB, which also sidesteps most ordering concerns. Set `taskType` as an SQS message attribute too (metrics/filtering without body parse).

**Publisher API:**

```java
void publish(String queue, QueueMessage msg);
void publishAfterCommit(String queue, QueueMessage msg);          // TransactionSynchronization afterCommit
void publishDelayed(String queue, QueueMessage msg, Duration d);  // DelaySeconds, max 900s
```

**Feature-flag fallback (critical):** when `aws.sqs.enabled=false` (local dev default), `InlineFallbackPublisher` dispatches to the same `TaskHandlerRegistry` — for `publishAfterCommit`, still via afterCommit synchronization on a small dedicated executor. Handlers are written once and exercised identically in local dev; each flow flips between legacy path and queue path independently.

**Transactional safety — no generic outbox table:**

| Pattern | Mechanism |
|---|---|
| Payment webhooks | **`web_hook` row is the natural outbox.** Persist payload `RECEIVED`, commit, ack gateway, publish. A scheduled sweeper (every 5 min, `FOR UPDATE SKIP LOCKED`) re-publishes `RECEIVED` rows older than 10 min. Add `QUEUED` to `WebHookStatus`. Duplicates are safe (idempotent consumer). |
| Workflow triggers | **`workflow_execution` row is the natural outbox** (already created REQUIRES_NEW with unique idempotency key). Publish after commit; sweeper re-publishes executions stuck queued > 15 min. |
| Recordings, AI voice outcomes | Row (call log / ingest) is persisted before processing; `publishAfterCommit` keyed on the row ID. Rare crash-between-commit-and-publish loss ≤ today's pod-restart loss. |
| Emails, receipts, referral, bulk | Plain `publishAfterCommit`, no sweeper. Loss window matches today's `@Async` profile; referral gets an idempotency guard instead (§5). |

---

## 5. Consumer design

- **Self-consume:** admin_core produces and consumes all 4 queues. Handlers call existing admin_core services/repositories — no new service, no cross-service DTO contracts.
- One `@SqsListener` class per queue, deserializing the envelope and dispatching via `TaskHandlerRegistry`:

```java
@SqsListener(value = "${vacademy.sqs.queue.payment-events:vacademy-admin-core-payment-events}",
             factory = "defaultSqsListenerContainerFactory")
```

- **Acknowledgement:** `ON_SUCCESS`. Handler throws → redelivery after visibility timeout → DLQ after maxReceiveCount. Never catch-and-swallow in handlers.
- **Unknown taskType (rolling-deploy lag):** old pod receives a new taskType → throw `UnknownTaskTypeException` → redelivery lands on an updated pod within a few tries (hence maxReceiveCount ≥ 3 everywhere). Additionally, per-flow producer flags are enabled only after the deploy carrying the handler is fully rolled out.
- **Idempotency per flow:**
  - Payment: reuse invoice composite-key idempotency + confirmation dedup (`alreadyExisted`). Known caveat: that dedup covers sequential retries; truly concurrent duplicate processing could double-send the confirmation email — acceptable initially, add the generic guard if observed.
  - Workflow: consumer attempts the `workflow_execution` PROCESSING claim; already claimed → log + ack.
  - Recordings: guard on existing media/recording row; duplicate upload of the same key is harmless.
  - Referral, bulk chunks, credential emails: **new generic guard** — `sqs_processed_message` table (Flyway `V360`): `idempotency_key varchar PK, task_type, processed_at`. Handler inserts the key in the same transaction as its DB side effects; duplicate key → ack silently. For email-only handlers, insert-before-send gives at-most-once-per-key (the right trade for emails).

---

## 6. Per-flow migration detail

### 6.1 Payment webhook post-processing (Phase 1 — CRITICAL)

- **Files:** `features/payments/controller/WebHookController.java`, `StripeWebHookService.java` (+ Razorpay/PhonePe/Cashfree equivalents), `PaymentLogService.handlePostPaymentLogicForSyncPayment` (~lines 259–306), new `PaymentWebhookPostProcessHandler`.
- **Change:** webhook path becomes: verify signature → persist/update `web_hook` row → persist payment-log status → `publishAfterCommit(PAYMENT_EVENTS, {webHookId, paymentLogId})` → return 200. Invoice PDF, S3 upload, confirmation notification, renewal handling all move into the handler, which reloads state by ID.
- **Flag:** `vacademy.queue.flows.payment-post-process`; false = current inline path untouched (kept as the `else` branch until Phase 4 cleanup).
- **`web_hook` status flow:** RECEIVED → QUEUED → PROCESSED/FAILED. Manual `/webhook/reprocess` publishes to the queue instead of running inline (same handler, same idempotency).
- **Acceptance:** webhook p99 ack < 1s; identical invoice/notification outcomes for a canary institute; DLQ empty after 1 week; killing a pod mid-processing yields redelivery and exactly one invoice.

### 6.2 Workflow trigger/execution (Phase 2 — HIGH)

- **Files:** `features/workflow/service/WorkflowTriggerService.java` (sync `workflowEngineService.run()` at ~line 190), callers like `LearnerEnrollmentEntryService` (~line 193, ABANDONED_CART), new `WorkflowTriggerHandler` + `WorkflowResumeHandler`.
- **Change:** `handleTriggerEvents` keeps its REQUIRES_NEW execution-row creation (idempotency claim), then publishes `WORKFLOW_TRIGGER {workflowExecutionId}` after commit instead of calling `run()` inline. Consumer loads the execution and calls `workflowEngineService.run()`. Resume path (`ScheduleTaskNodeHandler`) publishes `WORKFLOW_RESUME` at fire time.
- **Visibility caution:** 900s + concurrency 2/pod. If a run may exceed 900s, heartbeat-extend visibility (Spring Cloud AWS `Visibility` injection) — implement only if observed. Follow-up: move per-recipient throttling into notification_service batching so engine runs shorten.
- **Idempotency:** PROCESSING claim; redelivered message finding a terminal/recently-claimed execution acks without rerun. Node-level side effects already sent before a crash may duplicate on rerun — same as today's pod-crash behavior; known limitation.
- **Acceptance:** enrollment/payment/lead request latency drops by engine-run time; executions complete on a different pod than the trigger; no duplicate executions under load test.

### 6.3 Telephony + AI recording persistence (Phase 3 — HIGH; best fit)

- **Files:** `features/telephony/core/RecordingPersistenceService.java` (`Thread.sleep` backoff [30s,45s,90s]), `RecordingTxOps.java`, `AiCallRecordingService.java`, new `RecordingPersistHandler`.
- **Change:** replace `@Async + Thread.sleep` with `publishDelayed(MEDIA_TASKS, {callLogId, attempt:1}, 30s)`. Handler: fetch CDN → validate → `mediaService.uploadFileV2` → DB + timeline. On **CDN-not-ready** (the known AI recording race): if `attempt < 6`, re-publish with `DelaySeconds = min(900, 30 * attempt)` and **ack the current message** (controlled backoff, doesn't burn maxReceiveCount); attempts exhausted → mark recording FAILED and ack (business failure, not poison). Unexpected errors → throw → visibility retry → DLQ.
- **Wins:** retries survive pod restarts; no threads parked 30–90s per recording; `telephonyRecordingExecutor`/`aiCallRecordingExecutor` pools shrink or disappear.
- **Acceptance:** zero lost recordings across a deploy during active calls; executor-queue-full log lines disappear.

### 6.4 AI voice (Aavtaar) webhook outcome processing (Phase 3)

- **Files:** `features/telephony/controller/AiVoiceWebhookController.java`, new `AiVoiceOutcomeHandler`.
- **Change:** controller persists ingest (existing), publishes one `AI_VOICE_OUTCOME_PROCESS` message **per result** (isolation), acks fast. Handler binds lead, writes call log, triggers workflow resume (which composes with the workflow queue after Phase 2).
- **Idempotency:** `sqs_processed_message` key `aivoice:<ingestId>:<resultIndex>`.

### 6.5 Enrollment credential emails + fee receipts (Phase 3/4)

- **Files:** `AsyncEnrollmentEmailService.sendCredentialEmailForPaidEnrollment`, `SchoolFeeReceiptService.generateAndSendReceipt`.
- **Change:** replace `@Async` bodies with `publishAfterCommit(TASKS, …)`; handlers call the existing service methods synchronously.
- **Idempotency:** keys `credmail:<enrollmentId>`, `receipt:<paymentLogId>`.

### 6.6 Referral benefits (Phase 4)

- **Files:** `features/user_subscription/handler/ReferralBenefitOrchestrator.processAllBenefits`.
- **Change:** publish `REFERRAL_BENEFITS_PROCESS {enrollmentId/paymentLogId}` after commit; handler runs the orchestrator. **Requires the generic idempotency guard** — credits must not double-grant: key `referral:<enrollmentId>` inserted in the same tx as the credit-ledger writes.

### 6.7 Bulk assignment / deassignment / CSV / lead bulk (Phase 4 — MEDIUM)

- **Files:** `BulkAssignmentService.java`, `BulkDeassignmentService.java`, `InstituteCSVBulkStudentController.java`, `PublicAudienceController.bulkSubmitLead`.
- **Change:** controller validates, creates a **job row**, splits into ~25-item chunks, publishes one `BULK_*_CHUNK {jobId, chunkIndex, itemIds[]}` per chunk, returns `202 {jobId}`. Handler processes its chunk (incl. auth-service user creation), updates counters atomically (`UPDATE … SET processed_items = processed_items + n`). New Flyway `V362`: `async_bulk_job (id, institute_id, type, status, total_items, processed_items, failed_items, created_by, created_at, completed_at, error_summary jsonb)`. New endpoint `GET …/bulk-jobs/{id}` for frontend progress polling.
- **Idempotency:** key `bulkchunk:<jobId>:<chunkIndex>`.

### 6.8 Ad-platform lead ingestion (Phase 4, optional)

Currently `@Async("workflowTaskExecutor")`. Migrate as `LEAD_INGEST` on the tasks queue only if executor saturation is observed — cheap once plumbing exists.

---

## 7. Configuration and flags

Properties (all profiles, mirroring notification_service naming):

```properties
aws.accessKey=${SQS_AWS_ACCESS_KEY}
aws.secretKey=${SQS_AWS_SECRET_KEY}
aws.region=${SQS_AWS_REGION}
aws.sqs.enabled=${AWS_SQS_ENABLED:false}          # default FALSE for admin_core initially; flip per env
spring.cloud.aws.region.static=${SQS_AWS_REGION}

# queue names (overridable per env; stage uses vacademy-stage-admin-core-*)
vacademy.sqs.queue.payment-events=vacademy-admin-core-payment-events
vacademy.sqs.queue.workflow-events=vacademy-admin-core-workflow-events
vacademy.sqs.queue.media-tasks=vacademy-admin-core-media-tasks
vacademy.sqs.queue.tasks=vacademy-admin-core-tasks

# per-flow producer flags
vacademy.queue.flows.payment-post-process=false
vacademy.queue.flows.workflow-trigger=false
vacademy.queue.flows.recording-persist=false
vacademy.queue.flows.ai-voice-outcome=false
vacademy.queue.flows.enrollment-emails=false
vacademy.queue.flows.referral-benefits=false
vacademy.queue.flows.bulk-ops=false
```

- Local / `k8s-local`: `aws.sqs.enabled=false` → inline fallback, zero AWS needed. Skip LocalStack/ElasticMQ — the inline path exercises the same handlers.
- **Stage:** if stage shares the AWS account, use distinct stage queue names via env vars so stage consumers never eat prod messages.
- Flag semantics — three-way safety: flow flag OFF = legacy code path; flow flag ON + SQS disabled = handler via inline fallback (local dev); both ON = full SQS. Instant per-flow rollback via env var + restart.

---

## 8. Rollout phases (each independently shippable & revertible)

**Phase 0 — Infra + plumbing (no behavior change).** Create 4 queues + DLQs + redrive policies; dedicated IAM user `vacademy-admin-core-sqs` scoped to the 8 queue ARNs; pom dep, `AwsSqsConfig`, excluder, envelope, publisher + inline fallback, registry, 4 listeners (registry empty), properties, k8s secrets/env. Flyway `V360__create_sqs_processed_message.sql`. Deploy `aws.sqs.enabled=true` in stage, all flow flags off.
*Acceptance:* app boots in all profiles incl. local with SQS disabled; listeners connect in stage; a manually-sent unknown-taskType message lands in DLQ after maxReceiveCount.

**Phase 1 — Payment webhook post-processing.** Highest value; strongest existing idempotency + natural outbox. Handler + sweeper + `WebHookStatus.QUEUED`; stage with gateway test events → prod canary institute → prod-wide.
*Acceptance:* per §6.1.

**Phase 2 — Workflow triggers/resume.**
*Acceptance:* per §6.2, plus abandoned-cart flow verified end-to-end.

**Phase 3 — Recording persistence + AI voice outcomes (+ credential emails if capacity).**
*Acceptance:* per §6.3/6.4; delete `Thread.sleep` retry code and shrink executors.

**Phase 4 — Referral, bulk ops (job table + progress endpoint), lead ingest, legacy-path cleanup.** Flyway `V362__create_async_bulk_job.sql`. Remove dead `else` branches from Phases 1–3 once stable ≥ 2 weeks.
*Acceptance:* bulk assign of 1,000 students returns 202 in < 2s and completes with accurate counters; no double credit grants under redelivery test.

---

## 9. Ops

**K8s env (admin-core deployment, same names as notification):** `SQS_AWS_ACCESS_KEY`, `SQS_AWS_SECRET_KEY`, `SQS_AWS_REGION`, `AWS_SQS_ENABLED`. Same secret mechanism as notification-service; dedicated IAM user recommended.

**IAM policy (least privilege):**

```json
{"Effect":"Allow",
 "Action":["sqs:SendMessage","sqs:ReceiveMessage","sqs:DeleteMessage",
           "sqs:GetQueueUrl","sqs:GetQueueAttributes","sqs:ChangeMessageVisibility"],
 "Resource":["arn:aws:sqs:<region>:<acct>:vacademy-admin-core-*"]}
```

(`sqs:StartMessageMoveTask` on DLQ ARNs if redrive is done via API.)

**CloudWatch alarms (per main queue):**

- `ApproximateAgeOfOldestMessage` > 300s (payment: > 60s) for 5 min → page.
- `ApproximateNumberOfMessagesVisible` > 1000 (workflow: > 200) → warn.
- Per DLQ: `ApproximateNumberOfMessagesVisible` > 0 → page. DLQ non-empty is always a bug or a poison message.

**DLQ replay:** SQS native redrive (console "Start DLQ redrive" or `aws sqs start-message-move-task`) back to the source queue — safe because handlers are idempotent. For payments, `/webhook/reprocess` remains a semantic replay path (regenerates the message from the `web_hook` row).

**Logging/metrics:** log `messageId`/`taskType`/`idempotencyKey` (MDC) at handler start/end/failure; Micrometer counters per taskType outcome.

---

## 10. Failure-mode analysis

| Failure | Mitigation |
|---|---|
| Publish succeeds, transaction rolls back | Never happens: `publishAfterCommit` everywhere. |
| Commit succeeds, publish fails / pod dies | Payment + workflow: sweeper re-publishes from natural-outbox rows. Other flows: accepted narrow loss window (≤ today's `@Async` behavior). |
| Duplicate delivery (at-least-once, 4 replicas) | Domain idempotency (invoice key, workflow_execution claim) + `sqs_processed_message` guard for the rest. |
| Poison message | maxReceiveCount → DLQ → alarm → fix → redrive. Business failures (CDN never ready, invalid data) are acked-and-marked-FAILED, never left to poison-loop. |
| Consumer deploy lag / unknown taskType | Throw → redelivery lands on updated pod; flow flags enabled only after full rollout of the handler. |
| Long handler exceeds visibility → concurrent duplicate | Timeouts sized 3–6× expected max; workflow claim check; extend-visibility escape hatch. |
| SQS outage / disabled | Flip flow flags off → legacy inline paths restore prior behavior. |

---

## 11. Files to create / modify (consolidated)

**Create**

- `admin_core_service/.../config/aws/AwsSqsConfig.java`, `SqsAutoConfigurationExcluder.java` (+ `META-INF/spring.factories` entry)
- `admin_core_service/.../features/queue/` package per §4 (publisher, envelope, registry, 4 listeners)
- Handlers: `PaymentWebhookPostProcessHandler`, `WorkflowTriggerHandler`, `WorkflowResumeHandler`, `RecordingPersistHandler`, `AiVoiceOutcomeHandler`, `EnrollmentCredentialEmailHandler`, `FeeReceiptHandler`, `ReferralBenefitsHandler`, `BulkChunkHandler`
- Flyway: `V360__create_sqs_processed_message.sql`, `V362__create_async_bulk_job.sql` (V361 reserved for a `web_hook` status check-constraint change if one exists)
- Queue-creation commands / IaC in vacademy_devops

**Modify**

- `admin_core_service/pom.xml` (starter-sqs 3.1.0)
- `application-{dev,stage,prod,k8s-local}.properties` (§7)
- `features/payments/controller/WebHookController.java`, gateway `*WebHookService`s, `PaymentLogService.java`, `WebHookStatus` enum
- `features/workflow/service/WorkflowTriggerService.java` (+ resume path)
- `features/telephony/core/RecordingPersistenceService.java`, `AiCallRecordingService.java`, `features/telephony/controller/AiVoiceWebhookController.java`
- `AsyncEnrollmentEmailService.java`, `SchoolFeeReceiptService.java`, `ReferralBenefitOrchestrator.java`
- `features/learner_management/service/BulkAssignmentService.java`, `BulkDeassignmentService.java`
- k8s deployment manifests for admin-core (env vars/secrets)

---

## 12. Reference — existing SQS pattern being reused (notification_service)

- `notification_service/.../config/AwsSqsConfig.java` — `SqsAsyncClient` + listener container factory, `@ConditionalOnProperty(aws.sqs.enabled)`.
- `notification_service/.../config/SqsAutoConfigurationExcluder.java` — excludes auto-config when disabled.
- Properties: `aws.accessKey=${SQS_AWS_ACCESS_KEY}`, `aws.secretKey=${SQS_AWS_SECRET_KEY}`, `aws.region=${SQS_AWS_REGION}`, `aws.sqs.enabled=${AWS_SQS_ENABLED}`.
- Existing consumers: `SqsEmailEventListener` (`vacademy-ses-events`, SES bounce/delivery/open/click) and `SqsInboundEmailListener` (S3-event-driven inbound email). Note: notification_service today is **consumer-only** — this plan introduces the platform's first SQS producers, in admin_core.

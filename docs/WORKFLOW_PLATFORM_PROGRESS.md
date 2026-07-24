# Workflow Platform — Reference for Engineers & Agents

A dense reference for the Vacademy workflow automation system. Optimized to be dropped
into an agent's context window — answers concrete questions about runtime behavior, data
shapes, file locations, and common debugging paths without needing to read other files
first.

> **Verified & corrected against live code 2026-07-07.**

> **Related docs (cross-reference, don't duplicate):**
> - [WORKFLOW_ENHANCEMENT.md](WORKFLOW_ENHANCEMENT.md) — chronological change log of past enhancements
> - [WORKFLOW_CREATION_GUIDE.md](WORKFLOW_CREATION_GUIDE.md) — admin-facing "build your first workflow" walkthrough
> - [WORKFLOW_AUDIT.md](WORKFLOW_AUDIT.md) — security / correctness audit findings
> - [../admin_core_service/WORKFLOW_EXECUTION_LOG.md](../admin_core_service/WORKFLOW_EXECUTION_LOG.md) — execution log schema details

## How to use this doc

**Use as agent context when:**
- The task touches the workflow engine, nodes, triggers, or queries
- The user asks "how does X work" / "where does Y live"
- You need to add a new prebuilt query, trigger event, node type, or wizard template
- Debugging "workflow ran but no email arrived" / "variables show as literal `{{...}}`" / "duplicate execution"

**This doc IS:**
- A topical reference (look up by concept, not by date)
- Code-grounded (every claim links to a file or class)
- Honest about what's wired vs catalog-only (don't recommend dead-end features)

**This doc IS NOT:**
- A tutorial for end users (see WORKFLOW_CREATION_GUIDE.md)
- A change log (see WORKFLOW_ENHANCEMENT.md)
- Auto-updated — verify with `git log` / live code if precision matters

## Disambiguation glossary

| Term | Means |
|---|---|
| **Workflow** | A `Workflow` row + N `WorkflowNodeMapping` rows + optional `WorkflowSchedule` / `WorkflowTrigger` rows. Persisted in DB. |
| **Workflow execution** | One run of a workflow. One row in `workflow_execution`. |
| **Node** | A `NodeTemplate` referenced by `WorkflowNodeMapping.nodeTemplateId`. Has a `node_type` + `config_json`. |
| **Node handler** | The Java class that runs a node type (`SendEmailNodeHandler`, `QueryNodeHandler`, etc.). |
| **Trigger** | What starts a workflow. Either an event (`WorkflowTrigger` row) or a schedule (`WorkflowSchedule` row). |
| **Trigger event** | A `WorkflowTriggerEvent` enum value (e.g. `LEARNER_BATCH_ENROLLMENT`). Names a kind of thing that happens in the platform. |
| **Context** | The `Map<String, Object>` that flows through a workflow run. Read via SpEL `#ctx['key']`. |
| **Use case** | A frontend-only concept: a wizard template that generates a complete workflow JSON. NOT stored in DB. Lives in [`use-case-templates.ts`](../frontend-admin-dashboard/src/routes/workflow/create/-components/use-case-templates.ts). |
| **Prebuilt query** | A named query identified by `prebuiltKey`. Dispatched in [`QueryServiceImpl.execute()`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/workflow/service/QueryServiceImpl.java). |
| **Template** (in this doc) | An EMAIL `MessageTemplate` — body + subject + `dynamic_parameters` map. Separate from "node template" and "use case template". |

---

## Quick orientation: workflow lifecycle in 6 steps

1. **Author** — admin creates a workflow via the React builder (wizard or canvas). Frontend POSTs the workflow JSON to `POST /admin-core-service/workflow`. Persisted as `Workflow` + `WorkflowNodeMapping[]` + `WorkflowSchedule` or `WorkflowTrigger`.
2. **Wait for fire** — event-driven workflows wait for `WorkflowTriggerService.handleTriggerEvents(eventName, eventId, instituteId, contextData)` to be called from somewhere in the platform. Scheduled workflows wait for [`WorkflowExecutionJob`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/workflow/scheduler/WorkflowExecutionJob.java) (Quartz, every minute) to see them as due.
3. **Claim** — pod inserts a row in `workflow_execution` with a unique `idempotency_key`. UNIQUE constraint prevents duplicate execution from N pods.
4. **Run** — [`WorkflowEngineService.run(workflowId, seedContext)`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/workflow/service/WorkflowEngineService.java) loads nodes, injects `instituteId`/`instituteName`/`workflowId` into the context, and traverses the DAG stack-based.
5. **Log** — every node execution writes a `workflow_execution_log` row with `status`, `details_json`, timing.
6. **Surface** — the workflow detail page reads these tables for the **Executions** tab; the debug view overlays per-node status onto the diagram.

---

## Decision tree: where to start

| Symptom | Start here |
|---|---|
| Workflow didn't fire at all | [Trigger sources](#trigger-sources) + check `workflow_trigger.trigger_status = ACTIVE` or `workflow_schedule.schedule_status = ACTIVE` |
| Workflow fired, ran, but 0 emails sent | [`workflow_execution_log`] of the QUERY node — look at `outputContext`. If `totalStudents=0`, the data isn't there; if the node FAILED, see error_message |
| Workflow fires twice | Check pod count. Idempotency suppresses dup writes but Hibernate logs ERROR-level noise from the duplicate-key INSERT; see [Idempotency](#idempotency--multi-pod) |
| Email body shows literal `{{var}}` | Either (a) template's `dynamic_parameters` is empty so mapping UI never showed, or (b) `templateVars` not set on the SEND_EMAIL node config. See [Variable substitution](#variable-substitution-pipeline) |
| New trigger event isn't firing my workflow | Check it's actually emitted somewhere. Some are catalog-only — see [Trigger catalog](#trigger-catalog) |
| Need to expose new data to email templates | Either (a) add a key to the query result map, or (b) add to `CONTEXT_FIELDS` in [node-config-panel.tsx](../frontend-admin-dashboard/src/routes/workflow/create/-components/node-config-panel.tsx) for the mapping dropdown. See [Add a new query](#recipe-add-a-new-prebuilt-query) |

---

## Architecture: component map

```
┌─────────────────────────────────────────────────────────────────────────┐
│  REQUEST PATH                                                            │
│                                                                          │
│  POST /workflow/trigger  ──────►  WorkflowTriggerService                 │
│                                   .handleTriggerEvents(eventName,...)    │
│                                                                          │
│  Cron tick (Quartz)      ──────►  WorkflowExecutionJob.execute()        │
│                                                                          │
│  POST /workflow/{id}/trigger-now ──► WorkflowController (strips dryRun) │
│                                                                          │
│           ALL THREE PATHS CALL                                           │
│                  │                                                       │
│                  ▼                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ WorkflowEngineService.run(workflowId, seedContext)              │    │
│  │   • loads Workflow + WorkflowNodeMapping[] + NodeTemplate[]     │    │
│  │   • injects workflowId, instituteId, instituteName              │    │
│  │   • starts from isStartNode, stack-based traversal              │    │
│  │   • for each node: dispatch to NodeHandler via NodeHandlerRegistry │ │
│  │   • collects routing results, pushes next node(s) to stack      │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                  │                                                       │
│                  ▼                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ Node handlers (admin_core_service/.../workflow/engine/)         │    │
│  │   TriggerNodeHandler, QueryNodeHandler, SendEmailNodeHandler,   │    │
│  │   HttpRequestNodeHandler, ConditionNodeHandler, DelayNodeHandler│    │
│  │   FilterNodeHandler, AggregateNodeHandler, LoopNodeHandler,     │    │
│  │   UpdateRecordNodeHandler, ScheduleTaskNodeHandler,             │    │
│  │   SendPushNotificationNodeHandler                               │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                  │                                                       │
│                  ▼                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ QueryServiceImpl.execute(prebuiltKey, params)                   │    │
│  │   switch (prebuiltKey) → fetchBatchAttendanceReport / etc.      │    │
│  │   returns Map<String,Object> merged into context                │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  EXECUTION LOG                                                           │
│    workflow_execution (one per run)                                      │
│    workflow_execution_log (one per node execution)                       │
└─────────────────────────────────────────────────────────────────────────┘
```

### Database tables (the relevant ones)

| Table | Purpose |
|---|---|
| `workflow` | Workflow record. Owns `institute_id`, `workflow_type` (EVENT_DRIVEN / SCHEDULED), `status`. |
| `workflow_node_mapping` | Links a workflow to N node templates. Stores `node_order`, `is_start_node`, per-instance `config_override_json`. |
| `node_template` | The node itself. Has `node_type` + `config_json`. Scoped to institute. |
| `workflow_trigger` | For event-driven: maps a workflow to a `WorkflowTriggerEvent` + optional `eventAppliedType` + `eventId` for priority matching. |
| `workflow_schedule` | For scheduled: cron expression, interval, day-of-month, timezone, start/end dates, `last_run_at`, `next_run_at`. |
| `workflow_execution` | One row per run. Status, timing, `idempotency_key`. |
| `workflow_execution_log` | One row per node execution. `details_json` carries handler-specific data. |

---

## Workflow JSON shape

A workflow is constructed as a list of nodes + a list of edges. The wizard's `generateWorkflow(answers, triggerEvent)` returns this shape, then the frontend serializes and POSTs it.

```jsonc
{
  "name": "Daily attendance report",
  "description": "...",
  "workflow_type": "SCHEDULED",
  "institute_id": "59f64ad0-...",
  "trigger": {                       // EVENT_DRIVEN only
    "event_name": "LEARNER_BATCH_ENROLLMENT",
    "event_applied_type": "PACKAGE_SESSION",
    "event_id": "f5e27614-..."       // null = all
  },
  "schedule": {                       // SCHEDULED only
    "schedule_type": "CRON",
    "cron_expression": "0 9 * * ?",
    "timezone": "Asia/Kolkata"
  },
  "nodes": [
    {
      "id": "2cab69b4-...",          // client-generated UUID
      "data": {
        "label": "Fetch attendance report",
        "nodeType": "QUERY",
        "config": {
          "prebuiltKey": "fetch_batch_attendance_report",
          "params": { "batchId": "id1,id2", "daysBack": 7 },
          "routing": [{ "type": "goto", "targetNodeId": "8dd4965c-..." }]
        },
        "isStartNode": false
      }
    },
    {
      "id": "8dd4965c-...",
      "data": {
        "label": "Send: Daily report",
        "nodeType": "SEND_EMAIL",
        "config": {
          "templateName": "Daily Attendance Report",
          "on": "#ctx['students']",
          "forEach": { "operation": "SEND_EMAIL", "eval": "#ctx['item']" },
          "templateVars": { "fullName": "fullName" },
          "routing": [{ "type": "end" }]
        }
      }
    }
  ],
  "edges": [
    { "source": "<triggerNodeId>", "target": "2cab69b4-..." },
    { "source": "2cab69b4-...", "target": "8dd4965c-..." }
  ]
}
```

**Routing model.** Edges in the UI are syntactic sugar. At runtime the engine uses the `routing[]` array inside each node's config:

```jsonc
"routing": [
  { "type": "goto", "targetNodeId": "uuid-of-next-node" },     // unconditional
  { "type": "branch_true", "targetNodeId": "..." },             // CONDITION node
  { "type": "branch_false", "targetNodeId": "..." },
  { "type": "end" }                                              // terminate this path
]
```

A CONDITION node can have both `branch_true` and `branch_false` — the engine picks based on `condition` SpEL eval. Other node types typically have one `goto` + optional `end`.

---

## Node catalog (full schema for each)

Every node config also accepts `routing[]` (omitted below for brevity).

### TRIGGER

Marks the workflow's start. Stored as a node so the diagram has an entry point. No execution behavior — the engine starts from `isStartNode = true` and walks the first `routing.goto`.

```jsonc
{
  "nodeType": "TRIGGER",
  "config": {
    "triggerEvent": "LEARNER_BATCH_ENROLLMENT"   // or "SCHEDULED"
  }
}
```

### QUERY

Calls a prebuilt query, merges the returned map into the context.

```jsonc
{
  "nodeType": "QUERY",
  "config": {
    "prebuiltKey": "fetch_batch_attendance_report",
    "params": {
      "batchId": "#ctx['packageSessionIds']",  // SpEL — evaluated against ctx
      "daysBack": 7,                            // literal — used as-is
      "from": "#ctx['windowStart']",            // optional
      "to":   "#ctx['windowEnd']"
    },
    "resultKey": "students"   // ⚠️ IGNORED — see below
  }
}
```

**`resultKey` is IGNORED for QUERY.** Despite being accepted (and advertised by `WorkflowContextSchemaService`), `QueryNodeHandler` never nests under it — query results are ALWAYS flat-merged via `ctx.putAll()` under the query's own output keys (e.g. `students`, `leads`, `ssigm_list`). Reference those real keys downstream, not a made-up `resultKey`. Consequence: two queries that emit the same key (e.g. both `students`) clobber each other in context.

**Auto-injection.** [`QueryNodeHandler:86`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/workflow/engine/QueryNodeHandler.java#L86) auto-adds `instituteId` from context if the params don't already include it. So most queries don't need to specify it.

**No dry-run gate.** `QueryNodeHandler` does NOT check `dryRun`, and several prebuilt keys mutate data (`createLiveSession`, `createSessionSchedule`, `createSessionParticipent`, `upsertUserCustomField`, `updateSSIGMRemaingDaysByOne`). A "Test Run" executes them for real.

**Param evaluation.** Each value in `params`:
- If `String` starting with `#` → SpEL evaluation against context
- Otherwise → used as-is (covers UUIDs, numbers, status strings)

### SEND_EMAIL

The most-used node. See [SEND_EMAIL deep dive](#send_email-deep-dive) for the full mechanics.

```jsonc
{
  "nodeType": "SEND_EMAIL",
  "config": {
    "templateName": "Welcome - New Student",
    "on": "#ctx['students']",                    // SpEL, must eval to List/Collection
    "forEach": {
      "operation": "SEND_EMAIL",
      "eval": "#ctx['item']"                     // per-iteration item access
    },
    "recipientField": "email",                   // which field on the item is the to-address
    "templateVars": {                            // placeholder → value (SpEL or literal)
      "fullName": "#ctx['item'].fullName",
      "instituteName": "#ctx['instituteName']"
    },
    "chunkSize": 50,                             // default 50 — emails per provider batch
    "throttleMs": 200,                           // default 200 — pause between chunks
    "chunkTimeoutMs": 30000                      // default 30s — kill hung chunks
  }
}
```

For single-recipient flows (e.g. one welcome email to the just-enrolled user), use `on: "{#ctx['user']}"` — a SpEL list literal wrapping one object. The handler auto-converts beans to Maps so per-item enrichment works.

### HTTP_REQUEST

Generic HTTP call. Used for LMS provisioning, third-party integrations.

```jsonc
{
  "nodeType": "HTTP_REQUEST",
  "config": {
    "resultKey": "createUserHttpResponse",
    "config": {
      "requestType": "EXTERNAL",                  // EXTERNAL or INTERNAL
      "condition": "#ctx['learndashUserId'] == null",  // optional — skip if false
      "method": "POST",
      "url": "#ctx['lmsConfig']['apiUrl'] + '/users'",
      "authentication": {
        "type": "BASIC",                          // BASIC or BEARER
        "username": "#ctx['lmsConfig']['apiKey']",
        "password": "#ctx['lmsConfig']['apiSecret']"
      },
      "body": {
        "username": "#ctx['user']['username']",
        "email": "#ctx['user']['email']",
        "password": "#ctx['user']['password']"
      }
    }
  }
}
```

Response stored at `#ctx['createUserHttpResponse']` for downstream nodes to read.

### SEND_PUSH_NOTIFICATION

⚠️ **STUB — does not send.** The handler logs the would-be push and returns `status: "dispatched"` but the FCM/APNs dispatch is a TODO. Do not use in a real workflow expecting a notification to arrive.

```jsonc
{
  "nodeType": "SEND_PUSH_NOTIFICATION",
  "config": {
    "recipientTokenExpression": "#ctx['user'].fcmToken",   // SpEL → token string
    "title": "Welcome!",
    "body": "Your enrollment is confirmed",
    "data": { "deeplink": "/dashboard" }
  }
}
```

### DELAY

Pauses execution. **Delays ≤60s use inline `Thread.sleep`; delays >60s use the LIVE persistent path** (updated 2026-07-07): `DelayNodeHandler` writes a `workflow_execution_state` row (`status=WAITING`, `resume_at`, full JSONB context, `pause_reason=DELAY`), marks the execution `PAUSED`, and returns `__workflow_paused`. [`WorkflowResumeJob`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/workflow/scheduler/WorkflowResumeJob.java) (registered in `QuartzConfig`, runs every ~2 min, cron `0 0/2 * * * ?`) picks up due rows via an atomic `claimForResume()` (multi-pod safe) and resumes from the paused node. So multi-day delays now survive JVM restarts. The same pause/resume machinery powers the `CALL_AI` node's re-dial loop (`pause_reason` `AI_CALL_RETRY` / `AI_CALL_RECHECK`).

Config is nested under `delay` — reads `delay.value` / `delay.unit`. A legacy flat `delayValue`/`delayUnit` shape is NOT read and executes as a 0-delay.

```jsonc
{
  "nodeType": "DELAY",
  "config": {
    "delay": {
      "value": 5,
      "unit": "MINUTES"   // SECONDS, MINUTES, HOURS, DAYS
    }
  }
}
```

**Until-next-weekday mode** _(added 2026-07-23)_ — waits until the STRICTLY next occurrence of a weekday at a given local time (an event landing on that same weekday waits a full week, unless `includeSameDay: true` and the time is still ahead that day). Uses the same persistent pause/resume path. Built for "drip starts next Monday regardless of signup day" flows; `WorkflowValidationService` validates the shape (weekday, HH:mm time, IANA timezone) and also rejects the legacy flat `delayValue`/`delayUnit`.

```jsonc
{
  "nodeType": "DELAY",
  "config": {
    "delay": {
      "until": "NEXT_DAY_OF_WEEK",
      "dayOfWeek": "MONDAY",
      "time": "09:00",            // optional, default 09:00
      "timezone": "Asia/Kolkata", // optional, default Asia/Kolkata
      "includeSameDay": false     // optional
    }
  }
}
```

### CONDITION

Boolean branch on a SpEL expression.

```jsonc
{
  "nodeType": "CONDITION",
  "config": {
    "condition": "#ctx['user'].password != null && #ctx['user'].password.length() > 0",
    "trueLabel": "Has password",
    "falseLabel": "No password",
    "routing": [
      { "type": "branch_true", "targetNodeId": "..." },
      { "type": "branch_false", "targetNodeId": "..." }
    ]
  }
}
```

### FILTER

Filter a list via per-item SpEL predicate.

```jsonc
{
  "nodeType": "FILTER",
  "config": {
    "source": "#ctx['leads']",
    "condition": "#item['age'] > 18",      // #item bound to each element
    "resultKey": "adultLeads"
  }
}
```

### AGGREGATE

COUNT / SUM / AVG / MIN / MAX over a list.

```jsonc
{
  "nodeType": "AGGREGATE",
  "config": {
    "source": "#ctx['students']",
    "operations": [
      { "type": "COUNT", "outputKey": "total" },
      { "type": "AVG", "field": "attendancePercentage", "outputKey": "avgAttendance" }
    ]
  }
}
```

### UPDATE_RECORD

Generic UPDATE on a whitelisted set of tables.

```jsonc
{
  "nodeType": "UPDATE_RECORD",
  "config": {
    "table": "enrollment",                  // whitelisted: enrollment, payment, student_session, learner, batch_enrollment, institute_learner, sub_org_member
    "where": { "id": "#ctx['enrollmentId']" },
    "set":   { "status": "ACTIVE", "updated_at": "#ctx['now']" }
  }
}
```

### LOOP

Iterate a list and re-fire a downstream sub-graph per item.

```jsonc
{
  "nodeType": "LOOP",
  "config": {
    "source": "#ctx['batches']",
    "itemVariable": "currentBatch"           // bound to #ctx['currentBatch'] inside the loop
  }
}
```

### SCHEDULE_TASK

Schedules a one-shot future execution via Quartz. Survives JVM restart (unlike DELAY).

```jsonc
{
  "nodeType": "SCHEDULE_TASK",
  "config": {
    "fireAt": "#ctx['scheduledTime']",       // ISO-8601 or epoch ms
    "subWorkflowId": "..."
  }
}
```

### SEND_WHATSAPP

WhatsApp send, list-iterated like SEND_EMAIL (`on` must resolve to a List; wrap singletons `{#ctx['user']}`). Mobile extracted from `mobileNumber`/`mobile_number`/`mobile`/`phoneNumber`/`phone_number`/`phone`/`to` (digits-sanitized). Supports named `templateVars` OR COMBOT-style positional `params` (presence of `params` skips template validation). WHATSAPP channel is rate-limited; single batch (no chunk/throttle/timeout knobs like email). `dryRun` suppresses the send. Result keys are snake_case (`processed_count`, …).

### COMBOT

Meta Cloud-API WhatsApp via `notification-service /v1/combot/send-template` (its own `RestTemplate`). ⚠️ **No `dryRun` gate, no rate limit, no execution logging, no dedup** — sends real messages even in a Test Run.

### TRANSFORM

Pure context shaping. `outputDataPoints[]` each compute a `fieldName` from a SpEL `compute` (or literal `value`); returns only the diff, which is `putAll`-merged. Common for building a WhatsApp/email payload list before an iterator node.

### ACTION

Dispatches to a `DataProcessorStrategyRegistry` strategy named by `dataProcessor`. Catalog processors: `ITERATOR` (per-item sub-operation, e.g. a QUERY per element of a list), `ACTIVATE_ENROLLMENT`, `SWITCH`. Unknown/missing `dataProcessor` → node FAILED ("Missing dataProcessor").

### SET_LEAD_STATUS

Resolves a lead by `responseId`/`leadId` (never `eventId`) and calls `changeLeadStatus(..., "AI_WORKFLOW")`. All misses are warn+no-op. ⚠️ **No `dryRun` gate — mutates lead status even in a Test Run.**

### CALL_AI

Places an AI voice call and drives a re-dial loop using the DELAY pause/resume machinery (`pause_reason` `AI_CALL_RETRY`/`AI_CALL_RECHECK`). Downstream nodes branch on `#ctx['callOutcome']`. This is the highest-volume node in production (Shiksha Nation "AI-call new leads").

> **Dead / stub node types:** `ROUTER` is in the `NodeType` enum and the FE palette but has **no handler** — a workflow containing it can't execute that node. `SEND_PUSH_NOTIFICATION` is a stub (see above). Don't author either.

---

## Trigger catalog

### Event-driven triggers

Defined in [`WorkflowTriggerEvent`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/workflow/enums/WorkflowTriggerEvent.java).

The enum has **38 values; 34 are actually emitted.** Key ones (verified 2026-07-07):

| Event name | Emitted from | Context keys produced | Status |
|---|---|---|---|
| `LEARNER_BATCH_ENROLLMENT` | `StudentRegistrationManager.triggerEnrollmentWorkflow` | `user` (UserDTO), `packageSessionIds`, `packageId`, `subOrg` | ✅ wired |
| `SUB_ORG_MEMBER_ENROLLMENT` / `_TERMINATION` | `SubOrgLearnerService` (@Async) | `user`, `subOrg`, `instituteId` | ✅ wired |
| `AUDIENCE_LEAD_SUBMISSION` | `AudienceService` (submitLead v1/v2 + form webhook) | `lead`, `customFields`, `respondentEmailRequests`, `adminEmailRequests`, `instituteName`, `campaignName` | ✅ wired |
| `AUDIENCE_OPT_OUT` | `AudienceService` | lead ctx | ✅ wired (⚠️ missing from catalog metadata) |
| `LEAD_ASSIGNED_TO_COUNSELOR` | `UserLeadProfileService`, `EnquiryService`, `AudienceService` | lead + counselor ctx | ✅ wired |
| `LEAD_STATUS_CHANGED` | `LeadStatusService`, `UserLeadProfileService`, `EnquiryService` | lead, `changeType` (LEAD_STATUS/CONVERSION_STATUS/TIER/ENQUIRY_STATUS) | ✅ wired |
| `LEAD_TAT_REMINDER_BEFORE` / `LEAD_TAT_OVERDUE` / `FOLLOW_UP_DUE` / `FOLLOW_UP_OVERDUE` | `LeadAutomationScheduler` (30-min cron) | lead ctx (triggerKey config-overridable) | ✅ wired |
| `LEAD_CALLED_BACK` | `AiCallOutcomeProcessor` | lead ctx | ✅ wired (⚠️ missing from catalog metadata; fires with `lead.instituteId()` — null-institute leads match nothing) |
| `LIVE_SESSION_CREATE` | `Step1Service` (+ bulk async helper) | `liveSession`, `instituteId` | ✅ wired |
| `LIVE_SESSION_START` | `LiveSessionNotificationProcessor` (~L242, 5-min Quartz scan) | `sessionId`, `scheduleId`, `instituteId` | ✅ wired |
| `LIVE_SESSION_END` | `LiveSessionNotificationProcessor` (~L292, 5-min Quartz scan — **NOT** the BBB callback) | `sessionId`, `scheduleId`, `eventId`, `instituteId` | ✅ wired |
| `PAYMENT_SUCCESS` / `PAYMENT_FAILED` | `PaymentLogService` | `paymentLog`, `user`, `userPlanId`, `packageSessionIds`, `enrollInviteId` (eventId=enrollInviteId, fallback instituteId) | ✅ wired |
| `ABANDONED_CART` | `LearnerEnrollmentEntryService` | `user`, `userPlanId`, `packageSessionId`, `packageId` | ✅ wired |
| `SUBSCRIPTION_CANCELLED` / `_TERMINATED` / `LEARNER_RE_ENROLLMENT` | `UserPlanService` | plan/user ctx | ✅ wired |
| `LEARNER_TERMINATION` | `LearnerTerminationWorkflowHelper` (@Async afterCommit) | learner ctx | ✅ wired |
| `MEMBERSHIP_EXPIRY` | `PackageSessionScheduler` (daily 09:00 cron) | expiring plan ctx | ✅ wired |
| `INVITE_CREATE` | `EnrollInviteService` | `invite` | ✅ wired |
| `INVITE_FORM_FILL` | `LearnerEnrollInviteService` | `invite`, `instituteId`, `inviteCode` | ⚠️ wired but fires on invite-page **VIEW**, not form submit |
| `COURSE_CREATED`, `DOUBT_RAISED`, `ASSIGNMENT_SUBMITTED` | respective services | domain ctx | ✅ wired |
| `ASSESSMENT_CREATE` / `_START` / `_END` | `assessment_service` → `WorkflowTriggerClient` → `InternalWorkflowController` (cross-service HTTP) | assessment ctx | ✅ wired |
| `INSTALLMENT_DUE_REMINDER` | `ManualReminderService` only (manual admin path; eventId=null → global triggers only) | `installment`, `learner`, `instituteId` | ✅ wired (no cron emitter) |
| `GENERATE_ADMIN_LOGIN_URL_FOR_LEARNER_PORTAL` / `SEND_LEARNER_CREDENTIALS` | `LearnerPortalAccessService` (SYNCHRONOUS — read result keys back from returned ctx) | portal ctx (eventId=instituteId) | ✅ wired |
| `LIVE_SESSION_FORM_SUBMISSION`, `ENROLLMENT_REPORTS`, `ASSESSMENT_FORM_SUBMISSION` | — | — | ⚠️ catalog-only, NOT emitted from anywhere |

**Priority matching.** When an event fires, resolution is by **`eventId` only** — `event_applied_type` plays NO role in matching (it is descriptive metadata copied into ctx). Order:
1. `findSpecificTriggers(instituteId, eventId, eventName)` — if ≥1 found, globals are SKIPPED.
2. Else `findGlobalTriggers(instituteId, eventName)` where `event_id IS NULL`.
3. **Additionally**, if ctx carries a `poolId`, pool-scoped triggers (eventId=poolId) are UNIONED on top of whichever result above — they always fire in addition, breaking the pure specific-else-global model.

Both queries also gate on parent `workflow.status = 'ACTIVE'` (so DRAFT/INACTIVE workflows never fire).

### Scheduled triggers

`WorkflowSchedule.schedule_type` is one of:
- `CRON` — uses `cron_expression` (e.g. `0 9 * * ?` = 9 AM daily, Quartz syntax)
- `INTERVAL` — uses `interval_minutes`
- `MONTHLY` — uses `day_of_month`

`timezone` controls when the cron evaluates. `schedule_status` must be `ACTIVE` for [`WorkflowExecutionJob`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/workflow/scheduler/WorkflowExecutionJob.java) to pick it up.

### Manual trigger

`POST /workflow/{workflowId}/trigger-now` fires a scheduled workflow on demand. **Strips `dryRun` from the request body** so real emails / side effects actually happen. Used by the "Run now" button on the workflow detail page.

---

## Context propagation

### Auto-injected by the engine

Set in [`WorkflowEngineService.run()`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/workflow/service/WorkflowEngineService.java) for every execution:

| Key | Type | Value source |
|---|---|---|
| `workflowId` | String | The workflow's UUID |
| `instituteId` | String | `Workflow.instituteId` column |
| `instituteName` | String | Resolved from `instituteRepository.findById(instituteId)`. Null/missing if institute not found. |
| `dryRun` | Boolean | `true` only when seed context had `dryRun=true` |

### Trigger-specific context keys

Layered on top by each trigger source. **Always merged BEFORE the auto-injected keys**, so trigger-supplied keys can be overridden — but typically aren't.

| Trigger | Keys |
|---|---|
| `LEARNER_BATCH_ENROLLMENT` | `user` (UserDTO with `username`, `email`, `password`, `fullName`, `mobileNumber`, `roles`, `isParent`, etc.), `packageSessionIds` (String), `packageId` (String), `subOrg` (Institute, nullable), `settingKey` (only set by `vet-onboarding` workflow's QUERY chain) |
| `AUDIENCE_LEAD_SUBMISSION` | `lead` (Map of customFields), `respondentEmailRequests` (List), `campaignName`, `submissionTime`, `instituteName` |
| `LIVE_SESSION_CREATE` | `liveSession` (LiveSession bean with `title`, `startTime`, `defaultMeetLink`, etc.) |
| `LIVE_SESSION_END` | `sessionId`, `scheduleId`, `eventId`, `instituteId`, `eventName`, `triggerId`, `triggerEvents` |
| `INSTALLMENT_DUE_REMINDER` | `installment`, `learner`, `instituteId` |
| `SCHEDULED` (any) | `scheduleId`, `scheduleName`, `executionTime` (epoch ms), `executionId` |

### SpEL syntax (quick reference)

Evaluator: [`SpelEvaluator`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/workflow/spel/SpelEvaluator.java) (standard Spring SpEL + `SafeTypeLocator`).

```spel
#ctx['key']                       // map access on context
#ctx['user'].username             // bean property access (UserDTO.getUsername())
#ctx['user']['username']          // SAME if user is a Map. For beans use dot notation.
{#ctx['user']}                    // list literal: [UserDTO] — list of one
{'a','b','c'}                     // list literal of strings
{#ctx['x'], #ctx['y']}            // list of multiple objects
#ctx['leads'].?[parentEmail != null]              // filter
#ctx['leads'].![email]                            // projection
#ctx['user'].password != null                     // boolean — used in CONDITION
T(java.lang.Math).max(0, #ctx['n'])               // static method — works for Math, etc.
T(java.lang.Runtime)                              // BLOCKED — SafeTypeLocator rejects
```

**Blocked types** (security guard, see `SafeTypeLocator`): `java.lang.Runtime`, `java.lang.ProcessBuilder`, `java.lang.System`, `java.lang.Class`, `java.lang.ClassLoader`, `java.lang.Thread`, `java.lang.reflect.*`, `java.io.File`, `java.nio.file.*`, `javax.script.*`, `java.net.URL`, `java.net.URI`.

### Common access patterns

| Want to access | SpEL |
|---|---|
| Just-enrolled user's username | `#ctx['user'].username` |
| Just-enrolled user's password | `#ctx['user'].password` |
| Institute display name | `#ctx['instituteName']` |
| Specific package config | `#ctx['lmsConfig']['apiUrl']` (after a QUERY fetched it) |
| Lead's email when iterating | `#ctx['item']['email']` (inside SEND_EMAIL `forEach.eval`) |
| Lead's custom field | `#ctx['item']['Full Name']` (custom fields use the field's case-sensitive name) |
| Audience trigger respondent | `#ctx['respondentEmailRequests']` (List of `{to, subject}`) |

---

## Prebuilt queries

Full list in [`QueryServiceImpl.execute()`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/workflow/service/QueryServiceImpl.java).

| `prebuiltKey` | Required params | Optional params | Returns |
|---|---|---|---|
| `fetch_batch_attendance_report` | `batchId` (CSV) OR `instituteId` (for "all batches" mode, capped at 500) | `daysBack` (default 7), `from`, `to` (yyyy-MM-dd; take precedence over daysBack) | `students[]` (Maps with `studentId`, `fullName`, `email`, `attendancePercentage`, `sessionsTableHtml`, `engagementLogs[]`, `parentsEmail`, `guardianEmail`, etc.), `totalStudents`, `batchCount`, `startDate`, `endDate`, `batchId` (echo) |
| `fetch_live_session_attendance` | `sessionId`, `scheduleId` | — | `presentStudents[]`, `absentStudents[]`, `presentCount`, `absentCount`, `sessionTitle`, `instituteName`, `meetingDate`, `startTime`, `sessionDurationMinutes`. Each student has `joinTime`, `attendedMinutes`, `attendancePercentage`, `attendanceBlockHtml` (pre-rendered, empty when join time is null). |
| `fetch_students_by_batch` | `batchId` | — | `students[]` (basic enrollment data — NO attendance) |
| `fetch_audience_responses_filtered` | `instituteId` | `audienceId` (CSV), `daysAgo`, `startDate`, `endDate` | `leads[]` (Maps with `email`, `parentEmail`, `parentName`, `mobileNumber`, `userId`, `instituteName`, plus all `customFields`) |
| `fetch_audience_responses_by_day_difference` | `instituteId`, `audienceId` (CSV), `daysAgo` | — | `leads[]` (responses with `workflowActivateDayAt` matching exactly N days ago) |
| `fetch_enroll_invites` | `instituteId` | filters | Invite link stats |
| `fetch_expiring_memberships` | `instituteId` | `daysUntilExpiry` (or `daysAhead`) | Institute-scoped: `UserPlanRepository.findActivePlansExpiringSoonByInstitute` returns this institute's ACTIVE plans whose `end_date` is within the next N days. Returns `expiringMemberships[]` (userPlanId, userId, email, fullName, mobileNumber, endDate) + `expiringCount`. (Fixed 2026-07-07 — previously did an unscoped `findAll()` across all tenants. Note: plans with NULL `enroll_invite_id` — e.g. some sub-org plans — are not returned, same as the MEMBERSHIP_EXPIRY scheduler.) |
| `fetch_upcoming_fee_installments` | `instituteId` | `daysAhead` | `feePaymentList[]` (⚠️ DB query not institute-scoped; `instituteId` applied as an in-memory post-filter, so all tenants' pending installments in the window are loaded per run) |

> This table is a subset. `QueryServiceImpl.execute()` actually dispatches **23 keys** — including mutating ones (`createLiveSession`, `createSessionSchedule`, `createSessionParticipent`, `upsertUserCustomField`, `updateSSIGMRemaingDaysByOne`) and lead/CRM helpers. The catalog (`/query-keys`) lists only 21 and has ~12 param-name mismatches vs the code (e.g. catalog `statuses` → code `statusList`; `fieldId` → `customFieldId`; `studentId` → `userId`) plus 2 implemented keys it omits (`fetch_live_session_attendance`, `fetch_enrollment_details`). Treat `QueryServiceImpl` as the source of truth, not the catalog. Also note list-item field-name **casing differs per query** — `fetch_ssigm_by_package` returns snake_case (`full_name`, `mobile_number`), while `fetch_batch_attendance_report`/`fetch_students_by_batch` return camelCase (`fullName`, `mobileNumber`); `fetch_audience_responses_filtered` keeps custom-field keys in RAW case but `fetch_audience_responses_by_day_difference` LOWERCASES them.
| `fetch_package_lms_setting` | `packageId`, `settingKey` (typically `"LMS_SETTING"`) | — | `{ lmsConfig: { apiUrl, apiKey, apiSecret, activeLms, ... } }` or `{ lmsConfig: null }` if not configured |
| `fetch_institute_setting` | `instituteId`, `settingKey` | — | `{ lmsConfig: <object> }` |
| `fetch_student_attendance_report` | `userId`, `batchId` | `daysBack` (default 7) | Per-student attendance + engagement |
| `fetch_user_with_password` | `userId` | — | UserDTO with password populated (one auth-service round-trip) |
| `upsert_user_custom_field` | `userId`, `customFieldId`, `value` | — | Confirms update — used to store Moodle creds, etc. |

---

## Execution semantics

### Idempotency & multi-pod

Every execution attempt INSERTs into `workflow_execution` with `idempotency_key`:
- **Scheduled:** `workflow_schedule_{scheduleId}_{nextRunAtMillis}` (the slot time doubles as the cross-pod race lock). ✅ real.
- **Event/trigger:** there is **NO fixed format.** The key comes from a pluggable per-trigger strategy read from `workflow_trigger.idempotency_generation_setting` (JSON) via `IdempotencyStrategyFactory`. **The default, when unset or unparseable, is a random UUID = effectively NO dedup.** Strategies: `UUID`, `NONE` (also random UUID), `TIME_WINDOW`, `CONTEXT_BASED`, `CONTEXT_TIME_WINDOW`, `EVENT_BASED` (format `trigger_{triggerId}_eventType_{name}_eventId_{id}`, segments toggleable), `CUSTOM_EXPRESSION` (SpEL). The builder defaults to `{"strategy":"UUID"}` except `LIVE_SESSION_START`/`END` and `MEMBERSHIP_EXPIRY`, which use `EVENT_BASED` for cross-replica exactly-once. **Set `EVENT_BASED` for any at-least-once emitter you don't want double-firing.**
- **Webhook:** `webhook-{slug}-{millis}` (no dedup).
- **Manual (`/{id}/trigger-now`):** runs synchronously with NO idempotency key and creates NO `workflow_execution` row at all — invisible to history + dedup.

UNIQUE constraint on the column means only one pod's INSERT wins. The others get `DataIntegrityViolationException`, caught at [`WorkflowExecutionJob:111-120`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/workflow/scheduler/WorkflowExecutionJob.java#L111) and logged as a friendly WARN.

**Side effect:** Hibernate writes ERROR-level logs from the duplicate-key INSERT *before* the application's catch block fires. The WARN below them is the truthful outcome. Don't chase the ERROR.

### Failure modes

| Where it fails | What happens |
|---|---|
| Single node throws inside `handle()` | Caught by the handler, logs the node execution as FAILED with `error_message`, returns a `changes` map with `error` key. **Workflow continues to the next node.** |
| SpEL evaluation throws | `SpelEvaluationException` propagates up — the calling handler catches it. Node logs FAILED. |
| `WorkflowEngineService.run()` itself throws | Top-level catch logs to Sentry; execution row goes to FAILED. |
| `WorkflowExecutionJob` retries | Idempotency check prevents the same `(scheduleId, fireTime)` from running twice even if the job retries. |

**Important:** the engine **does not propagate node FAILED status up to the workflow-level status**. A workflow with one failed QUERY node still shows as COMPLETED. To detect, you must drill into the per-node logs.

### Dry-run

Setting `dryRun=true` on the seed context propagates through every handler:
- `SendEmailNodeHandler` builds the email requests but skips the provider dispatch
- `HttpRequestNodeHandler` logs the would-be request but doesn't fire
- `UpdateRecordNodeHandler` skips the SQL
- `SendPushNotificationNodeHandler` skips FCM

Used by the workflow builder's "Test run" button. The "Run now" endpoint explicitly STRIPS dryRun before invoking the engine.

---

## SEND_EMAIL deep dive

Handler: [`SendEmailNodeHandler`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/workflow/engine/SendEmailNodeHandler.java).

### Iteration model

1. Evaluate `on` SpEL expression against context → must be a `List` or `Collection`. Otherwise → status=`error`.
2. For each item in the list:
   - Build `itemContext` = full context + `_recipientField` + `item` = the iteration item
   - **If item is a Java bean (not a Map): convert via `objectMapper.convertValue(item, Map.class)`** so `templateName`/`templateVars` enrichment can attach
   - Enrich the item Map with `templateName` (from node config) and `templateVars` (from node config) — these tell the per-item processor "use this template, with these var mappings"
   - Call `processForEachOperation(forEachConfig, itemContext, ...)` which extracts the recipient, resolves the template, substitutes variables, builds a `SendEmailRequest`
3. Collect all `SendEmailRequest` into `allEmailRequests`
4. Chunk + dispatch (see below)

### Chunking + throttle + per-chunk timeout

Defaults: `chunkSize=50`, `throttleMs=200`, `chunkTimeoutMs=30_000`. All overridable per-node.

```
for each chunk of {chunkSize} requests:
   submit chunk send to chunkExecutor (daemon thread pool)
   wait up to chunkTimeoutMs for the result
       TimeoutException → log, drop those emails, continue
       ExecutionException → re-throw, fail the node
       InterruptedException → restore flag + re-throw
   if not last chunk: Thread.sleep(throttleMs)
```

For 2000 emails at defaults: ~40 chunks × 200ms throttle = 8s of throttling + provider latency. Healthy run takes 30-60s.

### Recipient extraction (`extractEmailAddress`)

Looks for the recipient address in this order (`SendEmailNodeHandler` ~1080-1136):

1. If node config has `recipientField` set: `item[recipientField]`
2. `item` itself, if it's an email-shaped string
3. `to` → `email` → `emailAddress` → `email_address` → `userEmail` → `user_email` → `mail` → `channelId` → `recipientEmail` → `recipient_email` → `parentsEmail` → `guardianEmail` → `motherEmail`
4. **Fallback scan**: walks every value in the item map and picks the first one that looks email-shaped (contains `@`, no spaces). Safety net for audience custom fields named "Email" (capital E).

Note `to` **outranks** `email`, and there is no `parentEmail` field — it's `parentsEmail`, near the end. If no email found → request is skipped (counted in `skippedCount`).

### Variable substitution pipeline

For each `{{key}}` placeholder in the resolved template body / subject:

1. Look up `templateVars[key]` from the node config
2. If the value starts with `#` (SpEL) → evaluate against the item's context
3. If the value is a plain string → look up as a key on the item map
4. If neither resolves → leave `{{key}}` as literal in the body (means: probable misconfiguration)

**Pre-rendered HTML snippet pattern.** Templates here use plain `{{var}}` substitution — no `{{#if}}` support. To conditionally render sections, the backend builds an HTML string and exposes it as one placeholder (e.g. `{{sessionsTableHtml}}`, `{{attendanceBlockHtml}}`). The template just references it; the backend decides whether the content is the full HTML or empty.

---

## Frontend architecture

### Main entry points (admin dashboard)

| Route | Component | Purpose |
|---|---|---|
| `/workflow/list` | [`workflow-list-page.tsx`](../frontend-admin-dashboard/src/routes/workflow/list/-components/workflow-list-page.tsx) | List + status of all institute workflows |
| `/workflow/create` | [`workflow-create-page.tsx`](../frontend-admin-dashboard/src/routes/workflow/create/-components/workflow-create-page.tsx) | New workflow flow: trigger → use-case wizard OR advanced builder |
| `/workflow/{id}` | [`workflow-details-page.tsx`](../frontend-admin-dashboard/src/routes/workflow/$workflowId/-components/workflow-details-page.tsx) | Diagram / Executions / Debug tabs; Run-now + Delete modals |
| `/workflow/{id}/edit` | (uses the create page in edit mode) | Edit existing workflow |

### Key components

| Component | Lives in | Purpose |
|---|---|---|
| Use-case wizard step | [`use-case-wizard-step.tsx`](../frontend-admin-dashboard/src/routes/workflow/create/-components/use-case-wizard-step.tsx) | Renders the wizard with template cards + per-template questions |
| Use-case templates | [`use-case-templates.ts`](../frontend-admin-dashboard/src/routes/workflow/create/-components/use-case-templates.ts) | The 26 use cases. Each has `id`, `name`, `triggerEvents`, `questions[]`, `generateWorkflow(answers, triggerEvent)` |
| Sample templates | [`sample-email-templates.ts`](../frontend-admin-dashboard/src/routes/workflow/create/-components/sample-email-templates.ts) | Starter email templates created on-demand by the wizard |
| Node config panel | [`node-config-panel.tsx`](../frontend-admin-dashboard/src/routes/workflow/create/-components/node-config-panel.tsx) | Per-node config UI (template variable mapping dropdown, recipient field picker, etc.). `FIELD_OPTIONS` map at ~L361 + `CONTEXT_FIELDS` at ~L400 define the dropdown options. |
| Entity picker | [`event-entity-picker.tsx`](../frontend-admin-dashboard/src/routes/workflow/create/-components/event-entity-picker.tsx) | Multi-select for batches / audiences / sessions / invites. Includes search. |
| Variable picker | [`variable-picker.tsx`](../frontend-admin-dashboard/src/routes/workflow/create/-components/variable-picker.tsx) | Searchable dropdown for upstream node variables |
| Condition builder | [`condition-builder.tsx`](../frontend-admin-dashboard/src/routes/workflow/create/-components/condition-builder.tsx) | Visual builder for SpEL conditions (`[var] [op] [value]`) |
| Aggregate builder | [`aggregate-builder.tsx`](../frontend-admin-dashboard/src/routes/workflow/create/-components/aggregate-builder.tsx) | Visual op-row builder for AGGREGATE nodes |
| Key-value builder | [`key-value-builder.tsx`](../frontend-admin-dashboard/src/routes/workflow/create/-components/key-value-builder.tsx) | For UPDATE_RECORD WHERE/SET, plus generic key-value cases |
| Workflow diagram | [`workflow-diagram-simple.tsx`](../frontend-admin-dashboard/src/routes/workflow/$workflowId/-components/workflow-diagram-simple.tsx) | Read-only DAG render for the detail page |
| Execution history | [`execution-history-tab.tsx`](../frontend-admin-dashboard/src/routes/workflow/$workflowId/-components/execution-history-tab.tsx) | Lists past executions; "View on Diagram" → debug flow |
| Execution flow viewer | [`execution-flow-viewer.tsx`](../frontend-admin-dashboard/src/routes/workflow/$workflowId/-components/execution-flow-viewer.tsx) | Overlays per-node status onto the diagram for debugging |

### State management

- **TanStack Query** for server state. Important query keys:
  - `['GET_ACTIVE_WORKFLOWS_WITH_SCHEDULES', instituteId]` — list page
  - `['GET_WORKFLOW_DIAGRAM', workflowId]` — diagram
  - `['EXECUTION_LOGS', executionId]` — per-execution log
  - `['EXECUTION_SUMMARY', workflowId, startDate, endDate]` — aggregate stats
  - `['wizard-batches', instituteId]`, `['wizard-audiences', instituteId]`, `['wizard-email-templates']` — wizard pickers
- **Zustand** for workflow builder local state: [`workflow-builder-store.ts`](../frontend-admin-dashboard/src/routes/workflow/create/-stores/workflow-builder-store.ts). Holds in-progress nodes/edges/trigger config.

### Cache invalidation patterns

After create/delete:
```ts
await queryClient.invalidateQueries({
    queryKey: ['GET_ACTIVE_WORKFLOWS_WITH_SCHEDULES'],
    refetchType: 'all',
});
```

After creating a sample template via the wizard:
```ts
await queryClient.invalidateQueries({ queryKey: ['wizard-email-templates'] });
```

---

## Wizard template catalog (current 26 use cases)

Each lives in [`use-case-templates.ts`](../frontend-admin-dashboard/src/routes/workflow/create/-components/use-case-templates.ts). Trigger event(s) listed; the wizard only shows templates compatible with the selected trigger.

Categorized:

**Welcome / onboarding:**
- `welcome_enrolled_student` — Welcome email to student (LEARNER_BATCH_ENROLLMENT / SUB_ORG_MEMBER_ENROLLMENT)
- `vet_onboarding_workflow` — Multi-node LMS provisioning workflow (LEARNER_BATCH_ENROLLMENT)

**Live class:**
- `live_session_invite_batch` — Send live session invite to a batch (LIVE_SESSION_CREATE)
- `live_session_reminder` — N-minute reminder before live session start
- `live_session_end_recap` — Post-class email to present & absent (LIVE_SESSION_END)

**Attendance / engagement:**
- `scheduled_batch_report` — Daily/weekly attendance report (SCHEDULED)
- `scheduled_engagement_summary` — Engagement digest for instructors
- `scheduled_parents_attendance` — Parents-only attendance report

**Audience / lead nurture:**
- `audience_lead_confirmation` — Confirmation email on form submit (AUDIENCE_LEAD_SUBMISSION)
- `lead_followup_email` — N-days-after-submission follow-up
- `scheduled_audience_followup` — Same as above but on a recurring schedule
- `lead_drip_day3` / `lead_drip_day7` — Drip nurture sequence

**Fees / membership:**
- `fee_reminder_before_due` — X days before installment due
- `fee_overdue_reminder` — After due date
- `membership_renewal_reminder` — Expiring soon
- `membership_terminated_notice` — When access removed

**Parents / guardians:**
- `email_parents_batch` — Notification to parents of a batch
- `parents_session_reminder` — Parents copy of session reminders

**Operational / generic:**
- `generic_admin_notification` — Email admin when an event fires
- `generic_invite_digest` — Invite link stats digest
- ... (a few more — see file)

---

## Common recipes

### Recipe: add a new prebuilt query

1. Open [`QueryServiceImpl.java`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/workflow/service/QueryServiceImpl.java)
2. Add a `case "your_new_key": return yourNewMethod(params);` in `execute()` (around line 100)
3. Implement `private Map<String, Object> yourNewMethod(Map<String, Object> params)`:
   - Pull params, validate
   - Run repository / service calls
   - Build result map. Use `Collections.singletonMap("key", nullableValue)` if a key may be null (Map.of rejects nulls).
   - Wrap in `try / catch (Exception e) { return Map.of("error", safeErrorMessage(e)); }`
4. Add to the catalog returned by `WorkflowCatalogController.queryKeys()` if you want it to show up in the workflow builder dropdown (otherwise it works but isn't discoverable in UI)

### Recipe: add a new trigger event

1. Add the enum value to [`WorkflowTriggerEvent`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/workflow/enums/WorkflowTriggerEvent.java)
2. Add metadata to `WorkflowCatalogController.triggerEvents()` — label, description, category, `event_applied_type`
3. **Wire emission** — find the code path where the event happens (e.g. a service method) and call:
   ```java
   workflowTriggerService.handleTriggerEvents(
       WorkflowTriggerEvent.YOUR_EVENT.name(),
       eventId,           // the entity ID this event is about (batch ID, session ID, etc.)
       instituteId,
       contextData        // Map of trigger-specific keys
   );
   ```
4. Document the context keys produced in this doc's [Trigger catalog](#trigger-catalog) table

### Recipe: add a new node type

1. Add the type string to the workflow JSON shape used by the frontend
2. Create the handler: `admin_core_service/.../workflow/engine/YourNewNodeHandler.java`
   - Implement `NodeHandler`
   - Register via Spring `@Component` so `NodeHandlerRegistry` picks it up
   - Return a `Map<String, Object>` (the `changes` map) that gets merged into the context
3. Add UI rendering in [`node-config-panel.tsx`](../frontend-admin-dashboard/src/routes/workflow/create/-components/node-config-panel.tsx) — a new branch in the `data.nodeType ===` switch
4. Add a draggable card in the workflow builder's node palette

### Recipe: add a new wizard template (use case)

1. Open [`use-case-templates.ts`](../frontend-admin-dashboard/src/routes/workflow/create/-components/use-case-templates.ts)
2. Add an entry to the exported array:
   ```ts
   {
       id: 'your_use_case',
       name: 'Your use case display name',
       description: 'One-line description shown on the card',
       icon: '✉️',
       triggerEvents: ['LEARNER_BATCH_ENROLLMENT'],   // compatible triggers, or [] for SCHEDULED
       workflowType: 'EVENT_DRIVEN',                   // or 'SCHEDULED' or 'BOTH'
       questions: [
           { id: 'templateName', label: 'Which template?', type: 'template_select', required: true },
           // ... more questions
       ],
       generateWorkflow: (answers, triggerEvent) => {
           const triggerNode = makeNode('TRIGGER', '...', { triggerEvent: triggerEvent }, 250, 50, true);
           // ... build nodes
           return { nodes: [...], edges: [...], workflowDescription: '...' };
       },
   }
   ```
3. (Optional) Add a sample email template in [`sample-email-templates.ts`](../frontend-admin-dashboard/src/routes/workflow/create/-components/sample-email-templates.ts) — set `variables[]` to the placeholders used in the HTML body so the wizard can populate `dynamic_parameters` when it auto-creates the template

### Recipe: add a new placeholder to the variable mapping dropdown

1. Decide if it's an item field (per-iteration) or context field (always available)
2. Open [`node-config-panel.tsx`](../frontend-admin-dashboard/src/routes/workflow/create/-components/node-config-panel.tsx)
3. For an **item field** (when iterating a specific list): add an entry to `FIELD_OPTIONS[<source-expression>]` array
4. For a **context field** (auto-available): add to `CONTEXT_FIELDS` array

```ts
{ value: "#ctx['user'].fullName", label: 'Learner Full Name (from trigger)' }
```

---

## Debugging guide

### "Workflow didn't fire"

1. **Check trigger is wired.** Cross-reference [Trigger catalog](#trigger-catalog) — is the event actually emitted from somewhere?
2. **Check trigger row is ACTIVE.**
   ```sql
   SELECT * FROM workflow_trigger WHERE workflow_id = '<wf-id>';   -- trigger_status = 'ACTIVE'?
   SELECT * FROM workflow_schedule WHERE workflow_id = '<wf-id>';  -- schedule_status = 'ACTIVE'?
   ```
3. **Check there's no priority loss.** Multiple triggers can match one event — the most specific one wins. Your trigger might be losing to another, more specific one.
4. **Check the emission code path was actually hit.** Add a log right before the `handleTriggerEvents` call, or check Sentry for breadcrumbs.

### "Workflow ran but no email"

1. **Look at the execution log:**
   ```sql
   SELECT * FROM workflow_execution_log
   WHERE execution_id = '<exec-id>'
   ORDER BY started_at;
   ```
2. **QUERY node FAILED?** `error_message` column has the stacktrace. Common culprits:
   - `Map.of` NPE — null value somewhere (e.g. course_setting not configured)
   - Missing param — query returned `{"error": "Missing X"}`
3. **QUERY node SUCCESS but `totalStudents=0`?** Look at `outputContext.batchCount`. If batch count matches but students is zero, the per-batch query returned no rows — likely no attendance records / sessions in the date range.
4. **SEND_EMAIL node SUCCESS with `successCount=0`?** Check `skippedCount` and `failureCount`:
   - `skippedCount > 0` → recipients without an email field (`extractEmailAddress` couldn't resolve)
   - `failureCount > 0` → provider rejected (rate limit, invalid format, etc.)

### "Variables show as literal `{{var}}` in email"

Two main causes:

1. **Template's `dynamic_parameters` is empty** → workflow builder didn't show the mapping UI → `templateVars` was never set on the node config.
   ```sql
   SELECT id, name, dynamic_parameters
   FROM message_template
   WHERE name = '<template name>';
   ```
   Fix: edit the template, add JSON `{ "var1": "Label 1", "var2": "Label 2" }` to `dynamic_parameters`, then re-open the node and set the mappings.

2. **`templateVars` is set but the SpEL evaluates to null/missing.** Check the node config JSON in `workflow_node_mapping.config_override_json` — is `templateVars` present? Are the values correct SpEL expressions?

### "Duplicate execution warnings in logs"

Expected behavior with multi-pod deployments. The Hibernate ERROR-level logs are followed by a friendly WARN:
```
Workflow schedule <id> is already being executed by another instance (Duplicate key). Skipping execution.
```
This is the truth. The ERROR above it is JDBC noise. The workflow ran exactly once.

To silence the noise: `logging.level.org.hibernate.engine.jdbc.spi.SqlExceptionHelper=WARN`.

---

## Gotchas — current behavior to know

- **`LIVE_SESSION_START` / `LIVE_SESSION_END` fire from a 5-min Quartz scan** (`LiveSessionNotificationProcessor` ~L242/L292), NOT the BBB callback. They're periodic-scan approximations, not instantaneous. (Older docs called START catalog-only and END a BBB-callback — both wrong.)
- **DELAY's persistent path is LIVE.** Delays >60s pause to `workflow_execution_state` and resume via `WorkflowResumeJob` (every 2 min), surviving JVM restarts. (Older docs said this was disabled.) The ≤60s inline path still uses `Thread.sleep`.
- **Engine never throws; node FAILED never propagates.** `WorkflowEngineService.run` swallows all node exceptions AND keeps routing past the failed node, so trigger-path executions are ALWAYS marked COMPLETED even if every node failed. In prod there have been **0 FAILED `workflow_execution` rows since January** despite ongoing node-level failures. The Executions tab is unreliable for detecting node errors — assert on per-node `SUCCESS` in `workflow_execution_log`, not workflow status.
- **`/{id}/trigger-now` creates no `workflow_execution` row.** Manual production runs are invisible to history and to dedup.
- **INTERVAL schedules silently degrade.** The dispatcher only reads `cron_expr`; a cron-less (INTERVAL/day_of_month) schedule falls back to the every-minute default `0 * * * * ?` and becomes due on every 15-min tick.
- **`INVITE_FORM_FILL` fires on invite-page VIEW, not form submission** — workflows keyed on it will fire per page view.
- **Dry-run is not fully safe.** QUERY (incl. mutating keys), `SET_LEAD_STATUS`, and `COMBOT` have no `dryRun` gate and execute for real during a Test Run.
- **BBB `providerJoinTime` is overwritten on rejoin** ([LiveSessionProviderController.markBbbAttendance:659](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/live_session/provider/controller/LiveSessionProviderController.java#L659)). For students with unstable connections, the recorded join time is the latest reconnect, not the original.
- **Zoho's `providerJoinTime` may not be set when the analytics callback hasn't fired yet.** The `attendanceBlockHtml` snippet handles this — empty block when null.
- **`SessionSchedule.lastEntryTime` is the late-entry cutoff, not the session end time.** There's no stored `durationMinutes`. The `fetchLiveSessionAttendance` query derives session length as `max(providerTotalDurationMinutes)` across present attendees.
- **`Map.of(...)` rejects null values.** Use `Collections.singletonMap(key, nullableValue)` when a nullable field needs to be in a single-entry map. Use `safeErrorMessage(throwable)` helper in catch blocks (NPE's `getMessage()` is null).
- **Audience-form custom field names are case-sensitive in `customFields` map but `SendEmailNodeHandler.extractEmailAddress` scans values for email shape as a fallback.** Templates that reference `{{Full Name}}` (capital F) need that exact case.
- **Wizard "Use sample template" button POSTs `dynamic_parameters` populated from the sample's `variables[]`.** Templates created any other way may have empty `dynamic_parameters` → variable mapping UI won't show.
- **The "Add Manually" enrollment UI hits the same bulk-assign endpoint as CSV upload** (`POST /admin-core-service/v3/learner-management/assign`). All credential/password handling is the same.
- **`BulkAssignmentService.bulkAssign` reads passwords back from auth-service** via `getUsersFromAuthServiceWithPasswordByUserId` for every user in the resulting `userMap`, including pre-existing ones. Used so welcome emails can include login credentials without overwriting existing-user passwords.
- **Hibernate ERROR-level logs from duplicate-key INSERT are not real errors.** The application's catch block runs after them; the WARN below is the truth.

---

## File map (most useful files for debugging)

### Backend (`admin_core_service/`)

| Area | Path |
|---|---|
| Engine | `features/workflow/service/WorkflowEngineService.java` |
| Quartz job | `features/workflow/scheduler/WorkflowExecutionJob.java` |
| Event dispatch | `features/workflow/service/WorkflowTriggerService.java` |
| SpEL | `features/workflow/spel/SpelEvaluator.java` |
| Idempotency | `features/workflow/service/IdempotencyService.java` |
| Schedule mgmt | `features/workflow/service/WorkflowScheduleService.java` |
| Builder service | `features/workflow/service/WorkflowBuilderService.java` |
| Queries | `features/workflow/service/QueryServiceImpl.java` |
| Catalog API | `features/workflow/controller/WorkflowCatalogController.java` |
| Workflow CRUD API | `features/workflow/controller/WorkflowController.java` |
| Manual trigger | `features/workflow/controller/WorkflowController.java` (the `/{id}/trigger-now` endpoint) |
| Execution logs API | `features/workflow/controller/WorkflowExecutionController.java` |
| Learner reports | `features/workflow/controller/LearnerAttendanceReportController.java` |
| Node handlers | `features/workflow/engine/*NodeHandler.java` |
| Trigger event enum | `features/workflow/enums/WorkflowTriggerEvent.java` |
| Entities | `features/workflow/entity/{Workflow,WorkflowNodeMapping,NodeTemplate,WorkflowTrigger,WorkflowSchedule,WorkflowExecution,WorkflowExecutionLog}.java` |

### Frontend (`frontend-admin-dashboard/src/`)

| Area | Path |
|---|---|
| Workflow service | `services/workflow-service.ts` |
| Routes | `routes/workflow/...` |
| Wizard | `routes/workflow/create/-components/use-case-wizard-step.tsx` |
| Use cases | `routes/workflow/create/-components/use-case-templates.ts` |
| Sample templates | `routes/workflow/create/-components/sample-email-templates.ts` |
| Node config | `routes/workflow/create/-components/node-config-panel.tsx` |
| Entity picker | `routes/workflow/create/-components/event-entity-picker.tsx` |
| Variable picker | `routes/workflow/create/-components/variable-picker.tsx` |
| Condition builder | `routes/workflow/create/-components/condition-builder.tsx` |
| Aggregate builder | `routes/workflow/create/-components/aggregate-builder.tsx` |
| Key-value builder | `routes/workflow/create/-components/key-value-builder.tsx` |
| Detail page | `routes/workflow/$workflowId/-components/workflow-details-page.tsx` |
| Diagram | `routes/workflow/$workflowId/-components/workflow-diagram-simple.tsx` |
| Execution history | `routes/workflow/$workflowId/-components/execution-history-tab.tsx` |
| Debug viewer | `routes/workflow/$workflowId/-components/execution-flow-viewer.tsx` |
| Store | `routes/workflow/create/-stores/workflow-builder-store.ts` |
| Types | `types/workflow/workflow-types.ts` |

### Frontend (`frontend-learner-dashboard-app/src/`)

| Area | Path |
|---|---|
| Attendance report page | `components/common/reports/attendance-report-page.tsx` |
| Attendance service | `services/attendance/getFullAttendanceReport.ts` |

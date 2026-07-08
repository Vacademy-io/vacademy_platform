# Workflow Enhancement — Documentation

## Overview

This document covers all the changes made to the workflow automation system, including new trigger events, priority-based trigger matching, new query operations, persistent delay support, frontend UX redesign, and service integrations.

---

## Table of Contents

1. [Database Changes](#1-database-changes)
2. [New Trigger Events](#2-new-trigger-events)
3. [Event Applied Type & Priority Matching](#3-event-applied-type--priority-matching)
4. [New Query Operations](#4-new-query-operations)
5. [Persistent Delay Node](#5-persistent-delay-node)
6. [Service Integrations (Where Triggers Fire)](#6-service-integrations)
7. [Assessment Service Integration](#7-assessment-service-integration)
8. [Frontend Changes](#8-frontend-changes)
9. [Idempotency & Multi-Pod Safety](#9-idempotency--multi-pod-safety)
10. [Email Templates](#10-email-templates)
11. [Sample Workflows](#11-sample-workflows)
12. [Files Changed](#12-files-changed)

---

## 1. Database Changes

### Migration: `V203__Add_event_applied_type_to_workflow_trigger.sql`

Adds `event_applied_type` column to `workflow_trigger` table:

```sql
ALTER TABLE workflow_trigger ADD COLUMN event_applied_type VARCHAR(50) NULL;
CREATE INDEX idx_workflow_trigger_event_applied_type ON workflow_trigger(event_applied_type);
```

The column is **nullable** — existing triggers continue working without it. Backfill existing triggers manually:

```sql
UPDATE workflow_trigger SET event_applied_type = 'PACKAGE_SESSION'
WHERE trigger_event_name IN ('LEARNER_BATCH_ENROLLMENT', 'GENERATE_ADMIN_LOGIN_URL_FOR_LEARNER_PORTAL',
    'SEND_LEARNER_CREDENTIALS', 'SUB_ORG_MEMBER_ENROLLMENT', 'SUB_ORG_MEMBER_TERMINATION');
UPDATE workflow_trigger SET event_applied_type = 'AUDIENCE'
WHERE trigger_event_name = 'AUDIENCE_LEAD_SUBMISSION';
UPDATE workflow_trigger SET event_applied_type = 'INSTITUTE'
WHERE trigger_event_name = 'INSTALLMENT_DUE_REMINDER';
```

### Existing Table Used: `workflow_execution_state` (from V180)

Entity and repository created for the existing table to support persistent delay:
- `WorkflowExecutionState.java` — JPA entity
- `WorkflowExecutionStateRepository.java` — with `claimForResume()` for atomic multi-pod claiming

### New Enum Value: `WorkflowExecutionStatus.PAUSED`

Added to support paused workflow executions during long delays.

---

## 2. New Trigger Events

### `WorkflowTriggerEvent.java` — 14 new values added

| Event | Category | When it fires |
|-------|----------|---------------|
| `LIVE_SESSION_CREATE` | Live Session | Admin creates a new live session |
| `LIVE_SESSION_START` | Live Session | Live session starts |
| `LIVE_SESSION_END` | Live Session | Live session ends |
| `LIVE_SESSION_FORM_SUBMISSION` | Live Session | Learner submits live session registration form |
| `PAYMENT_FAILED` | Payment | Payment fails during enrollment |
| `ABANDONED_CART` | Payment | User starts enrollment but doesn't complete payment |
| `INVITE_CREATE` | Invites | Admin creates a new enrollment invite |
| `INVITE_FORM_FILL` | Invites | Learner fills the enrollment invite form |
| `MEMBERSHIP_EXPIRY` | CRM | User's membership/subscription is about to expire |
| `ENROLLMENT_REPORTS` | CRM | Periodic enrollment report generation |
| `ASSESSMENT_CREATE` | Assessment | Admin creates a new assessment (cross-service) |
| `ASSESSMENT_START` | Assessment | Student starts an assessment attempt (cross-service) |
| `ASSESSMENT_END` | Assessment | Student submits an assessment (cross-service) |
| `ASSESSMENT_FORM_SUBMISSION` | Assessment | Assessment registration form submitted (cross-service) |

All original 7 events are preserved unchanged.

### `EventAppliedType.java` — New enum

Values: `PACKAGE_SESSION`, `AUDIENCE`, `LIVE_SESSION`, `ENROLL_INVITE`, `PAYMENT`, `USER_PLAN`, `INSTITUTE`, `ASSESSMENT`

Maps each trigger event to the entity type it's scoped to. Used for:
- UI display (showing what entity type the trigger applies to)
- Entity picker (loading the right dropdown — batches, audiences, invites, etc.)

---

## 3. Event Applied Type & Priority Matching

### How `event_applied_type` Works

Each trigger event has an associated entity type. The `event_id` on `workflow_trigger` refers to a specific entity of that type:

| Trigger Event | `event_applied_type` | `event_id` is a... |
|--------------|---------------------|-------------------|
| LEARNER_BATCH_ENROLLMENT | PACKAGE_SESSION | packageSessionId |
| AUDIENCE_LEAD_SUBMISSION | AUDIENCE | audienceId |
| LIVE_SESSION_CREATE | LIVE_SESSION | liveSessionId |
| INVITE_CREATE | ENROLL_INVITE | enrollInviteId |
| PAYMENT_FAILED | ENROLL_INVITE | enrollInviteId |
| INSTALLMENT_DUE_REMINDER | INSTITUTE | instituteId or null |

### Priority-Based Trigger Matching

When an event fires, the system uses **priority matching** (specific > global):

```
1. Find SPECIFIC triggers (event_id = exact match)
2. If found → fire ONLY specific triggers
3. If NOT found → fall back to GLOBAL triggers (event_id IS NULL)
```

**Example:**
- Workflow A: `LEARNER_BATCH_ENROLLMENT`, event_id=NULL (global — all batches)
- Workflow B: `LEARNER_BATCH_ENROLLMENT`, event_id="PS_123" (specific batch)
- Enrollment in PS_123 → only Workflow B fires
- Enrollment in PS_456 → only Workflow A fires

### Repository Methods

```java
// Specific match (exact event_id)
List<WorkflowTrigger> findSpecificTriggers(instituteId, eventId, eventType, statuses);

// Global fallback (event_id IS NULL)
List<WorkflowTrigger> findGlobalTriggers(instituteId, eventType, statuses);
```

Old method `findByInstituteIdAndEventIdAnsEventTypeAndStatusIn()` is preserved for backward compatibility.

---

## 4. New Query Operations

### Added to `QueryServiceImpl.java`

| Query Key | Description | Required Params | Optional Params |
|-----------|-------------|-----------------|-----------------|
| `fetch_live_sessions` | Live sessions for an institute | `instituteId` | `status` |
| `fetch_live_session_participants` | Participants of a session | `liveSessionId` | `status` |
| `fetch_enroll_invites` | Enrollment invites for institute | `instituteId` | `status` |
| `fetch_expiring_memberships` | UserPlans expiring within N days | `instituteId` | `daysUntilExpiry` |
| `fetch_audience_responses_filtered` | Audience leads with flexible filters | `instituteId` | `audienceId`, `daysAgo`, `startDate`, `endDate` |
| `fetch_student_attendance_report` | Student attendance + engagement for a batch | `userId`, `batchId` | `daysBack` |
| `fetch_batch_attendance_report` | All students' attendance + engagement | `instituteId` | `batchId`, `daysBack` |

All 12 existing queries are unchanged.

### `fetch_batch_attendance_report` — Special Behavior

- If `batchId` is provided: report for that batch only
- If `batchId` is empty: finds ALL active batches for the institute and generates a combined report
- Returns per-student: `attendancePercentage`, `totalDurationMinutes`, `totalChats`, `totalHandRaises`, `sessionsAttended`
- Engagement data comes from `live_session_logs.engagement_data` JSON: `{"chats":5, "talks":3, "talkTime":120, "raisehand":2, "emojis":1, "pollVotes":4}`

### Catalog Updates

`WorkflowCatalogController` updated:
- `/catalog/trigger-events` — returns `event_applied_type` for each event
- `/catalog/query-keys` — includes new queries with `optional_params`
- `/catalog/event-applied-types` — new endpoint listing all entity types
- `/catalog/actions` — unchanged

---

## 5. Persistent Delay Node

### How It Works

For delays > 60 seconds, the workflow pauses and resumes later:

1. `DelayNodeHandler` serializes full context to `workflow_execution_state` table (JSONB)
2. Sets `resume_at = now + delay`, `status = WAITING`
3. Marks `WorkflowExecution.status = PAUSED`
4. Returns `__workflow_paused = true` — engine exits cleanly
5. `WorkflowResumeJob` (Quartz, every 2 min) picks up due rows
6. Uses `claimForResume()` (atomic UPDATE) for multi-pod safety
7. Deserializes context, resumes workflow from paused point

### Current Status: **ACTIVE** _(updated 2026-07-07)_

The resume job is **registered** in `QuartzConfig.java` (`workflowResumeJobDetail()` + `workflowResumeTrigger()` beans) and runs every ~2 minutes (cron `0 0/2 * * * ?`). `DelayNodeHandler` persists `workflow_execution_state` (`status = WAITING` + JSONB context) for delays > 60s, and `WorkflowResumeJob` resumes them via the atomic `claimForResume()` claim.

> **Note:** The same pause/resume machinery is reused by the **CALL_AI** node — `CallAiNodeHandler` pauses with `pauseReason` `AI_CALL_RETRY` / `AI_CALL_RECHECK` (re-dial / result re-check loop), resumed by the same `WorkflowResumeJob`.

### Files

- `WorkflowExecutionState.java` — entity
- `WorkflowExecutionStateRepository.java` — with `claimForResume()` and `findDueForResume()`
- `DelayNodeHandler.java` — updated for persistent delay
- `WorkflowResumeJob.java` — Quartz job
- `WorkflowEngineService.java` — handles `__workflow_paused` signal

---

## 6. Service Integrations

> **Note (2026-07-07):** The table below is the _original_ enhancement set. Since then, many more triggers were wired across the platform — `LIVE_SESSION_START` / `LIVE_SESSION_END` (via `LiveSessionNotificationProcessor`, 5-min scan), `MEMBERSHIP_EXPIRY` (via `PackageSessionScheduler`, daily cron), the full CRM / lead-automation family (`LEAD_ASSIGNED_TO_COUNSELOR`, `LEAD_STATUS_CHANGED`, `LEAD_TAT_*`, `FOLLOW_UP_*`, `LEAD_CALLED_BACK`), `PAYMENT_SUCCESS`, `SUBSCRIPTION_*`, and `LEARNER_RE_ENROLLMENT` / `LEARNER_TERMINATION`. For the current authoritative trigger list see **`WORKFLOW_PLATFORM_PROGRESS.md`** (verified 2026-07-07).

### Where Each Trigger Fires

| Trigger | Service | File | Method |
|---------|---------|------|--------|
| `LIVE_SESSION_CREATE` | Live Session | `Step1Service.java` | After session save |
| `INVITE_CREATE` | Enroll Invite | `EnrollInviteService.java` | After invite save |
| `INVITE_FORM_FILL` | Enroll Invite | `LearnerEnrollInviteService.java` | After learner fills form |
| `PAYMENT_FAILED` | Payment | `PaymentLogService.java` | In `handlePaymentFailure()` |
| `ABANDONED_CART` | Enrollment | `LearnerEnrollmentEntryService.java` | In `createOnlyDetailsFilledEntry()` |

All trigger calls are wrapped in `try-catch` — workflow failures never break the main business flow.

### Context Data Passed

Each trigger injects relevant data into the workflow context:

**LIVE_SESSION_CREATE:**
```json
{ "liveSession": <LiveSession>, "createdBy": <userId> }
```

**INVITE_CREATE:**
```json
{ "invite": <EnrollInvite> }
```

**PAYMENT_FAILED:**
```json
{ "paymentLog": <PaymentLog>, "userId": <id>, "userPlanId": <id>, "amount": <amount>,
  "enrollInviteId": <id>, "packageSessionIds": [<ids>] }
```

**ABANDONED_CART:**
```json
{ "userId": <id>, "userPlanId": <id>, "packageSessionId": <id>, "packageId": <id> }
```

---

## 7. Assessment Service Integration

> **Note (2026-07-07):** The `ASSESSMENT_*` triggers below are now live and wired end-to-end (no longer pending). For the full, current cross-service trigger inventory see **`WORKFLOW_PLATFORM_PROGRESS.md`** (verified 2026-07-07).

Assessment lives in a separate microservice. Integration via HTTP:

### `WorkflowTriggerClient.java` (in assessment_service)

HTTP client that calls admin_core_service:
```
POST /admin-core-service/internal/workflow/trigger
Body: { "eventName": "ASSESSMENT_CREATE", "eventId": <id>, "instituteId": <id>, "contextData": {...} }
```

Configurable URL: `admin.core.service.url` property (default: `http://admin-core-service:8080`)

### Integration Points

| Trigger | File | When |
|---------|------|------|
| `ASSESSMENT_CREATE` | `AssessmentBasicDetailsManager.java` | New assessment saved |
| `ASSESSMENT_START` | `LearnerAssessmentAttemptStartManager.java` | Student attempt created |
| `ASSESSMENT_END` | `LearnerAssessmentAttemptStatusManager.java` | Student submits (status → ENDED) |

### Internal Endpoint

`InternalWorkflowController.java` — `POST /admin-core-service/internal/workflow/trigger`

---

## 8. Frontend Changes

### Setup Wizard (New)

Replaced the all-on-one-page setup with a **3-step wizard**:

1. **Step 1 — Name:** Workflow name (required) + description (optional)
2. **Step 2 — Trigger Type:** Two cards: "When something happens" / "On a schedule"
3. **Step 3 — Configuration:**
   - Event-Driven: grouped event dropdown, entity picker (loads real batches/audiences/invites), optional scope restriction
   - Scheduled: visual frequency picker (Daily/Weekly/Monthly/Repeating/Custom) with time picker, weekday circles, day-of-month grid

Progress bar with numbered steps. Users can navigate back/forward.

### Schedule Picker (New)

Replaces raw cron expression with visual controls:
- **Daily** — time picker only
- **Weekly** — clickable day circles (M T W T F S S) + presets (Weekdays, Weekends, Mon/Wed/Fri) + time
- **Monthly** — clickable day grid (1-28) + time
- **Repeating** — interval with presets (15min, 30min, 1hr, 2hr, 6hr, 12hr)
- **Custom** — raw cron for power users

Cron expression generated automatically behind the scenes.

### Event Entity Picker (New)

`EventEntityPicker` component replaces raw text input for event_id:
- Loads real entities from backend APIs based on `event_applied_type`
- PACKAGE_SESSION → dropdown of batches
- AUDIENCE → dropdown of campaigns
- LIVE_SESSION → dropdown of sessions
- ENROLL_INVITE → dropdown of invites
- INSTITUTE → "Applies to entire institute" message
- ASSESSMENT → manual text input (cross-service)
- "Enter ID manually" toggle for power users

### Visual SpEL Builders (New)

| Component | Replaces | Used In |
|-----------|----------|---------|
| `ConditionBuilder` | Raw SpEL text input | CONDITION, FILTER nodes |
| `AggregateBuilder` | JSON textarea | AGGREGATE node |
| `KeyValueBuilder` | JSON textarea | UPDATE_RECORD node |

**ConditionBuilder:** Visual `[If] [variable] [operator] [value]` with AND/OR grouping, operator dropdown (equals, not equals, >, <, contains, is empty, etc.), live SpEL preview, advanced mode toggle.

**AggregateBuilder:** Visual operation rows with type dropdown (Count/Sum/Avg/Min/Max), field input, output key.

**KeyValueBuilder:** Key-value row builder with VariablePicker for values.

### Other UI Changes

- DELAY node: added DAYS option, fixed config structure (`config.delay.value/unit` to match backend)
- QUERY node: shows optional params from catalog
- SEND_PUSH_NOTIFICATION: raw input replaced with VariablePicker
- VariablePicker: improved empty state with guidance
- Workflow cards: show `event_applied_type` badge
- Editing existing workflows: loads trigger/schedule config into store (was missing before)
- All colors use institute theme (`primary-50` through `primary-600`)

### Store Changes

`workflow-builder-store.ts`:
- Added `setupComplete` state + `setSetupComplete` action
- Added `eventAppliedType` and `eventId` to `TriggerConfig`

---

## 9. Idempotency & Multi-Pod Safety

All mechanisms are database-level — work across any number of pods:

| Scenario | Mechanism |
|----------|-----------|
| Event triggers | `idempotencyKey` UNIQUE constraint on `workflow_execution` — duplicate INSERT throws `DataIntegrityViolationException` → skip |
| Scheduled workflows | Same UNIQUE key: `workflow_schedule_{id}_{nextRunAtMillis}` |
| Delay resume | `claimForResume()`: atomic `UPDATE ... WHERE status='WAITING'` — returns 1 for winner, 0 for loser |

---

## 10. Email Templates

### Where to Store

Email templates are stored in the `templates` table, managed via:
- **Admin Dashboard:** Settings → Templates
- **API:** `POST /admin-core-service/institute/template/v1/create`

### Template Structure

| Field | Purpose |
|-------|---------|
| `type` | `EMAIL` or `WHATSAPP` |
| `name` | Reference name used in SEND_EMAIL node (e.g., `weekly_attendance_report`) |
| `subject` | Email subject with `{{placeholders}}` |
| `content` | HTML body with `{{placeholders}}` |
| `dynamic_parameters` | JSON defining available placeholders: `{"studentName":"string", ...}` |
| `institute_id` | Institute scope |
| `status` | `ACTIVE` |

### How Templates Connect to Workflows

1. SEND_EMAIL node config: user selects template from dropdown
2. Dynamic parameters auto-populate as VariablePicker fields
3. User maps each parameter to a context variable
4. At runtime: `SendEmailNodeHandler` loads template, substitutes `{{placeholders}}`, sends via unified notification service

---

## 11. Sample Workflows

### Weekly Attendance & Engagement Report

**Setup:** Scheduled → Weekly → Monday at 09:00

**Canvas:**
```
[TRIGGER] → [QUERY: fetch_batch_attendance_report] → [LOOP] → [SEND_EMAIL]
```

**QUERY config:** `instituteId` from context, `batchId` optional (empty = all batches), `daysBack` = 7

**LOOP config:** source = `reportData.students`, item = `student`

**SEND_EMAIL config:** template = `weekly_attendance_report`, recipients = `student.email`, vars: `studentName` → `student.fullName`, `attendancePercentage` → `student.attendancePercentage`, `totalDurationMinutes` → `student.totalDurationMinutes`, etc.

### Follow-up Email 5 Days After Audience Form Fill

**Setup:** Scheduled → Daily at 09:00

**Canvas:**
```
[TRIGGER] → [QUERY: fetch_audience_responses_filtered] → [LOOP] → [SEND_EMAIL]
```

**QUERY config:** `instituteId` from context, `audienceId` = specific audience, `daysAgo` = 5

**LOOP config:** source = `leadData.leads`, item = `lead`

**SEND_EMAIL config:** template = follow-up template, recipients from lead custom fields

---

## 12. Files Changed

### New Files Created

| File | Description |
|------|-------------|
| `V203__Add_event_applied_type_to_workflow_trigger.sql` | DB migration |
| `EventAppliedType.java` | New enum |
| `WorkflowExecutionState.java` | Entity for paused workflows |
| `WorkflowExecutionStateRepository.java` | Repository with atomic claim |
| `WorkflowResumeJob.java` | Quartz job for resuming paused workflows |
| `WorkflowTriggerClient.java` (assessment_service) | HTTP client for cross-service triggers |
| `condition-builder.tsx` | Visual condition builder component |
| `aggregate-builder.tsx` | Visual aggregate operations builder |
| `key-value-builder.tsx` | Visual key-value row builder |
| `event-entity-picker.tsx` | Smart entity dropdown per event_applied_type |

### Backend Files Modified

| File | Changes |
|------|---------|
| `WorkflowTrigger.java` | Added `eventAppliedType` field |
| `WorkflowTriggerEvent.java` | 14 new enum values |
| `WorkflowExecutionStatus.java` | Added `PAUSED` |
| `WorkflowTriggerRepository.java` | Added `findSpecificTriggers()`, `findGlobalTriggers()` |
| `WorkflowTriggerService.java` | Priority-based matching, enriched seed context |
| `WorkflowBuilderService.java` | Persists `eventAppliedType` |
| `WorkflowBuilderDTO.java` | Added `eventAppliedType` to TriggerDTO |
| `CatalogItemDTO.java` | Added `optionalParams`, `eventAppliedType` |
| `WorkflowCatalogController.java` | New events with metadata, new queries, new endpoint |
| `QueryServiceImpl.java` | 7 new query implementations |
| `DelayNodeHandler.java` | Persistent delay for >60s |
| `WorkflowEngineService.java` | Handles `__workflow_paused` signal |
| `QuartzConfig.java` | Resume job **registered & active** (runs every ~2 min; also powers CALL_AI pause/resume) |
| `Step1Service.java` | LIVE_SESSION_CREATE trigger |
| `EnrollInviteService.java` | INVITE_CREATE trigger |
| `LearnerEnrollInviteService.java` | INVITE_FORM_FILL trigger |
| `PaymentLogService.java` | PAYMENT_FAILED trigger |
| `LearnerEnrollmentEntryService.java` | ABANDONED_CART trigger |
| `InternalWorkflowController.java` | Internal trigger endpoint |
| `LiveSessionRepository.java` | Added `findByInstituteId`, `findByInstituteIdAndStatus` |
| `LiveSessionLogsRepository.java` | Added date-range query for engagement data |
| `EnrollInviteRepository.java` | Added `findByInstituteId`, `findByInstituteIdAndStatus` |

### Frontend Files Modified

| File | Changes |
|------|---------|
| `workflow-builder.tsx` | Complete rewrite: setup wizard, schedule picker, entity picker integration |
| `workflow-builder-store.ts` | Added `setupComplete`, `eventAppliedType`, `eventId` |
| `node-config-panel.tsx` | Visual builders for CONDITION, FILTER, AGGREGATE, UPDATE_RECORD; DAYS in DELAY; optional query params |
| `variable-picker.tsx` | Improved empty state |
| `workflow-service.ts` | New types, API hooks for entity picker and event-applied-types |
| `workflow-card.tsx` | Shows event_applied_type badge |
| `workflow-editor.tsx` | Loads trigger/schedule config, sets setupComplete=true |

### Assessment Service Files Modified

| File | Changes |
|------|---------|
| `AssessmentBasicDetailsManager.java` | ASSESSMENT_CREATE trigger |
| `LearnerAssessmentAttemptStartManager.java` | ASSESSMENT_START trigger |
| `LearnerAssessmentAttemptStatusManager.java` | ASSESSMENT_END trigger |

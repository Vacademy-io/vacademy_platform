# Workflow Enhancement — Comprehensive Code Audit

**Date:** 2026-04-22  
**Purpose:** Honest, per-use-case status of every workflow trigger, query, and email flow.

---

## ⚠️ Superseded in part — corrections 2026-07-07

A 2026-07-07 re-audit of the live code found several core conclusions in this doc are now FALSE. This banner supersedes them; the body below is preserved as a point-in-time record.

- LIVE_SESSION_START, LIVE_SESSION_END, MEMBERSHIP_EXPIRY, and ASSESSMENT_CREATE/START/END are now ALL WIRED (they were NOT when this doc was written). LIVE_SESSION_START/END fire from scheduler/LiveSessionNotificationProcessor.java (~lines 242/292, 5-min Quartz scan); MEMBERSHIP_EXPIRY from PackageSessionScheduler (daily 09:00 cron); ASSESSMENT_* from assessment_service via WorkflowTriggerClient → InternalWorkflowController.
- A large CRM/lead-automation event family was added after this doc and is wired: LEAD_ASSIGNED_TO_COUNSELOR, LEAD_STATUS_CHANGED, LEAD_TAT_REMINDER_BEFORE, LEAD_TAT_OVERDUE, FOLLOW_UP_DUE, FOLLOW_UP_OVERDUE, LEAD_CALLED_BACK, AUDIENCE_OPT_OUT, plus PAYMENT_SUCCESS, SUBSCRIPTION_CANCELLED/TERMINATED, LEARNER_RE_ENROLLMENT, LEARNER_TERMINATION. 34 of 38 enum events are now emitted.
- Issue #5 (fetch_expiring_memberships) is WORSE than described here: it isn't merely "incomplete filtering" — it does userPlanRepository.findAll() with NO institute filter and NO expiry filter, returning every tenant's active plans = a cross-tenant data-exposure bug. See QueryServiceImpl.java ~1616-1676.
- Issue #4 (fetch_students_by_batch findAll) — re-verify against current QueryServiceImpl before acting; the query layer was substantially rewritten.
- The persistent DELAY/resume machinery is now LIVE (WorkflowResumeJob registered in QuartzConfig, every 2 min), not staged.
- For the current accurate reference, see WORKFLOW_PLATFORM_PROGRESS.md (verified 2026-07-07).

---

## Executive Summary

The core workflow engine (trigger → routing → handler → context flow) is **working correctly**.  
The LIVE_SESSION_CREATE failure is a **data issue** (the selected batch has 0 enrolled students), not a code bug.

However, there are **real issues** across the system that need attention:

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | Field name inconsistency across queries | Medium | Needs fix |
| 2 | `instituteId` not auto-filled in QUERY params | Medium | Needs fix |
| 3 | Template variable auto-mapping fragile | Low | Document |
| 4 | `fetch_students_by_batch` uses `findAll()` (slow) | Medium | Needs fix |
| 5 | `fetch_expiring_memberships` filtering incomplete | Low | Needs fix |

---

## How the Engine Works (Quick Reference)

```
Service (e.g., Step1Service)
  └─▶ WorkflowTriggerService.handleTriggerEvents(eventName, eventId, instituteId, contextData)
        ├─ Find triggers: specific first (by eventId), then global (eventId=null)
        ├─ Idempotency check (UUID strategy by default)
        ├─ Build seed context = contextData + {triggerEvents, triggerId, instituteId, executionId, eventId, ...}
        └─▶ WorkflowEngineService.run(workflowId, seedContext)
              ├─ Stack-based DAG execution
              ├─ Each node handler returns Map<String, Object> changes
              ├─ changes are merged into shared context via ctx.putAll(changes)
              └─ Routing: goto / end / conditional / switch
```

### Key Data Flow Rules
- **QUERY** uses `putAll()` → keys go flat into context (e.g., `ssigm_list`, `mapping_count`)
- **HTTP_REQUEST** uses `put(resultKey, response)` → nested under key
- **SEND_EMAIL** `on` expression evaluates to a List; iterates each item; `forEach.eval` resolves per-item data
- **Template resolution order:** item fields → templateVars mapping → context → customFields → SpEL → literal

---

## Per-Trigger Use Case Analysis

### UC-1: AUDIENCE_LEAD_SUBMISSION → SEND_EMAIL

**Trigger source:** `AudienceService.java` (3 call sites: V1, V2, webhook)  
**Context data passed:**
```java
contextData.put("user", userDTO);
contextData.put("email", parentEmail);
contextData.put("mobileNumber", parentMobile);
contextData.put("parentEmail", parentEmail);
contextData.put("parentName", parentName);
contextData.put("customFields", customFieldsMap);  // field_name → value
contextData.put("adminEmailRequests", adminEmailRequests);
```

**Typical workflow:** TRIGGER → SEND_EMAIL (direct, no QUERY needed)  
**SEND_EMAIL `on`:** `#ctx['adminEmailRequests']` (list of email request maps)  

**Status: WORKS**  
- Tested and verified in production.  
- Template vars resolve from `customFields` map in context.  
- `email` field available directly in context.  
- Idempotency: UUID strategy → each submission gets unique key.

**Known caveats:**
- If using a QUERY node instead of direct context, field names differ (see Issue #1 below).

---

### UC-2: LEARNER_BATCH_ENROLLMENT → QUERY → SEND_EMAIL

**Trigger source:** `SubOrgLearnerService.triggerEnrollmentWorkflow()`  
**Event:** `SUB_ORG_MEMBER_ENROLLMENT` or `LEARNER_BATCH_ENROLLMENT`  
**Context data passed:**
```java
contextData.put("packageSessionIds", packageSessionId);
contextData.put("subOrgAdmin", adminDTO);
contextData.put("packageId", packageEntity.getId());
```

**Typical workflow:** TRIGGER → QUERY (`fetch_ssigm_by_package`) → SEND_EMAIL  
**QUERY output:** `ssigm_list` (List of maps with `email`, `full_name`, `user_id`, etc.)  
**SEND_EMAIL `on`:** `#ctx['ssigm_list']`

**Status: SHOULD WORK** (not tested end-to-end)  
- The query correctly resolves `packageSessionIds` param.  
- IF the batch has active students, `ssigm_list` will be populated.  
- Template vars from `ssigm_list` items use **snake_case**: `full_name`, `mobile_number`, `email`.

**Risk:** Template uses `{{fullName}}` but query returns `full_name`. See Issue #1.

---

### UC-3: PAYMENT_FAILED → SEND_EMAIL

**Trigger source:** `PaymentLogService.handlePaymentFailure()`  
**Context data passed:**
```java
contextData.put("userPlan", userPlan);
contextData.put("paymentLog", paymentLog);
contextData.put("user", userDTO);
contextData.put("email", email);
contextData.put("fullName", fullName);
contextData.put("mobileNumber", mobileNumber);
contextData.put("packageSessionIds", packageSessionIds);
contextData.put("enrollInviteId", enrollInviteId);
```
**Event ID:** `enrollInviteId` (for specific trigger matching)

**Typical workflow:** TRIGGER → SEND_EMAIL (single recipient from context)  
**SEND_EMAIL `on`:** Could use `#ctx['adminEmailRequests']` or a wrapper list

**Status: SHOULD WORK** (not tested end-to-end)  
- Context has `email` and `fullName` directly.  
- If SEND_EMAIL `on` expression points to a list with the user, emails will send.  
- **Important:** The `on` expression must evaluate to a **List**. If context only has flat fields, you need a QUERY or the email won't iterate.

**Risk:** If the user configures `on: "#ctx['user']"` and `user` is a UserDTO object (not a List), the handler will fail with "Expression did not evaluate to a list". The user must wrap it or use a query that returns a list.

---

### UC-4: INVITE_CREATE → SEND_EMAIL

**Trigger source:** `EnrollInviteService.createEnrollInvite()`  
**Context data passed:**
```java
contextData.put("invite", savedEnrollInvite);  // EnrollInvite entity
```
**Event ID:** `enrollInvite.getId()`

**Typical workflow:** TRIGGER → (optional QUERY) → SEND_EMAIL  

**Status: PARTIAL**  
- The trigger fires correctly.  
- **Problem:** Context only has the `invite` entity. There are no recipient email addresses unless a QUERY fetches them.  
- For admin notification: need to configure `on` to point to a list of admin emails.  
- For student notification: need QUERY to fetch enrolled students.

---

### UC-5: INVITE_FORM_FILL → SEND_EMAIL

**Trigger source:** `LearnerEnrollInviteService.submitLearnerEnrollInvite()`  
**Context data passed:**
```java
contextData.put("invite", enrollInvite);
contextData.put("instituteId", instituteId);
contextData.put("inviteCode", inviteCode);
```
**Event ID:** `enrollInvite.getId()`

**Status: PARTIAL** — same issue as UC-4. Need a QUERY to get recipient emails.

---

### UC-6: ABANDONED_CART → SEND_EMAIL

**Trigger source:** `LearnerEnrollmentEntryService`  
**Context data passed:**
```java
contextData.put("user", userDTO);
contextData.put("userPlanId", userPlanId);
contextData.put("packageSessionId", actualPackageSession.getId());
contextData.put("packageId", packageId);
```

**Status: SHOULD WORK** — similar to UC-3, context has `user` (UserDTO).  
**Same risk:** `on` expression must evaluate to a List.

---

### UC-7: LIVE_SESSION_CREATE → QUERY → SEND_EMAIL (CURRENT FAILURE)

**Trigger source:** `Step1Service.createOrUpdateLiveSession()`  
**Context data passed:**
```java
contextData.put("liveSession", savedSession);  // LiveSession entity
contextData.put("createdBy", user.getUserId());
```
**Event ID:** `savedSession.getId()` (live session UUID)

**User's workflow config:**
```
TRIGGER (LIVE_SESSION_CREATE)
  → QUERY (fetch_ssigm_by_package, params: {packageSessionIds: "000982fe-..."})
    → SEND_EMAIL (on: "#ctx['ssigm_list']", template: "Test Workflow")
```

**What the logs show:**
```
QueryServiceImpl: Executing query with key: fetch_ssigm_by_package, params: {packageSessionIds=000982fe-...}
QueryNodeHandler: Query changes map prepared: {ssigm_list=[], mapping_count=0}
SendEmailNodeHandler: Processing 0 items for email sending
```

**Root cause: DATA ISSUE — the batch `000982fe-d326-4244-99fc-14208def03f5` has 0 active students.**

The SQL executed:
```sql
SELECT ssigm.id, ssigm.user_id, ssigm.expiry_date, s.full_name, s.mobile_number, s.email, s.username, ssigm.package_session_id, ssigm.enrolled_date
FROM student_session_institute_group_mapping ssigm
JOIN student s ON s.user_id = ssigm.user_id
WHERE ssigm.package_session_id IN ('000982fe-d326-4244-99fc-14208def03f5')
  AND ssigm.status IN ('ACTIVE')
```
→ Returns 0 rows.

**How to verify:** Run this SQL directly against the database:
```sql
SELECT COUNT(*) FROM student_session_institute_group_mapping 
WHERE package_session_id = '000982fe-d326-4244-99fc-14208def03f5' AND status = 'ACTIVE';
```
If 0 → the batch genuinely has no enrolled students. Try a different batch ID.

**The code path is correct.** Every step executed as designed:
1. Trigger matched (global) ✓
2. Idempotency key generated (UUID) ✓
3. Context built correctly ✓
4. QUERY executed with correct params ✓
5. SEND_EMAIL processed 0 items (because query returned 0) ✓

---

### UC-8: LIVE_SESSION_START → QUERY → SEND_EMAIL

**Trigger source:** Not yet integrated into any service.  
**Status: NOT IMPLEMENTED** — no service calls `handleTriggerEvents("LIVE_SESSION_START", ...)`.  
The enum and catalog entry exist, but no code fires this trigger.

---

### UC-9: LIVE_SESSION_END → QUERY → SEND_EMAIL

**Trigger source:** Not yet integrated.  
**Status: NOT IMPLEMENTED** — same as UC-8.

---

### UC-10: MEMBERSHIP_EXPIRY (scheduled)

**Trigger source:** Should be triggered by a scheduled job.  
**Status: NOT IMPLEMENTED** — no scheduler fires this trigger.  
The `fetch_expiring_memberships` query exists but has incomplete filtering (see Issue #5).

---

### UC-11: SUB_ORG_MEMBER_TERMINATION

**Trigger source:** `SubOrgLearnerService.terminateMemberWorkflow()`  
**Status: SHOULD WORK** — follows same pattern as UC-2.

---

## Existing (Pre-Enhancement) Triggers — Backward Compatibility

### LEARNER_BATCH_ENROLLMENT (original)
**Status: UNAFFECTED** — existing `AudienceService` integration preserved.

### INSTALLMENT_DUE_REMINDER (original)
**Status: UNAFFECTED** — uses separate scheduler/query path.

### GENERATE_ADMIN_LOGIN_URL_FOR_LEARNER_PORTAL (original)
**Status: UNAFFECTED** — LearnerPortalAccessService integration unchanged.

### SEND_LEARNER_CREDENTIALS (original)
**Status: UNAFFECTED** — LearnerPortalAccessService integration unchanged.

---

## Issue #1: Field Name Inconsistency Across Queries

Different queries return different field names for the same data:

| Field | `fetch_ssigm_by_package` | `fetch_students_by_batch` | `fetch_batch_attendance_report` | `fetch_audience_responses_filtered` |
|-------|--------------------------|---------------------------|---------------------------------|-------------------------------------|
| Name | `full_name` | `fullName` | `fullName` | `parentName` |
| Email | `email` | `email` | `email` | `email` (from parentEmail) |
| Phone | `mobile_number` | `mobileNumber` | `mobileNumber` | `mobileNumber` |
| User ID | `user_id` | `userId` | `studentId` | `userId` |
| Batch | `package_session_id` | `batchId` | `batchId` | N/A |

**Impact:** A template with `{{fullName}}` works with `fetch_students_by_batch` but NOT with `fetch_ssigm_by_package` (which returns `full_name`).

**Fix options:**
1. **Normalize `fetch_ssigm_by_package`** to use camelCase (breaking change for existing workflows)
2. **Add aliases** in `fetch_ssigm_by_package`: put BOTH `full_name` AND `fullName`
3. **Document clearly** which query returns which field names (recommended for now)

**Recommended:** Option 2 — add aliases so both conventions work.

---

## Issue #2: `instituteId` Not Auto-Filled in QUERY Params

When a QUERY node has `fetch_ssigm_by_package`, the `instituteId` param is available in context but NOT auto-filled into the query params. The user must manually add it or use a SpEL expression `#ctx['instituteId']`.

For queries that accept `instituteId` as a fallback (when no batchId), this means the fallback never kicks in unless the user explicitly passes it.

**Fix:** In `QueryNodeHandler`, always inject `instituteId` from context into query params if not already present.

---

## Issue #3: Template Variable Auto-Mapping

Template variables are resolved in this order:
1. All item fields added as placeholders (key = field name from query)
2. `templateVars` mapping resolved (user-configured)
3. Context lookup
4. `customFields` map lookup
5. SpEL evaluation
6. Literal value

If the user's template uses `{{fullName}}` and the query returns `full_name`, the auto-mapping (step 1) adds `full_name` but not `fullName`. The user must configure `templateVars: {"fullName": "full_name"}` to bridge the gap.

**This is by design but poorly documented.** The WORKFLOW_CREATION_GUIDE should list exact field names per query.

---

## Issue #4: `fetch_students_by_batch` Performance

The `fetchStudentsByBatch` method calls `ssigmRepo.findAll()` and filters in-memory:
```java
ssigmRepo.findAll().stream()
    .filter(m -> m.getPackageSession() != null && bid.equals(m.getPackageSession().getId()) ...)
```

For a large institute with thousands of SSIGM records, this loads the entire table into memory.

**Fix:** Replace with a proper JPA query:
```java
ssigmRepo.findByPackageSessionIdAndStatus(bid, "ACTIVE")
```

---

## Issue #5: `fetch_expiring_memberships` Incomplete

The current implementation:
```java
userPlanRepository.findAll().stream()
    .filter(plan -> "ACTIVE".equalsIgnoreCase(plan.getStatus()) && plan.getCreatedAt() != null)
```

This loads ALL UserPlan records and doesn't actually check expiry dates. The `daysUntilExpiry` parameter is accepted but the filtering logic only checks status, not actual expiry.

**Fix:** Add proper date-based filtering using `plan.getValidityInDays()` or an expiry date column.

---

## Query Output Reference (for template variable mapping)

### `fetch_ssigm_by_package`
Returns: `{ssigm_list: [...], mapping_count: N}`  
Each item in `ssigm_list`:
```
mapping_id, user_id, expiry_date, full_name, mobile_number, email, username, package_session_id
```

### `fetch_students_by_batch`
Returns: `{students: [...], totalStudents: N}`  
Each item in `students`:
```
userId, batchId, fullName, email, mobileNumber, parentsEmail, guardianEmail
```

### `fetch_batch_attendance_report`
Returns: `{students: [...], totalStudents, batchCount, startDate, endDate}`  
Each item in `students`:
```
studentId, fullName, email, mobileNumber, parentsEmail, guardianEmail, motherEmail, 
enrollmentNumber, attendancePercentage, batchId, startDate, endDate, 
sessions[], engagementLogs[], totalDurationMinutes, totalChats, totalHandRaises, sessionsAttended
```

### `fetch_audience_responses_filtered`
Returns: `{leads: [...]}`  
Each item in `leads`:
```
id, odId, audienceId, userId, createdAt, email (from parentEmail), parentEmail, 
parentName, mobileNumber (from parentMobile), + all custom field names as keys
```

### `getAudienceResponsesByDayDifference`
Returns: `{ssigm_list: [...], mapping_count: N}` (legacy key names)  
Each item uses same fields as `fetch_ssigm_by_package`.

---

## Verification Checklist

Before deploying, verify each use case:

- [ ] **UC-1 (Audience Lead):** Submit audience form → verify email received with correct template vars
- [ ] **UC-2 (Batch Enrollment):** Enroll student → verify workflow fires
- [ ] **UC-3 (Payment Failed):** Simulate payment failure → verify email
- [ ] **UC-7 (Live Session Create):** Create live session with a batch that HAS enrolled students → verify email
- [ ] **Backward compat:** Existing LEARNER_BATCH_ENROLLMENT workflows still work
- [ ] **Idempotency:** Trigger same event twice → second should be skipped (UUID strategy = no skip; EVENT_BASED = skip)
- [ ] **Inactive workflows:** Set workflow status=INACTIVE → verify trigger doesn't fire
- [ ] **Template type:** Verify templates are saved with type='EMAIL' (uppercase)

---

## Trigger Integration Status

| Trigger Event | Service Integration | Fires From | Status |
|---------------|-------------------|-----------|--------|
| AUDIENCE_LEAD_SUBMISSION | AudienceService (3 sites) | Form submit | ACTIVE |
| LEARNER_BATCH_ENROLLMENT | (original trigger) | Enrollment | ACTIVE |
| SUB_ORG_MEMBER_ENROLLMENT | SubOrgLearnerService | Sub-org enroll | ACTIVE |
| SUB_ORG_MEMBER_TERMINATION | SubOrgLearnerService | Sub-org terminate | ACTIVE |
| LIVE_SESSION_CREATE | Step1Service | Create/update session | ACTIVE |
| LIVE_SESSION_START | LiveSessionNotificationProcessor (scheduler) | 5-min Quartz scan (~line 242) | ACTIVE (see 2026-07-07 banner) |
| LIVE_SESSION_END | LiveSessionNotificationProcessor (scheduler) | 5-min Quartz scan (~line 292) | ACTIVE (see 2026-07-07 banner) |
| LIVE_SESSION_FORM_SUBMISSION | — | — | NOT INTEGRATED |
| PAYMENT_FAILED | PaymentLogService | Payment failure | ACTIVE |
| ABANDONED_CART | LearnerEnrollmentEntryService | Enrollment without payment | ACTIVE |
| INVITE_CREATE | EnrollInviteService | Create invite | ACTIVE |
| INVITE_FORM_FILL | LearnerEnrollInviteService | Learner fills invite form | ACTIVE |
| MEMBERSHIP_EXPIRY | PackageSessionScheduler | Daily 09:00 cron | ACTIVE (see 2026-07-07 banner) |
| INSTALLMENT_DUE_REMINDER | (original scheduler) | Cron job | ACTIVE (original) |
| GENERATE_ADMIN_LOGIN_URL | LearnerPortalAccessService | Login request | ACTIVE (original) |
| SEND_LEARNER_CREDENTIALS | LearnerPortalAccessService | Credential request | ACTIVE (original) |
| ASSESSMENT_CREATE/START/END | assessment_service → WorkflowTriggerClient → InternalWorkflowController | assessment_service events | ACTIVE (see 2026-07-07 banner) |
| ASSESSMENT_FORM_SUBMISSION | — | — | NOT INTEGRATED |

---

## Recommendations

1. **For the current LIVE_SESSION_CREATE test:** Try a batch ID that has active enrolled students. Verify with SQL: `SELECT COUNT(*) FROM student_session_institute_group_mapping WHERE package_session_id = '<id>' AND status = 'ACTIVE';`

2. **Fix field name aliases** in `fetch_ssigm_by_package` to add camelCase duplicates (`fullName` alongside `full_name`).

3. **Auto-inject `instituteId`** into QUERY params from context when not explicitly provided.

4. **Replace `findAll()` calls** in `fetchStudentsByBatch` with proper repository queries.

5. **Integrate remaining triggers** (LIVE_SESSION_START/END, MEMBERSHIP_EXPIRY, ASSESSMENT_*) into their respective services when those features are ready.

# Bulk Assign / De-assign Users to Package Sessions — Design Document

> **Version:** 1.0
> **Date:** 2026-02-19
> **Status:** Draft — Awaiting Review

---

## Table of Contents

1. [Overview](#1-overview)
2. [Research Findings](#2-research-findings)
3. [API Design](#3-api-design)
4. [Default Resolution Logic](#4-default-resolution-logic)
5. [Re-enrollment Strategy](#5-re-enrollment-strategy)
6. [De-assignment & UserPlan Behavior](#6-de-assignment--userplan-behavior)
7. [Dry-Run / Preview Mode](#7-dry-run--preview-mode)
8. [Filter-Based User Selection](#8-filter-based-user-selection)
9. [Paginated Invite Listing API](#9-paginated-invite-listing-api)
10. [UI Design](#10-ui-design)
11. [Implementation Plan](#11-implementation-plan)
12. [Data Model Impact](#12-data-model-impact)

---

## 1. Overview

### Goal

Provide a unified, admin-facing API to **assign** (enroll) or **de-assign** (terminate/cancel) **N users × M package sessions** in a single request, with:

- ✅ **Per-package-session invite/plan configuration** (or auto-resolution of defaults)
- ✅ **Auto-creation** of default free invites when none exist
- ✅ **Best-effort processing** with per-item status reporting
- ✅ **Dry-run mode** for preview before execution
- ✅ **Filter-based user selection** (e.g., "all active learners from Package A")
- ✅ **Configurable duplicate handling and notifications**
- ✅ **Support for new user creation** (matching existing enrollment behavior)

### Non-Goals (For Now)

- ❌ Sub-Org (SUB_ORG source) enrollment (designed to be extensible for this)
- ❌ Payment gateway integration (admin-initiated = always manual/free unless transaction_id provided)
- ❌ Learner-facing self-assignment via this API

---

## 2. Research Findings

### 2.1 UserPlan ↔ PackageSession Relationship

**Finding:** Each `UserPlan` is scoped to a single `EnrollInvite`, and each `EnrollInvite` maps to one or more `PackageSession`s via the `PackageSessionLearnerInvitationToPaymentOption` join table.

**Key insight from code (`UserPlanService.createUserPlan`, line 164-173):**

```java
// Stacking check: looks for ACTIVE/PENDING UserPlans with the SAME enrollInviteId
existingPlan = userPlanRepository.findTopByUserIdAndEnrollInviteIdAndStatusInOrderByEndDateDesc(
    userId, enrollInvite.getId(),
    List.of(UserPlanStatusEnum.ACTIVE.name(), UserPlanStatusEnum.PENDING.name()));
```

This means:

- **If each package session uses a DIFFERENT enroll invite** → each will have its own `UserPlan` ✅
- **If two package sessions share the SAME enroll invite (bundled)** → they share a `UserPlan` and stacking applies

**For the bulk assign API: since each `assignment` item specifies its own `package_session_id` and resolves its own `enroll_invite_id`, each assignment will create its own `UserPlan` when using distinct invites.** This matches the user's expectation.

### 2.2 Plan Stacking (Queue) Behavior

**Finding from code (`UserPlanService.createUserPlan`, lines 186-213):**

The system supports plan **stacking**:

- If a user already has an ACTIVE or PENDING `UserPlan` for the **same `enrollInviteId`**, the new plan is created with `PENDING` status and starts AFTER the existing plan's `endDate`.
- `ActiveRepurchaseBehavior` enum supports: `STACK`, `OVERWRITE`, `EXTEND`.

**Implication for bulk assign:**

- When the admin assigns a user to a package session where they already have an active plan under the same invite → the new plan will be **stacked** (queued) automatically by the existing `UserPlanService.createUserPlan`.
- This is transparent to the bulk assign API — no special handling needed.

### 2.3 Force Cancel Behavior

**Finding from code (`UserPlanService.cancelUserPlan`, lines 850-930):**

Force cancel (`force=true`):

1. Sets UserPlan status to `TERMINATED`
2. Finds all ACTIVE `StudentSessionInstituteGroupMapping` linked to this UserPlan
3. Deletes those mappings
4. Creates new `INVITED` status mappings pointing to the `INVITED` PackageSession (a special package session within the same package for post-termination landing)

This means force-terminate redirects the user back to the "invitation" state rather than fully removing them.

### 2.4 Re-enrollment Pattern

**Finding from code (`LearnerSessionOperationService.reEnrollStudent`, lines 95-99 and 111-170):**

The existing re-enrollment flow:

1. Checks if a `StudentSessionInstituteGroupMapping` exists for the user+packageSession+institute (ANY status including TERMINATED, INACTIVE)
2. If exists → **updates** the existing mapping (resets enrolledDate, updates status, extends access)
3. If not exists → **creates** a new mapping

This is the correct pattern for bulk assign to follow.

### 2.5 Existing Default Invite Resolution

**Finding from code (`EnrollInviteService.findDefaultEnrollInviteByPackageSessionId`, lines 258-267):**

```java
EnrollInvite enrollInvite = repository.findLatestForPackageSessionWithFilters(
    packageSessionId,
    List.of(StatusEnum.ACTIVE.name()),     // invite status
    List.of(EnrollInviteTag.DEFAULT.name()), // tag filter
    List.of(StatusEnum.ACTIVE.name()));     // mapping status
```

This looks for an `ACTIVE` invite tagged as `DEFAULT` for the given package session. If none found, it throws `VacademyException`.

### 2.6 Existing Paginated Invite Listing

**Finding from code (`EnrollInviteController.getEnrollInvite`, line 28-35):**

```
POST /admin-core-service/v1/enroll-invite/get-enroll-invite?instituteId=...&pageNo=0&pageSize=10
Body: EnrollInviteFilterDTO { searchName, packageSessionIds, paymentOptionIds, sortColumns, tags }
```

This already supports filtering by `packageSessionIds`. **We can reuse this API in the UI** to let admins pick invites for specific package sessions. No new API needed for browsing invites — just need to call it with the target `packageSessionIds` filter.

---

## 3. API Design

### 3.1 Bulk Assign

```
POST /admin-core-service/v3/learner-management/assign
```

**Request Body:**

```json
{
  "institute_id": "inst-uuid",

  // === USER SELECTION (one of user_ids / user_filter must be provided) ===
  "user_ids": ["user-uuid-1", "user-uuid-2"],
  "new_users": [
    {
      "email": "new@example.com",
      "full_name": "New User",
      "mobile_number": "+91...",
      "username": "newuser",
      "password": "optional",
      "roles": ["STUDENT"]
    }
  ],
  "user_filter": {
    "source_package_session_id": "ps-uuid-source",
    "statuses": ["ACTIVE"]
  },

  // === PACKAGE SESSION ASSIGNMENTS ===
  "assignments": [
    {
      "package_session_id": "ps-uuid-1",
      "enroll_invite_id": null, // null → auto-resolve DEFAULT invite
      "payment_option_id": null, // null → auto-resolve from invite
      "plan_id": null, // null → auto-resolve from payment option
      "access_days": null, // null → use invite config
      "custom_field_values": [{ "custom_field_id": "cf-1", "value": "Value1" }]
    },
    {
      "package_session_id": "ps-uuid-2",
      "enroll_invite_id": "invite-uuid", // explicit override
      "payment_option_id": "po-uuid", // explicit override
      "plan_id": "plan-uuid", // explicit override
      "access_days": 365 // explicit override
    }
  ],

  // === OPTIONS ===
  "options": {
    "duplicate_handling": "SKIP", // SKIP | ERROR | RE_ENROLL
    "enrollment_type": "MANUAL", // always MANUAL for admin-initiated
    "notify_learners": true,
    "transaction_id": null, // optional: admin provides external txn ref
    "dry_run": false // true = preview only, no changes
  }
}
```

**Response Body:**

```json
{
  "dry_run": false,
  "summary": {
    "total_requested": 4,
    "successful": 3,
    "failed": 1,
    "skipped": 0,
    "re_enrolled": 0
  },
  "results": [
    {
      "user_id": "user-uuid-1",
      "user_email": "john@example.com",
      "package_session_id": "ps-uuid-1",
      "status": "SUCCESS",
      "action_taken": "CREATED",
      "mapping_id": "mapping-uuid",
      "user_plan_id": "up-uuid",
      "enroll_invite_id_used": "invite-auto-uuid",
      "message": null
    },
    {
      "user_id": "user-uuid-2",
      "user_email": "jane@example.com",
      "package_session_id": "ps-uuid-1",
      "status": "SKIPPED",
      "action_taken": "NONE",
      "mapping_id": null,
      "user_plan_id": null,
      "enroll_invite_id_used": null,
      "message": "Already enrolled (ACTIVE)"
    },
    {
      "user_id": "user-uuid-1",
      "user_email": "john@example.com",
      "package_session_id": "ps-uuid-2",
      "status": "SUCCESS",
      "action_taken": "RE_ENROLLED",
      "mapping_id": "mapping-uuid-2",
      "user_plan_id": "up-uuid-2",
      "enroll_invite_id_used": "invite-uuid",
      "message": "Re-enrolled from TERMINATED status"
    },
    {
      "user_id": "user-uuid-2",
      "user_email": "jane@example.com",
      "package_session_id": "ps-uuid-2",
      "status": "FAILED",
      "action_taken": "NONE",
      "mapping_id": null,
      "user_plan_id": null,
      "enroll_invite_id_used": null,
      "message": "Package session is not active"
    }
  ]
}
```

### 3.2 Bulk De-assign

```
POST /admin-core-service/v3/learner-management/deassign
```

**Request Body:**

```json
{
  "institute_id": "inst-uuid",

  // === USER SELECTION ===
  "user_ids": ["user-uuid-1", "user-uuid-2"],
  "user_filter": null,

  // === PACKAGE SESSIONS TO REMOVE FROM ===
  "package_session_ids": ["ps-uuid-1", "ps-uuid-2"],

  // === OPTIONS ===
  "options": {
    "mode": "SOFT", // SOFT = CANCELED | HARD = TERMINATED
    "notify_learners": true,
    "dry_run": false
  }
}
```

**Response Body:** Same structure as assign response, with `action_taken` values being `SOFT_CANCELED`, `HARD_TERMINATED`, `SKIPPED`, or `FAILED`.

### 3.3 Dry-Run Mode

When `dry_run: true`:

- All validation runs normally
- Default resolution runs normally (tells admin which invite/plan was auto-resolved)
- **No database writes** (no mappings created, no UserPlans created, no notifications sent)
- Response contains the full results as if it were executed

---

## 4. Default Resolution Logic

When `enroll_invite_id` is `null` in an assignment item:

```
resolve(packageSessionId, instituteId):

  Step 1: Find DEFAULT invite
    → EnrollInviteRepository.findLatestForPackageSessionWithFilters(
        packageSessionId,
        statuses=["ACTIVE"],
        tags=["DEFAULT"],
        mappingStatuses=["ACTIVE"])
    → If found: use this invite

  Step 2: If no DEFAULT invite exists → AUTO-CREATE
    → Create a new EnrollInvite:
        name: "Auto Default - {PackageSession.name}"
        tag: "DEFAULT"
        status: "ACTIVE"
        instituteId: from request
        learnerAccessDays: null (unlimited)
        inviteCode: auto-generated
    → Create a new PaymentOption:
        name: "Free Access"
        type: "FREE"
        status: "ACTIVE"
        tag: "DEFAULT"
    → Create PackageSessionLearnerInvitationToPaymentOption linking them
    → Create PaymentPlan:
        name: "Free Plan"
        amount: 0
        status: "ACTIVE"
        validityInDays: null (unlimited)
    → Link PaymentPlan to PaymentOption

  Step 3: Resolve PaymentOption (if not explicitly provided)
    → Use the first ACTIVE PaymentOption linked to the resolved invite
    → Prefer one tagged "DEFAULT" if multiple exist

  Step 4: Resolve PaymentPlan (if not explicitly provided)
    → Use the first ACTIVE PaymentPlan linked to the resolved PaymentOption
    → Prefer one tagged "DEFAULT" if multiple exist

  Step 5: Resolve AccessDays
    → Explicit access_days from request > PaymentPlan.validityInDays > EnrollInvite.learnerAccessDays > null (unlimited)
```

---

## 5. Re-enrollment Strategy

**Recommendation:** Handle re-enrollment transparently within the bulk assign API, controlled by the `duplicate_handling` option.

| `duplicate_handling` | User has ACTIVE mapping                   | User has EXPIRED/TERMINATED mapping                                   | User has no mapping |
| -------------------- | ----------------------------------------- | --------------------------------------------------------------------- | ------------------- |
| `SKIP`               | Skip (report as SKIPPED)                  | Skip (report as SKIPPED)                                              | Create new          |
| `ERROR`              | Fail (report as FAILED)                   | Fail (report as FAILED)                                               | Create new          |
| `RE_ENROLL`          | Skip (report as SKIPPED — already active) | Re-enroll: update mapping to ACTIVE, reset dates, create new UserPlan | Create new          |

**Re-enrollment logic (when `duplicate_handling = RE_ENROLL`):**

```
For each (userId, packageSessionId):

  1. Check for existing StudentSessionInstituteGroupMapping:
     → findTopByPackageSessionIdAndUserIdAndStatusIn(
         packageSessionId, instituteId, userId,
         [ACTIVE, INVITED, TERMINATED, INACTIVE, EXPIRED])

  2. If exists AND status is ACTIVE:
     → Skip (already enrolled)

  3. If exists AND status is TERMINATED/EXPIRED/INACTIVE:
     → Update existing mapping:
        - Set status = ACTIVE
        - Set enrolledDate = now
        - Set expiryDate = calculated from accessDays
        - Set userPlanId = new UserPlan ID
     → Create new UserPlan (stacking rules apply automatically)
     → Report as RE_ENROLLED

  4. If not exists:
     → Create new mapping + UserPlan
     → Report as CREATED
```

**Rationale:** This follows the same pattern as the existing `LearnerSessionOperationService.reEnrollStudent` but extends it with proper UserPlan creation.

---

## 6. De-assignment & UserPlan Behavior

### 6.1 SOFT Cancel (`mode: "SOFT"`)

For each (userId, packageSessionId):

1. Find the ACTIVE `StudentSessionInstituteGroupMapping`
2. Find the associated `UserPlan` via `mapping.userPlanId`
3. Set UserPlan status to `CANCELED`
4. Access continues until grace period/expiry date ends (no mapping changes)

### 6.2 HARD Terminate (`mode: "HARD"`)

For each (userId, packageSessionId):

1. Find the ACTIVE `StudentSessionInstituteGroupMapping`
2. Find the associated `UserPlan` via `mapping.userPlanId`
3. Set UserPlan status to `TERMINATED`
4. Set mapping status to `TERMINATED` (or delete and create INVITED mapping, matching existing `cancelUserPlan(force=true)` behavior)

### 6.3 UserPlan Isolation Guarantee

**Each assignment (user × package session) should produce its own UserPlan when they use different enroll invites.** The existing stacking check in `UserPlanService.createUserPlan` already scopes to `(userId + enrollInviteId)`.

In the rare case where two package sessions share the same enroll invite (bundled invite), the UserPlan IS shared. In this case:

- SOFT cancel → cancels the shared plan (both package sessions affected)
- HARD terminate → terminates the shared plan and all linked mappings

**The de-assign API should warn** if the UserPlan is shared across multiple package sessions and the admin is only de-assigning from one of them. The response should include a `warning` field.

---

## 7. Dry-Run / Preview Mode

When `options.dry_run = true`:

1. Resolve all users (from `user_ids`, `new_users`, `user_filter`)
2. For each (user × assignment):
   - Run validation (package session exists, is active)
   - Run duplicate check
   - Run default invite resolution
   - Determine what action WOULD be taken
3. Return the full `results` array with `status`, `action_taken`, `enroll_invite_id_used`, `message`
4. **NO database writes**
5. Response also includes:
   - `resolved_invites`: Map of packageSessionId → resolved EnrollInviteDTO (so admin can see what will be used)
   - For new users: whether they'd be created or found existing

---

## 8. Filter-Based User Selection

When `user_filter` is provided instead of (or in addition to) `user_ids`:

```json
"user_filter": {
  "source_package_session_id": "ps-uuid-source",
  "statuses": ["ACTIVE"],
  "institute_id": "inst-uuid"
}
```

- Query: `StudentSessionInstituteGroupMappingRepository.findAllUserIdsByPackageSessionIdAndStatusIn(sourcePackageSessionId, statuses)`
- Returns distinct `userId` list
- These user IDs are MERGED with explicitly provided `user_ids` (union, deduplicated)

**Use case:** "Assign all active learners from Mathematics Grade-10 to Physics Grade-10"

---

## 9. Paginated Invite Listing API

### Existing API (Already Sufficient)

```
POST /admin-core-service/v1/enroll-invite/get-enroll-invite
  ?instituteId=inst-uuid
  &pageNo=0
  &pageSize=10

Body:
{
  "package_session_ids": ["ps-uuid-1"],
  "tags": null,
  "payment_option_ids": null,
  "sort_columns": { "created_at": "desc" }
}
```

This returns a `Page<EnrollInviteWithSessionsProjection>` filtered by package session. **No new API needed.**

The frontend invite picker should call this API with the selected `package_session_id` to let the admin browse all invites available for that package session.

---

## 10. UI Design

### 10.1 Assignment Flow (Multi-Step Dialog)

The UI lives within the existing **Learner Management page** as a new action button.

```
┌──────────────────────────────────────────────────────────────────────┐
│  📋 Bulk Assign Learners to Courses                         [X]     │
├──────────────────────────────────────────────────────────────────────┤
│  Step 1 of 4 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ○ ○ ○                  │
│                                                                      │
│  SELECT LEARNERS                                                     │
│  ┌────────────────────────────────────────────────────────────┐      │
│  │ ◉ Select specific learners                                 │      │
│  │   🔍 Search by name or email...                            │      │
│  │   ☑ John Doe (john@example.com)                            │      │
│  │   ☑ Jane Smith (jane@example.com)                          │      │
│  │   ☐ Bob Wilson (bob@example.com)                           │      │
│  │                                                            │      │
│  │ ○ All active learners from a course                        │      │
│  │   [Select source course ▾]                                 │      │
│  │                                                            │      │
│  │ ○ Add new learners                                         │      │
│  │   [Add User Form: Name, Email, Phone]                      │      │
│  └────────────────────────────────────────────────────────────┘      │
│  Selected: 2 learners                                                │
│                                                                      │
│                                   [Cancel]  [Next →]                 │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  Step 2 of 4 ━━━━━━━━━━━━━━━━━━━ ━━━━━━━━━━ ○ ○                    │
│                                                                      │
│  SELECT TARGET COURSES                                               │
│  ┌────────────────────────────────────────────────────────────┐      │
│  │ 🔍 Search courses...                                       │      │
│  │ ☑ Mathematics - Grade 10 - January 2024 Batch              │      │
│  │ ☑ Physics - Grade 10 - January 2024 Batch                  │      │
│  │ ☐ Chemistry - Grade 10 - January 2024 Batch                │      │
│  └────────────────────────────────────────────────────────────┘      │
│  Selected: 2 courses                                                 │
│                                                                      │
│                              [← Back]  [Cancel]  [Next →]           │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  Step 3 of 4 ━━━━━━━━━━━━━━━━━━━ ━━━━━━━━━━ ━━━━━━━━━━ ○          │
│                                                                      │
│  ENROLLMENT CONFIGURATION (per course)                               │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────┐       │
│  │ 📦 Mathematics - Grade 10 - Jan Batch                     │       │
│  │                                                           │       │
│  │   Enrollment Invite:                                      │       │
│  │   [Default Invite (Auto) ▾]     ← dropdown from API      │       │
│  │                                                           │       │
│  │   Payment Plan: Free Plan (auto-selected)                 │       │
│  │   Access: 365 days (from invite config)                   │       │
│  │                                                           │       │
│  │   ⓘ This invite provides free access for 365 days        │       │
│  ├──────────────────────────────────────────────────────────┤       │
│  │ 📦 Physics - Grade 10 - Jan Batch                         │       │
│  │                                                           │       │
│  │   Enrollment Invite:                                      │       │
│  │   [Premium Access Invite ▾]     ← admin picked specific  │       │
│  │                                                           │       │
│  │   Payment Plan: ₹999/year                                 │       │
│  │   Access: 365 days                                        │       │
│  │   Transaction ID: [Optional: external ref ______]         │       │
│  │                                                           │       │
│  │   ⚠ Paid plan selected. Enter transaction ID if paid      │       │
│  │     externally, otherwise plan will be marked as free.     │       │
│  └──────────────────────────────────────────────────────────┘       │
│                                                                      │
│  OPTIONS                                                             │
│  ┌──────────────────────────────────────────────────────────┐       │
│  │ If already enrolled: [Skip ▾]  (Skip | Error | Re-enroll)│       │
│  │ Notify learners:     [✓]                                  │       │
│  └──────────────────────────────────────────────────────────┘       │
│                                                                      │
│                         [← Back]  [Cancel]  [Preview →]             │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  Step 4 of 4 ━━━━━━━━━━━━━━━━━━━ ━━━━━━━━━━ ━━━━━━━━━━ ━━━━━━━━   │
│                                                                      │
│  PREVIEW (Dry Run Results)                                           │
│                                                                      │
│  Summary: 4 operations (2 learners × 2 courses)                     │
│  ┌──────────────────────────────────────────────────┬─────────┐     │
│  │ Learner              │ Course           │ Action  │ Status  │     │
│  ├──────────────────────┼──────────────────┼─────────┤─────────│     │
│  │ John Doe             │ Mathematics G10  │ CREATE  │ ✅ OK   │     │
│  │ Jane Smith           │ Mathematics G10  │ SKIP    │ ⏭ Skip  │     │
│  │ John Doe             │ Physics G10      │ CREATE  │ ✅ OK   │     │
│  │ Jane Smith           │ Physics G10      │ CREATE  │ ✅ OK   │     │
│  └──────────────────────┴──────────────────┴─────────┴─────────┘     │
│                                                                      │
│  ✅ 3 will be assigned    ⏭ 1 will be skipped    ❌ 0 errors        │
│                                                                      │
│                  [← Back]  [Cancel]  [✓ Confirm Assignment]          │
└──────────────────────────────────────────────────────────────────────┘
```

### 10.2 Invite Picker (Dropdown Component)

When the admin clicks the "Enrollment Invite" dropdown in Step 3:

```
┌──────────────────────────────────────────────────────────┐
│ 🔍 Search invites...                                      │
│ ──────────────────────────────────────────────────────── │
│ ⭐ Default Invite                                 DEFAULT │
│    Free Plan · 365 days · Created: Jan 15, 2024          │
│ ──────────────────────────────────────────────────────── │
│ 💎 Premium Access                                         │
│    ₹999/year · Full access · Created: Feb 1, 2024        │
│ ──────────────────────────────────────────────────────── │
│ 🎁 Scholarship Invite                                     │
│    Free Plan · 180 days · Created: Mar 5, 2024           │
│ ──────────────────────────────────────────────────────── │
│                                    Load more...           │
└──────────────────────────────────────────────────────────┘
```

This calls the existing `POST /v1/enroll-invite/get-enroll-invite` API with `packageSessionIds` filter.

### 10.3 De-assignment Dialog

```
┌──────────────────────────────────────────────────────────────────────┐
│  🚫 Remove Learners from Courses                            [X]     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Selected learners: 3                                                │
│  Selected courses: 2                                                 │
│  Total operations: 6                                                 │
│                                                                      │
│  REMOVAL MODE                                                        │
│  ┌──────────────────────────────────────────────────────────┐       │
│  │ ◉ Soft Cancel                                             │       │
│  │   Status → CANCELED. Access continues until plan expires. │       │
│  │                                                           │       │
│  │ ○ Hard Terminate                                          │       │
│  │   Status → TERMINATED. Immediate access revocation.       │       │
│  │   ⚠ This action is irreversible for the current plan.    │       │
│  └──────────────────────────────────────────────────────────┘       │
│                                                                      │
│  ☑ Notify learners about removal                                    │
│                                                                      │
│                         [Cancel]  [Preview →]                        │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 11. Implementation Plan

### Phase 1: Backend APIs

#### 1.1 DTOs

| File                      | Description                                       |
| ------------------------- | ------------------------------------------------- |
| `BulkAssignRequestDTO`    | Main request for assign API                       |
| `AssignmentItemDTO`       | Per-package-session config                        |
| `NewUserDTO`              | For new user creation                             |
| `UserFilterDTO`           | For filter-based user selection                   |
| `BulkAssignOptionsDTO`    | Options block (dry_run, duplicate_handling, etc.) |
| `BulkAssignResponseDTO`   | Response with summary + results                   |
| `BulkAssignResultItemDTO` | Per-item result                                   |
| `BulkDeassignRequestDTO`  | Main request for deassign API                     |
| `DeassignOptionsDTO`      | Options block for deassign                        |

#### 1.2 Controller

| File                              | Description                                                |
| --------------------------------- | ---------------------------------------------------------- |
| `BulkLearnerManagementController` | New v3 controller with `/assign` and `/deassign` endpoints |

#### 1.3 Service Layer

| File                      | Description                                               |
| ------------------------- | --------------------------------------------------------- |
| `BulkAssignmentService`   | Orchestrates the assign flow                              |
| `BulkDeassignmentService` | Orchestrates the deassign flow                            |
| `DefaultInviteResolver`   | Auto-resolves default invite/plan; auto-creates if needed |

#### 1.4 Dependencies (Existing, Reused)

| Class                                  | Method Used                                                                   |
| -------------------------------------- | ----------------------------------------------------------------------------- |
| `EnrollInviteService`                  | `findDefaultEnrollInviteByPackageSessionIdOptional()`, `createEnrollInvite()` |
| `UserPlanService`                      | `createUserPlan()` (handles stacking automatically)                           |
| `UserPlanService`                      | `cancelUserPlan()` (for deassign SOFT/HARD)                                   |
| `AuthService`                          | `createUserFromAuthService()` (for new users)                                 |
| `AuthService`                          | `getUsersFromAuthServiceByUserIds()` (for fetching user details)              |
| `StudentSessionRepository`             | CRUD for `StudentSessionInstituteGroupMapping`                                |
| `LearnerEnrollmentNotificationService` | For notification triggers                                                     |
| `WorkflowTriggerService`               | For enrollment/termination workflows                                          |

### Phase 2: Frontend

#### 2.1 Components

| Component                | Description                                                         |
| ------------------------ | ------------------------------------------------------------------- |
| `BulkAssignDialog`       | Multi-step dialog (Steps 1-4)                                       |
| `LearnerSelector`        | Step 1: Search + filter-based selection                             |
| `PackageSessionSelector` | Step 2: (reuse existing component)                                  |
| `InvitePicker`           | Step 3: Paginated dropdown for selecting invite per package session |
| `EnrollmentPreview`      | Step 4: Dry-run results table                                       |
| `BulkDeassignDialog`     | De-assignment dialog with mode selection                            |

#### 2.2 API Hooks

| Hook                          | Description                                                                |
| ----------------------------- | -------------------------------------------------------------------------- |
| `useBulkAssign`               | Mutation hook for assign API                                               |
| `useBulkDeassign`             | Mutation hook for deassign API                                             |
| `useInvitesForPackageSession` | Query hook using existing invite listing API with packageSessionIds filter |

---

## 12. Data Model Impact

### No New Tables Required

All operations use existing tables:

- `enroll_invite` — existing
- `package_session_learner_invitation_to_payment_option` — existing (join table)
- `payment_option` — existing
- `payment_plan` — existing
- `user_plan` — existing (one per user × invite)
- `student_session_institute_group_mapping` — existing
- `student` — existing

### New Records Only

The only new rows created are:

- Auto-created `EnrollInvite` + `PaymentOption` + `PaymentPlan` (only when no DEFAULT invite exists)
- New `UserPlan` rows per assignment
- New/updated `StudentSessionInstituteGroupMapping` rows

---

## Appendix A: Decision Log

| #   | Decision                                                                 | Rationale                                                                                                                |
| --- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| 1   | Each package session assignment resolves its own invite → own UserPlan   | Confirmed by stacking check scoping to `(userId, enrollInviteId)`. Avoids cross-package-session coupling.                |
| 2   | Re-enrollment integrated into assign API via `duplicate_handling` option | Avoids requiring admin to use a separate API. Follows existing `LearnerSessionOperationService.reEnrollStudent` pattern. |
| 3   | Auto-create default FREE invite when none exists                         | User's explicit requirement. Ensures bulk assign always succeeds without pre-configuration.                              |
| 4   | Best-effort (not transactional)                                          | One failed user shouldn't block 99 others. Per-item status reporting gives full visibility.                              |
| 5   | Dry-run before execution                                                 | User's explicit requirement. Reduces risk of large bulk operations.                                                      |
| 6   | No new tables needed                                                     | Leverages existing data model fully.                                                                                     |
| 7   | Use existing invite listing API for invite picker                        | `GET /v1/enroll-invite/get-enroll-invite?packageSessionIds=[...]` already supports this use case.                        |
| 8   | De-assign warns about shared UserPlans                                   | Prevents accidental impact on other package sessions when a UserPlan is shared across bundled sessions.                  |
| 9   | Filter-based selection is additive (union with user_ids)                 | Flexibility: admin can select specific users AND import from another course.                                             |
| 10  | Enrollment type always MANUAL for admin API                              | Admin-initiated bulk assign bypasses payment gateway. Transaction ID is optional for record-keeping.                     |

---

## Appendix B: Sequence Diagram (Assign Flow)

```
Admin UI                    Controller              BulkAssignmentService           DefaultInviteResolver           UserPlanService          StudentSessionRepo
   │                           │                           │                              │                              │                         │
   │── POST /assign ──────────>│                           │                              │                              │                         │
   │   (dry_run=true)          │── orchestrate() ─────────>│                              │                              │                         │
   │                           │                           │── resolveUsers() ───────────>│                              │                              │
   │                           │                           │<── List<UserDTO> ────────────│                              │                              │
   │                           │                           │                              │                              │                         │
   │                           │                           │── FOR EACH (user, assignment):                              │                         │
   │                           │                           │── resolveInvite(psId) ───────>│                              │                         │
   │                           │                           │                              │── findDefault() ────────────>│                         │
   │                           │                           │                              │<── EnrollInvite|null ────────│                         │
   │                           │                           │                              │── [auto-create if null] ─────│                         │
   │                           │                           │<── ResolvedConfig ────────────│                              │                         │
   │                           │                           │                              │                              │                         │
   │                           │                           │── checkDuplicate() ──────────────────────────────────────────────────────────────────>│
   │                           │                           │<── ExistingMapping|null ─────────────────────────────────────────────────────────────│
   │                           │                           │                              │                              │                         │
   │                           │                           │── [if dry_run: skip writes]   │                              │                         │
   │                           │                           │── [if !dry_run]:              │                              │                         │
   │                           │                           │── createUserPlan() ──────────────────────────────────────────>│                         │
   │                           │                           │<── UserPlan ─────────────────────────────────────────────────│                         │
   │                           │                           │── createMapping() ───────────────────────────────────────────────────────────────────>│
   │                           │                           │<── Mapping ─────────────────────────────────────────────────────────────────────────│
   │                           │                           │                              │                              │                         │
   │                           │<── BulkAssignResponseDTO ──│                              │                              │                         │
   │<── 200 OK (results) ──────│                           │                              │                              │                         │
```

# Onboarding Flow — End-to-End Feature Documentation

> Scope: how the Onboarding Flow feature is modeled, persisted, exposed, and consumed across the
> platform — from `admin_core_service`'s database tables, through the admin dashboard's flow
> builder and management dashboard, into the student/lead side-view, and finally how the learner
> app (including a parent acting on a linked child's behalf) renders and submits steps.

> ### Status: v1, live on `feature/onboarding-flow`
>
> This document describes the feature as built incrementally on that branch, including an
> adversarial correctness review pass and the fixes it produced. It is **not yet on `main`**.

---

## 1. Conceptual Overview

Vacademy has two long-standing, independent journeys: the **CRM/Lead** journey
(`audience`/`audience_response`, lead statuses, counsellor follow-ups) and the
**Student/Enrollment** journey (`student`, `student_session_institute_group_mapping`, package
sessions). There was no structured way to manage the *middle* journey — the period after a lead
agrees to join but before they're fully enrolled (collecting parent/student details, document
checklists, course assignment, etc.).

**Onboarding Flow** is a third, independent domain for exactly that middle phase. It has **no FK
into `audience_response`, `student`, or `student_session_institute_group_mapping`** — the only
link is a loose `subject_user_id` (an auth_service `users.id`), the one identifier stable across
both "still a lead" and "already a student" states. This keeps the feature usable with leads and
students without hard-coupling to either system.

The feature is gated behind an `ONBOARDING_SETTING` institute setting (default off — zero
behavior change when disabled). When on, institutes get an "Onboarding" tab under CRM to build
multi-step flows (checklists). Each step is currently always **FORM** type (v1 ships one step
type, built to allow more later): a set of attached institute custom fields, with per-role
(ADMIN/STUDENT/PARENT) view/edit control, optionally granting the STUDENT role, sending login
credentials, and/or creating a student + course enrollment on completion.

A flow instance can be driven by:
- an **admin**, from a lead/student's side-view in the admin dashboard, or
- the **subject themself**, self-service, from the learner app, or
- a **parent** acting on behalf of the subject — either because the parent *is* the subject and a
  step resolves their real child mid-flow, or because the parent has their own separate
  auth_service login already linked to an existing child account.

---

## 2. Database Schema

Flyway migrations in `admin_core_service/src/main/resources/db/migration/`:

**V383__Onboarding_tables.sql** — core tables. No FK to `audience_response`/`student`/`ssigm`;
`institute_custom_field_id` references are soft (no FK), matching `custom_field_values`'s
existing posture.

| Table | Purpose |
|---|---|
| `onboarding_flow` | `id, institute_id, name, description, status (DRAFT/ACTIVE/ARCHIVED), start_mode (MANUAL/AUTO/BOTH — UI metadata only), created_by_user_id` |
| `onboarding_step` | `id, flow_id (FK, cascade), step_order, step_name, step_type, step_type_config (JSON), is_optional, grants_student_role, sends_login_credentials, role_access (JSON), fields_config (JSON), status (ACTIVE/ARCHIVED)`. `UNIQUE(flow_id, step_order)` |
| `onboarding_instance` | `id, flow_id (FK), institute_id, subject_user_id, current_step_id (FK, SET NULL), status (IN_PROGRESS/COMPLETED/ABANDONED/CANCELLED), started_by (MANUAL/AUTO), started_by_user_id, source_event_name/id, started_at, completed_at` |
| `onboarding_step_instance` | `id, onboarding_instance_id (FK, cascade), step_id (FK), status (PENDING/IN_PROGRESS/COMPLETED/SKIPPED), entered_at, completed_at, completed_by_user_id, completed_by_role, skip_reason`. `UNIQUE(onboarding_instance_id, step_id)` |

Design notes baked into the migration's own comments:
- **Role access and field config are JSON columns on `onboarding_step`**, not separate join
  tables — both are small, bounded lists always read/written as a whole per step, never
  queried/filtered independently, so a JSON column avoids extra tables/joins for no relational
  access pattern.
- **No separate step-instance history table** — v1's transitions are strictly linear
  (`PENDING → IN_PROGRESS → COMPLETED/SKIPPED`, each once), so the instance row's own
  status/timestamps/actor columns already capture everything a history table would add.
- **`uq_onboarding_step_flow_order` is checked immediately, across *every* status** — including
  `ARCHIVED` (soft-deleted) steps. This one detail caused two real bugs (see §8).

**V393__Onboarding_instance_resolved_subject.sql** — adds
`onboarding_instance.resolved_subject_user_id VARCHAR(255) NULL`. See §4.

---

## 3. Backend Architecture

Package: `admin_core_service/.../features/onboarding/` (entity/repository/service/controller/dto/enums/steptype).

### Entities & enums
- `OnboardingFlow`, `OnboardingStep`, `OnboardingInstance`, `OnboardingStepInstance` — map directly
  to the tables above.
- `OnboardingFlowStatus`, `OnboardingInstanceStatus`, `OnboardingStepInstanceStatus`,
  `OnboardingStartedBy` (MANUAL/AUTO), `OnboardingStepTypeEnum` (FORM only in v1),
  `OnboardingRoleKey` (ADMIN/STUDENT/PARENT).

### Pluggable step types
`steptype/OnboardingStepTypeHandler` (interface: `supports`, `onEnter`, `onSubmit`) +
`OnboardingStepTypeHandlerRegistry` (constructor-injected list, `supports()`-based dynamic
resolution — mirrors the workflow engine's `NodeHandler(Registry)` pattern).

**`FormStepTypeHandler`** — v1's only implementation:
- Parses the step's `fields_config` JSON into `OnboardingStepFieldConfigDTO[]`.
- For each field, re-checks `OnboardingRoleAccessResolutionService.resolveFieldAccess(...).canEdit`
  **server-side** for the actual caller role — a field the caller can't edit is treated as not
  submitted (falls through to the mandatory check like any absent value), so a tampered payload
  can't write to it.
- Missing mandatory fields throw `InvalidRequestException` (→ 400, not the generic
  `RuntimeException` catch-all's 511).
- Saves accepted values via the existing `CustomFieldValueService`, under
  `CustomFieldValueSourceTypeEnum.ONBOARDING_STEP_INSTANCE` / `CustomFieldTypeEnum.ONBOARDING_STEP`
  — the same infrastructure `AUDIENCE_FORM` responses use, just a new source/type pair.
- If `step_type_config.create_student = true`, resolves the target course from a **pool**
  (`step_type_config.package_session_ids`; empty pool = open choice, validated server-side against
  the pool when non-empty) and calls `OnboardingStudentCreationService.createStudentIfAbsent`.

### Services
- **`OnboardingFlowService`** — flow CRUD, including `archiveFlow` (soft delete via
  `status=ARCHIVED`).
- **`OnboardingStepService`** — step CRUD + nested field-config/role-access.
  - `createStep` always **server-derives** `step_order` from
    `onboardingStepRepository.findMaxStepOrder(flowId) + 1` (across every status, including
    ARCHIVED) — never trusts a client-supplied order (see §8, bug #1).
  - `reorderSteps` does a **two-phase update**: every step first moves to a guaranteed-unique
    negative order (flushed immediately), then to its real target order — avoids colliding with a
    not-yet-processed step's still-current order (see §8, bug #5).
  - `resolveInstituteCustomFieldId` — attaching an existing field or creating a new one always
    resolves to a mapping row **scoped to this step**
    (`type=ONBOARDING_STEP, type_id=step.id`), never the picker's original catalog row, so the
    field is actually visible to this step's own `feature-fields` lookups (see §8, bug #2).
- **`OnboardingInstanceService`** — starts instances (manual + internal), `listBySubject`
  (side-view read), `searchInstances` (paginated dashboard read, batch-resolves subject/flow/step
  names for the current page only).
- **`OnboardingStepInstanceService`** — advances a step instance through its lifecycle:
  - `enterStep` — creates/reuses the PENDING row, moves to IN_PROGRESS, dispatches `onEnter`,
    fires `ONBOARDING_STEP_ENTERED`.
  - `completeStep` — **idempotent** on an already COMPLETED/SKIPPED instance (no-op return, see
    §8 bug #4); enforces admin-only for `create_student`-configured steps, `is_parent` resolution
    requests, **and** any step a non-admin's role isn't actually permitted to act on (see
    `isActionableForRole` below, and §8 bug #3); resolves parent→student identity *before* any
    identity-touching side effect; dispatches to the step-type handler; on COMPLETED, applies
    side effects, fires `ONBOARDING_STEP_COMPLETED`, and advances to the next step (or completes
    the instance and fires `ONBOARDING_FLOW_COMPLETED`).
  - `skipStep` — same idempotency guard; only allowed when `is_optional`.
  - `isActionableForRole(step, roleKey)` — **the single source of truth** for "can this
    non-admin role actually do something on this step": false for `create_student`-configured
    steps; otherwise checks whether the step has no fields and its own step-level default grants
    edit, **or** at least one attached field resolves editable for this role (deliberately
    per-field, not just the step-level default, so an admin who granted edit on specific fields
    while leaving the step-level default restrictive isn't wrongly locked out). Used both to
    populate the learner-facing `learner_can_act` flag and to hard-enforce `completeStep` itself.
  - `getResolvedFieldsForRole` / `getSubmittedFieldValues` — resolve a step's fields to actual
    values, the latter for admin's "view submitted form" dialog, the former (role-filtered,
    view/edit-annotated) for the learner app's own form rendering.
- **`OnboardingStudentCreationService`** — the identity-resolution + enrollment logic. See §4.
- **`OnboardingRoleAccessResolutionService`** — resolves effective view/edit access:
  - `resolveRoleKey(callerIsAdminSurface, callerUser)` — ADMIN if calling through the
    institute-admin surface; else PARENT if the caller's own auth_service `is_parent=true`; else
    STUDENT. Always based on **the caller's own account**, independent of whose instance/step
    they're acting on.
  - `resolveStepAccess` / `resolveFieldAccess` — ADMIN short-circuits to full access; a
    field-level `role_access` entry (if present) overrides the step-level default; absence of
    any entry defaults to `can_view=true, can_edit=false`.
  - `isLinkedGuardianOf(callerId, subjectUserId)` — a pure DB-relationship check
    (`ParentLinkService.getParentOfStudent(subjectUserId).id == callerId`), independent of JWT
    authorities/institute/enrolment. Lets a parent with their **own separate login** (linked via
    `users.linked_parent_id`) act on a child's instance — see §4.
- **`OnboardingStepWorkflowTriggerService`** — manages the workflow triggers attached to one step
  (`eventId = step.id`), mirroring `LmsSettingService`'s package-trigger pattern but restricted to
  `ONBOARDING_STEP_ENTERED/COMPLETED/SKIPPED`. Deactivates (never hard-deletes) a trigger no
  longer desired, since a fired trigger is FK-referenced by `workflow_execution`.

### Enum additions to existing files (not new files)
- `CustomFieldTypeEnum.ONBOARDING_STEP`, `CustomFieldValueSourceTypeEnum.ONBOARDING_STEP_INSTANCE`
- `EventAppliedType.ONBOARDING_STEP` (metadata only)
- `WorkflowTriggerEvent.ONBOARDING_FLOW_STARTED/COMPLETED`, `ONBOARDING_STEP_ENTERED/COMPLETED/SKIPPED`
- `SettingKeyEnums.ONBOARDING_SETTING` (default `{enabled: false}`, via
  `InstituteSettingService.createDefaultOnboardingSetting`)

### What's *not* built in v1
The original design sketched an auto-start mechanism (a `START_ONBOARDING_FLOW` workflow node,
so a flow could start automatically off any existing trigger like `LEAD_STATUS_CHANGED`, with
zero code changes to the triggering service). **This does not exist yet** — `startInstance` fires
`ONBOARDING_FLOW_STARTED` *outward* to the workflow engine, but nothing lets a workflow node
*start* an instance. v1 only supports the admin manually starting a flow from a side-view. This is
the main gap versus the original plan.

---

## 4. Identity Resolution: Subject vs. Resolved Subject vs. Guardian

This is the most subtle part of the feature and went through three iterations before landing.

**The rule: `onboarding_instance.subject_user_id` is set once at start and *never* reassigned.**
It anchors which lead/student side-view the instance is permanently visible under. Reassigning it
(the first implementation did this) makes the instance "disappear" from the profile the admin was
working from the moment identity resolves — a real bug caught via live testing.

**`resolved_subject_user_id`** is a *separate* column, set exactly once, the first time a step
configured to touch identity is completed with `is_parent=true`:

1. `OnboardingStepInstanceService.completeStep` detects `touchesIdentity` (the step grants the
   STUDENT role, sends login credentials, or creates a student) and a payload with
   `is_parent=true`.
2. It calls `OnboardingStudentCreationService.resolveSubjectUserId`, which:
   - Acquires a **pessimistic write lock** on the instance row
     (`OnboardingInstanceRepository.findByIdForUpdate`) before its check-then-act, so two
     near-simultaneous completions of the same step (double-click, client retry) can't each
     create a separate child account (§8 bug #6).
   - Guards against **double resolution**: if `resolved_subject_user_id` is already set (a prior
     step already resolved the real student), it's a no-op — otherwise a later step re-run with
     `is_parent=true` would treat the already-resolved child as a parent adding a second, spurious
     student.
   - Otherwise calls `ParentLinkService.link(...)` (`PARENT_ADDS_STUDENT` / `CREATE_NEW`, anchored
     on the current `subject_user_id`) — the same guardian-link mechanism the admin dashboard's
     assign-learner dialog uses — and stores the result as `resolved_subject_user_id`.
3. Every identity-touching side effect from then on (role grant, credentials email, enrollment)
   targets `instance.getEffectiveSubjectUserId()` — resolved if present, else subject — **never**
   `getSubjectUserId()` directly.

**Visibility is dual**: `OnboardingInstanceRepository.findVisibleToUser` matches
`subject_user_id = :userId OR resolved_subject_user_id = :userId`, so the instance shows up under
**both** the original lead's side-view and the resolved student's, once resolution has happened.

### Parent access via a separate login

The above covers "the parent *is* the original subject, and a child gets created/linked mid-flow."
There's a second, independent scenario: **a parent who already has their own auth_service login**,
linked to an *existing* child account via `users.linked_parent_id` (set the moment they're
linked — the child row carries `linked_parent_id`, the parent row gets `is_parent=true`).

`LearnerOnboardingController` (all endpoints under `/admin-core-service/learner/onboarding`)
supports both:
- `assertOwnsStepInstance` allows the caller if they equal `subject_user_id`, equal
  `resolved_subject_user_id`, **or** `isLinkedGuardianOf` either one — so a parent with a separate
  login can open and submit a linked child's step instance directly.
- `GET /instances` returns the caller's own instances **plus** every linked child's (via
  `ParentLinkService.getChildrenOfParent`, best-effort — a transient auth_service failure
  degrades to just the caller's own instances rather than 500ing the whole page), each instance
  DTO carrying `subject_full_name` (only set when the *effective* subject isn't the caller
  themself) so a parent with multiple children can tell their cards apart.
- The caller's **role** (STUDENT vs PARENT) for field access purposes is always resolved from
  **the caller's own** `is_parent` flag — a parent acting on a child's step gets PARENT-scoped
  field access, regardless of which account the instance itself belongs to.

---

## 5. Role-Based Access Control (ADMIN / STUDENT / PARENT)

Configured per step (`role_access` JSON: `[{role_key, can_view, can_edit}]`) and optionally
per-field (same shape, on each `fields_config` entry) via the admin dashboard's
`RoleAccessGrid` (a plain ADMIN/STUDENT/PARENT × view/edit checkbox grid, reused for both).
**Default for a newly created step: ADMIN full access, STUDENT view-only, PARENT no access** — an
admin must explicitly grant STUDENT/PARENT edit for a step (or specific fields) to be
self-serviceable. This is a deliberate secure-by-default choice — before this session's review
pass, it was *only* enforced at the field level (silently dropping unauthorized field values);
now it's also enforced at the step level (§8 bug #3): a non-admin can't complete a step with
nothing they're actually permitted to submit.

Field-level access **overrides** the step-level default when present; a field with no explicit
role_access entry falls back to the step default.

---

## 6. API Surface

**Admin** (`/admin-core-service/onboarding/...`):

| Verb | Path | Purpose |
|---|---|---|
| `POST/GET/PUT/DELETE` | `/flows[/{flowId}]` | Flow CRUD (DELETE = archive) |
| `POST/GET/PUT/DELETE` | `/flows/{flowId}/steps[/{stepId}]` | Step CRUD |
| `PUT` | `/flows/{flowId}/steps/reorder` | Reorder (two-phase, see §3) |
| `GET/POST` | `/flows/{flowId}/steps/{stepId}/workflow-triggers` | Per-step trigger config |
| `POST` | `/instances` | Manual start |
| `GET` | `/instances/{id}` | One instance |
| `GET` | `/instances?subjectUserId=` | Side-view read |
| `GET` | `/instances/dashboard?flowId&status&pageNo&pageSize` | Paginated management dashboard |
| `POST` | `/step-instances/{id}/complete` | Complete (admin role) |
| `POST` | `/step-instances/{id}/skip` | Skip (must be `is_optional`) |
| `GET` | `/step-instances/{id}/submitted-values` | Actual submitted values (admin "view form") |

**Learner** (`/admin-core-service/learner/onboarding/...`, always resolves "who's asking" from the
JWT — never accepts an arbitrary subject id):

| Verb | Path | Purpose |
|---|---|---|
| `GET` | `/instances?instituteId=` | Caller's own + linked children's instances |
| `GET` | `/step-instances/{id}` | One step instance (ownership/guardian-checked) |
| `GET` | `/step-instances/{id}/fields` | Fields resolved for caller's role (view-filtered, edit-annotated, pre-filled) |
| `POST` | `/step-instances/{id}/submit` | Submit (role + guardian re-checked server-side) |

---

## 7. Frontend

### Admin dashboard (`frontend-admin-dashboard/src/routes/audience-manager/onboarding/`)
- `onboarding-flows-page.tsx` — flow list (`MyTable`), create/delete (archive) actions.
- `$flowId` → `onboarding-flow-builder-page.tsx` — ordered step list, step CRUD, per-step
  `step-dialog.tsx` (course pool via `MultiSelect`, not a single fixed course — so a flow doesn't
  need rebuilding every time a new course is added), `step-field-config-editor.tsx` (attach
  existing / create new fields, multi-select), `role-access-grid.tsx`, `step-workflow-triggers-card.tsx`.
- `onboarding-dashboard-page.tsx` — the management dashboard (filters, `MyTable` + `MyPagination`,
  resolved subject/flow/step names).

### Student/lead side-view (`frontend-admin-dashboard/.../student-side-view/student-onboarding/`)
`student-onboarding-profile.tsx` — one card per instance, current-step complete/skip actions,
`SubmittedFormDialog` (actual values, not just field names), `CompleteFormStepDialog` (parent/
student toggle whenever the step touches identity; shows the subject's **existing** name/email/
mobile as a preview when the toggle is off, since that's what the student will be created from
when the toggle is on the "is_parent" details are collected instead).

### Learner app (`frontend-learner-dashboard-app/src/routes/onboarding/`)
- `index.tsx` — every instance the caller can see (including linked children's, labeled by name);
  renders the current step's form only if `learner_can_act !== false` (an admin-only or
  role-denied step shows a neutral "no action needed from you" card instead of a dead-end form).
- `-components/onboarding-step-form.tsx` — renders fields from the role-resolved endpoint: fields
  the caller can't edit render **read-only** (pre-filled), only editable fields are submitted.
- `-services/onboarding-services.ts` — API client; DTOs match the Java `@JsonNaming(SnakeCaseStrategy)`
  shapes (`learner_can_act`, `subject_full_name`, resolved-field `can_edit`/`value`, etc.).

### `/dashboard` gate (`frontend-learner-dashboard-app/src/routes/dashboard/index.tsx`)
`DashboardOnboardingGate` wraps the real `DashboardComponent`: while the caller has a pending,
actionable onboarding step (their own or a linked child's), `/dashboard` shows that step's form
instead of the full dashboard — and doesn't mount the dashboard's own (expensive) data-fetch
effects until it's clear there's nothing left to gate on. Institute id is resolved via the same
`getInstituteId()` + explicit `isResolvingInstitute` pattern the sibling `/onboarding` page uses
(not the domain-routing store, which is populated asynchronously elsewhere with no loading
signal — using it directly caused a real "flash of the full dashboard" bug, §8 bug #7).

---

## 8. Bugs Found and Fixed This Session

Roughly chronological; several were caught via live testing, the last batch via a dedicated
adversarial review pass once the parent/learner-access work was in place.

1. **Step-order collision on delete + re-add.** `uq_onboarding_step_flow_order` applies across
   *every* status including ARCHIVED; `createStep` counted only ACTIVE steps for the next order,
   reusing a deleted step's old order. Fixed: always derive from `MAX(step_order)` across all
   statuses, ignoring any client-supplied value.
2. **"Attach existing field" invisible everywhere.** Reused the picker's raw catalog row id
   instead of creating a step-scoped `(type=ONBOARDING_STEP, type_id=step.id)` mapping — the
   field was never returned by any `ONBOARDING_STEP` feature-fields lookup. Fixed: always resolve
   to a step-scoped mapping (idempotent find-or-create).
3. **Step-level role_access was advisory only.** A step with no `create_student` config but
   role_access denying a role edit could still be completed by that role (only fields were
   enforced; the submission itself wasn't gated). Fixed via `isActionableForRole`, enforced in
   `completeStep`.
4. **No status-transition guard.** Re-completing/re-skipping an already-finalized step re-sent
   credential emails, re-fired triggers, and could regress an already-completed next step back to
   IN_PROGRESS. Fixed: idempotent no-op on COMPLETED/SKIPPED.
5. **`reorderSteps` unique-constraint collision.** Updating steps one at a time, in request
   order, could collide with a not-yet-processed step's still-current order (the constraint is
   checked immediately, not deferred) — ordinary drag-and-drop could throw. Fixed with two-phase
   negative-order staging.
6. **Double parent-resolution race.** The resolved-subject guard was read-then-write with no row
   lock; two near-simultaneous completions could each create a separate child account. Fixed
   with a pessimistic write lock on the instance before the check.
7. **Dashboard gate flash.** Reading institute id from a store populated asynchronously
   elsewhere, with no "still resolving" signal, let the real dashboard mount (and fire its
   queries) before the onboarding check could run. Fixed to mirror the sibling page's proven
   pattern.
8. **`subject_full_name` used the wrong id.** Compared against `subject_user_id` (which never
   changes) instead of `getEffectiveSubjectUserId()`, so a parent-resolved instance where the
   parent *is* the original subject never showed the resolved child's name. Fixed.
9. **`custom_field` DTO camelCase/snake_case mismatch** ("Untitled field" bug) — the nested
   `CustomFieldDTO` has no `@JsonNaming` override and serializes camelCase, but several frontend
   types declared snake_case. Fixed across all consuming files.
10. Earlier design iteration bugs (already superseded, listed for history): reassigning
    `subject_user_id` directly on parent resolution (broke side-view visibility); no admin-only
    enforcement on `create_student`/`is_parent` steps (would have let a self-service learner
    enroll in any course or create arbitrary accounts).

---

## 9. Known Gaps / Follow-ups

- **No auto-start.** The `START_ONBOARDING_FLOW` workflow-node auto-start mechanism from the
  original design was never built; flows can only be started manually from a side-view today.
- **`reorderSteps` vs. archived-step order collisions.** The two-phase fix (§8 bug #5) only
  guards against collisions *within* the reorder request. An institute whose steps were created
  before the `findMaxStepOrder` fix (bug #1) could theoretically still have an active step's
  target order collide with an old archived step's leftover low-numbered order — not confirmed in
  production data, flagged as a residual risk rather than fixed speculatively.
  Data-hygiene cosmetic: archiving/editing a step doesn't clean up orphaned
  `institute_custom_fields` mapping rows.

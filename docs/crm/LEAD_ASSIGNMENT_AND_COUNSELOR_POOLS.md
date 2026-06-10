# Lead Assignment & Counselor Pools — Routing Engine Guide

How leads get an owner. Covers the counselor-pool data model, the three assignment modes (MANUAL / ROUND_ROBIN / TIME_BASED), the rotation cursor, backup redirection, manual assignment, and the pool-management UI. Backend lives in [`features/counselor_pool/`](../../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/counselor_pool/); frontend pool editor lives under [`src/routes/settings/leads/pools/`](../../frontend-admin-dashboard/src/routes/settings/leads/pools/).

> Last reviewed: 2026-06-10. Reflects code currently on `main`.
>
> Related: [Leads Management](LEADS_MANAGEMENT.md) (where assignment fires in the intake flow), [Workbench doc §7](CRM_WORKBENCH_AND_SALES_DASHBOARD.md) (the *re*assign engine — a separate code path), [Leads Settings](LEADS_SETTINGS.md).

---

## 1. Three ways a lead gets an owner

| Path | Trigger | Code |
|---|---|---|
| **Pool auto-assign** | Synchronously inside lead submission, when the campaign is attached to a pool | `CounselorAssignmentService.assignCounselorForLead(audienceId)` |
| **Manual assign** | Admin/counsellor clicks "Assign" on any lead row / side-view | `POST /v1/audience/user-lead-profile/assign-counselor` |
| **Workbench reassign** | Manager moves a counsellor's book of leads (SINGLE / ROUND_ROBIN / MANUAL modes, optional mark-inactive) | `CounsellorReassignService` — documented in the [workbench doc §7](CRM_WORKBENCH_AND_SALES_DASHBOARD.md) |

All three converge on **[`UserLeadProfileService.assignCounselor(userId, instituteId, counselorId, counselorName)`](../../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/audience/service/UserLeadProfileService.java)** — the canonical setter. It writes `user_lead_profile.assigned_counselor_id` + `assigned_counselor_name` and emits the `LEAD_ASSIGNED_TO_COUNSELOR` workflow trigger. It does **not** log the timeline event — each caller logs `COUNSELOR_ASSIGNED` itself (so metadata like `trigger`/`mode` reflects the caller).

> Assignment is **user-level** (`user_lead_profile`), not per-submission. A person with 3 campaign submissions has one owner.

---

## 2. Data model (V265, V270)

```
counselor_pool ─┬─< counselor_pool_audience   (pool ↔ campaign; holds the rotation cursor)
                ├─< counselor_pool_member     (pool × audience × counsellor matrix)
                └─< counselor_pool_shift ─< counselor_pool_shift_member   (TIME_BASED only)
```

### `counselor_pool`
| Column | Meaning |
|---|---|
| `id`, `institute_id`, `name`, `description` | |
| `assignment_mode` | `MANUAL` / `ROUND_ROBIN` / `TIME_BASED` |
| `schedule_pattern` | `PER_DAY` / `SAME_HOURS_ALL_DAYS` — **UI affordance only**; routing reads flat shift rows and ignores this. NULL until the admin picks one. |
| `created_by` | Receives "lead could not be auto-assigned" alerts |

### `counselor_pool_audience` — one row per campaign, **UNIQUE on `audience_id`** (a campaign can belong to at most one pool)
| Column | Meaning |
|---|---|
| `pool_id`, `audience_id` | |
| `last_assigned_counselor_id` | **The round-robin cursor.** User id of the last counsellor picked for this audience. Each audience rotates independently. |
| `last_assigned_at` | Informational only — not read by routing |

### `counselor_pool_member` — one row per (pool, audience, counsellor)
| Column | Meaning |
|---|---|
| `display_order` | Position in the rotation, 1-indexed, **per audience** |
| `status` | `ACTIVE` / `INACTIVE` — inactive members are skipped (or redirected, see backup) |
| `backup_counselor_user_id` | When `status = INACTIVE`, leads picked for this member are redirected here. One level only — backup chains are NOT followed. Cleared automatically on reactivation. |
| `monthly_target` | **Reserved / not read at runtime.** Settable in the UI matrix dialog; intended for future quota logic. |

### `counselor_pool_shift` / `counselor_pool_shift_member` (TIME_BASED)
One row per weekly time block: `day_of_week` (`MON`…`SUN`), `start_time`, `end_time` (wall clock, v1 hard-coded to Asia/Kolkata), `label`, `status`. Shift members are the counsellors staffing that block. Unique `(shift_id, counselor_user_id)`.

---

## 3. The routing algorithm

Entry point: [`CounselorAssignmentService.assignCounselorForLead(audienceId)`](../../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/counselor_pool/service/CounselorAssignmentService.java) — called synchronously from `AudienceService` during lead submission (after scoring, before the workflow trigger). Returns `Optional<String>` (counsellor user id) — empty means the lead stays unassigned (this never fails the submission).

```
1. Resolve pool via counselor_pool_audience (audience not pooled → empty)
2. Mode MANUAL → empty (no auto-assignment)
3. Build ordered candidate list:
     ROUND_ROBIN → all members for this audience, ORDER BY display_order
     TIME_BASED  → members on an ACTIVE shift covering "now" (institute TZ),
                   intersected with the audience's members, same ordering
   Empty candidates → alert pool creator, return empty
4. PESSIMISTIC_WRITE lock the counselor_pool_audience row
   (serializes concurrent submissions per audience — cursor can't double-fire)
5. pickNext(): first member with display_order strictly greater than the
   last-assigned member's order; wrap to the lowest order if none / cursor orphaned
6. resolveWithBackup(): picked member INACTIVE?
     → use their backup_counselor_user_id if set & usable (one level only)
     → else fall through to next eligible member in rotation
     → all inactive with no usable backups → alert pool creator, return empty
7. Persist cursor: last_assigned_counselor_id = the ORIGINAL picked member
   (not the backup — so the rotation resumes correctly when they reactivate)
8. Notify: bell notification to the assignee ("New lead assigned from campaign X")
```

The caller then runs `UserLeadProfileService.assignCounselor(...)` with the resolved id and logs the timeline event.

**TIME_BASED specifics:** shift match is `start_time <= now < end_time` for the current `day_of_week`. On schedule save, [`CounselorPoolShiftService.validateScheduleCoverage`](../../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/counselor_pool/service/CounselorPoolShiftService.java) enforces **24/7 coverage** — every day must be covered 00:00:00 → 23:59:59 with no gaps (overlaps allowed). `SAME_HOURS_ALL_DAYS` is expanded server-side into 7 days of identical flat rows.

**Known limitation:** rotation is pure sequence — no weighting by counsellor rating, current open-lead load, or `monthly_target` (same gap as the workbench reassigner's ROUND_ROBIN; see workbench doc §11.6 #5).

---

## 4. Pool & member API (`CounselorPoolController`)

Base `/admin-core-service/v1/counselor-pool`. All admin-JWT protected.

| Verb | Path | Purpose |
|---|---|---|
| POST | `/` | Create pool (optionally with initial audiences + counsellors, one transaction) |
| GET | `/` `?instituteId=` | List pools |
| GET | `/{poolId}` | Full pool: audiences, members, shifts |
| PATCH | `/{poolId}` | Update name/description/mode/pattern |
| DELETE | `/{poolId}` | Delete (only when no linked audiences) |
| POST | `/{poolId}/audiences` | Attach campaigns (seeds member rows for existing pool counsellors) |
| DELETE | `/{poolId}/audiences/{audienceId}` | Detach campaign + its member rows |
| PUT | `/{poolId}/audiences/{audienceId}/order` | Replace the rotation order (full ordered list of counsellor ids) |
| POST | `/{poolId}/counselors` | Add counsellors to every audience in the pool (appended at the end of each rotation) |
| DELETE | `/{poolId}/counselors/{userId}` | Remove counsellor from the pool entirely |
| PATCH | `/{poolId}/counselors/{userId}/status` | Flip ACTIVE/INACTIVE in this pool. INACTIVE requires a `backup_counselor_user_id`; optional `reassign_existing_leads` moves their open leads (in this pool's audiences) to the backup, with timeline events |
| PATCH | `/counselors/{userId}/status-multi` | Same flip across multiple pools atomically |
| GET | `/counselors/{userId}/memberships` `?instituteId=` | Pools where this counsellor is ACTIVE |
| PATCH | `/{poolId}/counselors/{userId}/monthly-target` | Set per-audience monthly targets (stored, not enforced) |
| GET / PUT | `/{poolId}/schedule` | Read / atomically replace the weekly TIME_BASED schedule (PUT validates 24/7 coverage first) |

**Pool-inactive vs workbench-inactive:** `PATCH .../status` here flips membership in *one pool* and optionally reassigns within that pool's audiences. The workbench's `PATCH /v1/counsellor-workbench/counsellors/{userId}/status` flips **all** `counselor_pool_member` rows for the counsellor institute-wide and pairs with the workbench reassign engine. Don't confuse the two.

### Manual assignment endpoint

```
POST /admin-core-service/v1/audience/user-lead-profile/assign-counselor
     ?userId=&instituteId=&counselorId=&counselorName=
```

Lives in `AudienceController` (not the pool controller). Calls `assignCounselor`, then best-effort logs the `COUNSELOR_ASSIGNED` timeline event, returns the updated `UserLeadProfileDTO`. The eligible-target dropdown comes from `GET /v1/audience/eligible-assignees?instituteId&query` (respects leads-team RBAC narrowing).

---

## 5. Frontend

### 5.1 Pool management — Settings → Lead Settings → Pools

- [`PoolsList.tsx`](../../frontend-admin-dashboard/src/routes/settings/-components/pools/PoolsList.tsx) — pool cards + create.
- Pool editor at `/settings/leads/pools/$poolId` ([`PoolEditor.tsx`](../../frontend-admin-dashboard/src/routes/settings/leads/pools/) + `-components/`), tabbed:
  - **OverviewTab** — name / description / assignment-mode picker; after create, navigates to `?tab=audiences`.
  - **AudiencesTab** — attach/detach campaigns (multi-select dialog).
  - **CounselorsTab** — add members (institute users with COUNSELLOR/ADMIN roles), mark ACTIVE/INACTIVE (inactive dialog picks a backup — COUNSELLOR role only — plus the "reassign existing leads" checkbox), remove, set monthly targets (matrix dialog).
  - **OrderTab** — drag-and-drop rotation order per audience.
  - **ScheduleTab** — TIME_BASED only. Empty state offers the pattern choice; `PerDayScheduleEditor` (7 tabs) or `SameHoursAllDaysEditor` (single editor expanded to all days).

### 5.2 API client

[`src/services/counselor-pool.ts`](../../frontend-admin-dashboard/src/services/counselor-pool.ts) — typed DTOs + TanStack Query hooks (`useCounselorPools`, `useCounselorPool`, `useWeeklySchedule`, `useUpdateMemberStatus`, `useSetWeeklySchedule`, …).

### 5.3 Assign dialog (used everywhere)

[`assign-counselor-to-lead-dialog.tsx`](../../frontend-admin-dashboard/src/components/shared/assign-counselor-to-lead-dialog.tsx) — debounced search over eligible assignees, confirm, then invalidates `['lead-profiles-batch']` + caller-supplied query keys.

---

## 6. Debugging checklist

- **Lead came in unassigned?** Check, in order: campaign attached to a pool (`counselor_pool_audience`)? pool mode MANUAL? any ACTIVE members for that audience (TIME_BASED: any ACTIVE shift covering the submission time, with ACTIVE shift members that are also audience members)? all candidates INACTIVE without usable backups? The pool creator gets an alert in the failure cases.
- **Rotation looks stuck / skips someone:** inspect `counselor_pool_audience.last_assigned_counselor_id` and the members' `display_order` for that audience. A removed member orphans the cursor → next pick wraps to the lowest order (by design).
- **Backup got the lead but the rotation "lost" the original:** it didn't — the cursor stores the original picked member, not the backup.
- **Time-based pool assigns nobody at night:** schedule must cover 24/7; the save endpoint rejects gapped schedules, but a pool switched to TIME_BASED before any schedule exists has no candidates.
- **Timezone:** shift matching is hard-coded to Asia/Kolkata in v1. The admin-core JVM must stay UTC (see repo memory about IST double-offset bugs) — shift logic converts explicitly.

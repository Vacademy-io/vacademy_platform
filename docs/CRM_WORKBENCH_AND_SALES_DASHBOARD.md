# CRM Workbench, Sales Dashboard, Ratings & Org Teams — Team Guide

Onboarding doc for the CRM cluster: the counsellor workbench, sales dashboard, counsellor ratings, lead reassign engine, and the organization-team hierarchy that ties them together. Covers backend (admin_core_service), frontend (frontend-admin-dashboard), the cross-service data model, and the per-table "what is stored where" map.

> Last reviewed: 2026-06-10. Reflects code currently on `main`.

---

## 1. Service & database topology

Two Spring Boot services run against **two separate PostgreSQL databases** on stage/prod (this is the single most important fact in this doc):

| Service | Owns these schemas | Local port |
|---|---|---|
| `admin_core_service` | `audience_response`, `user_lead_profile`, `lead_status`, `lead_followup`, `timeline_event`, `counselor_pool*`, `counsellor_rating`, `institute` (with `setting` JSON), everything else CRM-shaped | **8072** |
| `auth_service` | `users`, `organization_team`, `organization_team_member`, role/permission rows | 8071 |

**They cannot SQL-join across the line.** Any `JOIN users u` in admin-core SQL fails with `relation "users" does not exist`. Identity (name / email / phone) and team-graph data must be fetched via HTTP calls to auth-service. The canonical hydration pattern is at [`AudienceService.mapResponsesToLeadDetails`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/audience/service/AudienceService.java#L2015) — run the SQL on admin-core tables only, collect distinct user_ids, call `AuthService.getUsersFromAuthServiceByUserIds(ids)` once per page, attach.

HTTP calls between services use HMAC signing via `InternalClientUtils`. **Important constraint**: `InternalClientUtils` uses `HttpURLConnection`, which does **not** support `PATCH`. Use `PUT` + a `change_*` flag instead for any admin-core → auth-service forwarded endpoint.

---

## 2. The big picture

```
┌─────────────────────────────── frontend-admin-dashboard ────────────────────────────────┐
│                                                                                          │
│   /counsellors                     /sales-dashboard               /manage-institute/teams│
│   (Workbench roster + drawer)      (Aggregate widgets)            (Org chart)            │
│                                                                                          │
└──────────────────────────────────┬─────────────────────┬──────────────────┬──────────────┘
                                   │                     │                  │
                                   ▼                     ▼                  ▼
┌──────────────────────────── admin_core_service (port 8072) ───────────────────────────────┐
│                                                                                            │
│  /v1/counsellor-workbench/*    /v1/sales-dashboard/*   /v1/counsellor-rating/*             │
│                                                                                            │
│  CounsellorWorkbenchService    SalesDashboardService   CounsellorRatingService             │
│  CounsellorReassignService     (raw JdbcTemplate SQL)  CounsellorRatingComputeService      │
│  CounsellorScopeService                                CounsellorRatingScheduler           │
│  LeadWorkbenchSettingService                                                               │
│  CounsellorActivityFeedService                                                             │
│                                                                                            │
│  Reads/writes: user_lead_profile, audience_response, lead_status, lead_followup,           │
│                timeline_event, counselor_pool_member, counsellor_rating, institute         │
└────────────────────┬──────────────────────────────────────────────────────────┬───────────┘
                     │ HMAC HTTP (AuthService / OrganizationTeamAuthClient)     │
                     ▼                                                          │
┌────────────────────────── auth_service ─────────────────────────────────────┐ │
│  users  •  organization_team  •  organization_team_member                   │ │
└─────────────────────────────────────────────────────────────────────────────┘ │
                                                                                │
┌─────────────────────────── shared Postgres for telephony etc. ───────────────┘
│  telephony_call_log (admin-core DB)
└──────────────────────────────────────────────────────────────────────────────────
```

---

## 3. Organization Teams (hierarchy)

Org teams are the foundation of RBAC for every CRM surface. They live in **auth_service**'s database.

### 3.1 Data model (auth_service)

| Table | Purpose | Key columns |
|---|---|---|
| `organization_team` | Adjacency-list tree of teams per institute | `id`, `institute_id`, `parent_id` (NULL = root), `name`, `code`, `team_type`, `head_user_id`, `status`, `sort_order` |
| `organization_team_member` | Many-to-many users → teams with per-mapping role | `id`, `team_id`, `user_id`, `role_name` (system role), `role_label` (per-mapping display label), `is_team_head`, `parent_user_id` (who this user reports up to), `status` |

A user can be in multiple teams with **different role labels per mapping** (e.g. "Org Head" in Sales, "Advisor" in Finance). The `parent_user_id` chain on `organization_team_member` is what powers per-user scoping (descendants).

### 3.2 Hierarchy API (auth_service)

Exposed to admin-core via `OrganizationTeamAuthClient`. Methods:

- `getSubtreeIncludingSelf(teamId)` — recursive CTE: team + all descendants
- `getAncestors(teamId)` — root → team path
- `getDescendants(teamId)` — flat list of all descendants
- `mappingsForUser(userId)` — every team mapping the user has
- `usersInTeams(teamIds)` — distinct user_ids in any of these teams

### 3.3 Cycle guard & STUDENT guard

- Re-parenting a team rejects the change if `newParent` is in `getDescendants(team)` — prevents cycles.
- `role_name == 'STUDENT'` returns HTTP 400 from team-member create/update endpoints.

### 3.4 Frontend

`/manage-institute/teams` → "Org Chart" tab. Files at [`src/routes/manage-institute/teams/-components/`](../frontend-admin-dashboard/src/routes/manage-institute/teams/-components/):

- `OrgChartTab.tsx` — tab wrapper + queries
- `OrgChartCanvas.tsx` + `PersonFlowNode.tsx` + `org-chart-layout.ts` — visual tree rendering
- `AddPersonDialog.tsx` / `EditPersonDialog.tsx` — member CRUD dialogs
- `-services/org-team-services.ts` — API client

---

## 4. The "Leads Team" concept

A per-institute admin nominates **one team** as the **leads root** (`leads_team_id`). The CRM workbench universe is the entire subtree under it. Set via `PUT /v1/counsellor-workbench/config`, stored in `institute.setting` JSON under:

```
LEAD_SETTING.data.workbench.leads_team_id
```

`CounsellorScopeService` exposes:

| Method | What it does |
|---|---|
| `resolveHomeScope(institute, callerUserId)` | Finds caller's home team — the first of their team mappings that intersects the leads subtree. Throws if `leads_team_id` is unset or the caller isn't in any team under it. |
| `allTeamIdsUnderLeadsRoot(instituteId)` | Every team id in the leads subtree |
| `leadsRootSubtree(instituteId)` | Same as above, returned as a single subtree object |
| `usersInTeams(teamIds)` | All distinct user_ids in any of those teams |
| `descendantUserIdsForCaller(institute, caller)` | **The RBAC predicate**: caller + every user reachable via `parent_user_id` from the caller's mappings — but only mappings whose teamId is under leads root. A leaf counsellor → themselves only. A team head → whole downstream. |
| `isCallerInLeadsSubtree(institute, caller)` | Cheap "is this caller in the leads team at all?" predicate. |

> 🔒 A caller who is **also** in Finance does **not** see Finance reports' leads — `descendantUserIdsForCaller` filters mappings by teamId-under-leads-root before walking `parent_user_id`.

---

## 5. Counsellor Workbench

Endpoint base: `/admin-core-service/v1/counsellor-workbench`. Code at [`features/counsellor_workbench/`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/counsellor_workbench/).

### 5.1 Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/config?instituteId=` | Read `leads_team_id` + rating strategy (from `institute.setting` JSON) |
| PUT | `/config` | Set `leads_team_id`. ⚠️ **Currently does NOT persist rating-strategy fields** (see Known Issues). |
| GET | `/me/team?instituteId=` | Resolve caller's home team in the leads subtree → `WorkbenchTeamDTO` (team_id, name, leads_root_team_id, ancestor_names, descendant_team_ids) |
| GET | `/me/leads?instituteId&status&page&size` | Auth-scoped self leads — caller + descendants only |
| GET | `/team/{teamId}/counsellors?instituteId&search&status&page&size` | Roster of a team subtree intersected with caller's RBAC. One batched query for active-membership lookup. |
| GET | `/counsellors/{userId}/leads?instituteId&status&page&size` | Manager-drilldown — single-counsellor leads list (RBAC enforced by the upstream roster) |
| PATCH | `/counsellors/{userId}/status` | Direct ACTIVE/INACTIVE flip of all `counselor_pool_member` rows for this counsellor in the institute. When INACTIVE, returns hydrated `openLeads` (limit 200) for the reassign dialog. |
| POST | `/reassign/preview` | Dry-run of `CounsellorReassignService.planAndApply` |
| POST | `/reassign` | Atomic reassign (SINGLE / ROUND_ROBIN / MANUAL) + optional `mark_inactive` |
| GET | `/counsellors/{userId}/activity` | Activity feed (union of 3 sources, see §8) |
| GET | `/leads/{leadUserId}/transfers?instituteId` | Per-lead counsellor-assignment chain. Path var is **lead's user_id**, NOT `user_lead_profile.id`. |

### 5.2 Service layer

- [`CounsellorWorkbenchService`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/counsellor_workbench/service/CounsellorWorkbenchService.java) — top-level facade. Owns `hydrateLeadIdentities`, the cross-DB batched name/email/phone lookup applied to every list endpoint.
- [`CounsellorScopeService`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/counsellor_workbench/service/CounsellorScopeService.java) — RBAC + team-graph resolver (talks to auth-service via `OrganizationTeamAuthClient`).
- [`CounsellorReassignService`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/counsellor_workbench/service/CounsellorReassignService.java) — see §7.
- [`CounsellorActivityFeedService`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/counsellor_workbench/service/CounsellorActivityFeedService.java) — see §8.
- [`LeadWorkbenchSettingService`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/counsellor_workbench/service/LeadWorkbenchSettingService.java) — per-institute config (LEAD_SETTING.data.workbench) for `leads_team_id` + rating strategy. Per-counsellor scores live in the `counsellor_rating` table (V327).

### 5.3 Repositories (JdbcTemplate, raw SQL)

- [`WorkbenchLeadRepository`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/counsellor_workbench/repository/WorkbenchLeadRepository.java) — `findLeadsForCounsellors`, `findOpenLeadsForCounsellor`, `countOpenLeadsForCounsellor`, `currentAssigneeForLead`, `findTransfersForLead`. **No JOIN to `users`.**
- [`WorkbenchActivityRepository`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/counsellor_workbench/repository/WorkbenchActivityRepository.java) — `fetchFeed` UNION ALL.

### 5.4 Frontend

Route: `/counsellors` at [`src/routes/counsellors/`](../frontend-admin-dashboard/src/routes/counsellors/). The page is feature-gated via display-settings (sidebar > leads > subTabs > counsellors > visible).

Key files:

| File | Role |
|---|---|
| `index.lazy.tsx` | `WorkbenchPage`: state machine, queries, mutations, URL ↔ drawer sync, cards/list view toggle, reassign-first inactive flow |
| `$userId.lazy.tsx` | Same page with deep-link drawer open |
| `-components/CounsellorLeadsTab.tsx` | Drawer's Leads tab — paginated list with per-row Reassign + expandable `LeadTransferChain` |
| `-components/CounsellorActivityTab.tsx` | Drawer's Activity tab — 50-item feed with phosphor icons |
| `-components/LeadTransferChain.tsx` | Per-lead mini-timeline of assignments |
| `-components/ReassignDialog.tsx` | Three-mode reassign modal + `mark_inactive` support |
| `-components/FeatureDisabledNotice.tsx` | Lock card shown when display-settings gate is off |
| `-services/counsellor-workbench-services.ts` | Typed API client wrapping `authenticatedAxiosInstance` |

State machine (in `WorkbenchPage`):

- `searchInput` / `search` (debounced 300ms) / `statusFilter` (`all|active|inactive`) / `viewMode` (`cards|list`, persisted in `localStorage` key `counsellors-view-mode`) / `page` / `openCounsellor` (the WHOLE object, not just id — pagination would lose a `find`) / `detailTab` / reassign state.
- Pagination resets to 0 when search/status/view change.
- Two parallel counsellor queries: `['workbench-counsellors', ...]` is the **paginated display list**; `['workbench-counsellors-candidates', instituteId, team_id]` (size=500) is the **target dropdown source** for reassign. Both must be invalidated on any status mutation.

**Detail drawer** uses Radix [`Sheet`](../frontend-admin-dashboard/src/components/ui/sheet.tsx) (portaled). Do not hand-roll a `fixed inset-0` overlay — Sheet handles focus trap, Escape, overlay click, close X.

URL is the source of truth — `/counsellors/$userId` reopens the drawer. `openDrawer`/`closeDrawer` always go through `navigate()`.

---

## 6. Sales Dashboard

Endpoint base: `/admin-core-service/v1/sales-dashboard`. All endpoints are read-only aggregates running on `JdbcTemplate` raw SQL. Every endpoint takes `instituteId`; most take optional `teamId` (subtree narrowing) and `from`/`to` (epoch millis).

### 6.1 Endpoints

| Path | Widget | Notes |
|---|---|---|
| `/kpi` | KPI band — counts of leads / converted / lost / open per window | |
| `/conversion-funnel` | Funnel by `lead_status` order | Uses `display_order` and `is_active = true` (not the older bogus `sort_order` / `status='ACTIVE'` columns — see §11). |
| `/conversion-by-source` | Source-type breakdown of conversions | |
| `/calls-per-day` | `telephony_call_log` count per day | Scoped per caller / counsellor |
| `/reassignments` | Daily series of reassign events | Filters `action_type = 'COUNSELOR_ASSIGNED'` (the enum NAME) + `metadata_json::jsonb ->> 'reassigned_from' IS NOT NULL`. Now joins through `user_lead_profile` so `instituteId` actually scopes (previously leaked across institutes). |
| `/upcoming-followups` | Pending followups inside next N hours | Uses `lf.schedule_time BETWEEN NOW() AND NOW() + (? * INTERVAL '1 hour')`. Name + counsellor name hydrated via AuthService after SQL. |
| `/missed-followups` | OVERDUE or past-due PENDING | Same hydration. |
| `/new-vs-existing` | Dual series per day | Query 2 joins `te.type_id = ulp.user_id` (not `.id`) and filters `te.type = 'USER_LEAD_PROFILE'`. |
| `/campaign-cards` | Per-campaign leads + conversions in window | `period` param (DAY/WEEK/MONTH) — frontend currently hard-codes `WEEK` |
| `/counsellor-leaderboard` | Top counsellors by rating score | Delegates to `CounsellorRatingService.leaderboard` |
| `/insights` | Deterministic computed insights (NOT LLM) | WoW conversion-rate change, overdue followup spike |

### 6.2 Scoping helpers

In [`SalesDashboardService`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/sales_dashboard/service/SalesDashboardService.java):

- `scopedUsers(instituteId, teamId, callerUserId)` — priority order: explicit `teamId` → caller's RBAC descendants → leads-team subtree (admin setup mode → empty list → no scope filter).
- `userScopeClause(users, column)` — builds `AND <column> IN (?, ?, ?)` or `' '` when empty.
- `andDateRange(column, from, to)` — appends optional date predicates.
- `narrowToCounsellor(institute, caller, counsellorUserId)` — used by the per-counsellor drawer widgets (ConversionBySource, CallsPerDay) so a manager can drill into one person; RBAC-intersected.

### 6.3 Cross-DB hydration

The two followup queries used to `JOIN users u` and inline `(SELECT full_name FROM users WHERE id = lf.created_by)`. Both have been replaced — the SQL now projects raw user_ids and `hydrateFollowupNames` does the batch HTTP lookup (lead + counsellor in one auth-service call). Auth-service failure is logged at warn level; names come back null rather than 500-ing the widget.

### 6.4 Frontend

Route: `/sales-dashboard` at [`src/routes/sales-dashboard/`](../frontend-admin-dashboard/src/routes/sales-dashboard/). Display-settings gate: sidebar > leads > subTabs > sales-dashboard > visible.

Layout (top-down):
1. Header — title + preset pill-group `7d` / `30d` / `90d` / `Custom`. `Custom` reveals two `<input type="date">` (start/end) with `min={customStart}` on end; falls back to 30d while both aren't valid (so partial entry doesn't blank widgets).
2. `KpiBand`
3. `ConversionFunnelWidget` + `CounsellorLeaderboardWidget`
4. `UpcomingFollowupsWidget` + `MissedFollowupsWidget`
5. `NewVsExistingLeadsWidget` + `ReassignmentVolumeWidget`
6. `ConversionBySourceWidget` + `CallsPerDayWidget`
7. `CampaignCardsRow` + `InsightsStrip`

Charts: funnel uses `recharts` `FunnelChart`. Time-series widgets use a hand-rolled SVG with `niceTicks()` rounding. Calls-per-day uses raw `<div>` bars.

`teamId` is hard-coded to `undefined` (team picker is a follow-up).

---

## 7. Reassign Engine

[`CounsellorReassignService.planAndApply(req, actor, dryRun)`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/counsellor_workbench/service/CounsellorReassignService.java).

### 7.1 Three modes

| Mode | Inputs | Behaviour |
|---|---|---|
| **SINGLE** | `target_user_id` (required) | Every open lead from `fromUserId` moves to `target_user_id`. Errors if target == from. |
| **ROUND_ROBIN** | — | Candidates = `usersInTeams(allTeamIdsUnderLeadsRoot)` minus `fromUserId`, sorted by user_id, distributed `idx % candidates.size`. No weighting by rating or current load. |
| **MANUAL** | `assignments: [{lead_id, to_user_id}]` | Every selected lead must have an explicit target; missing target throws. Every target must be in the leads subtree. |

### 7.2 Key request fields

- `lead_ids` — optional whitelist scoping the operation to specific `user_lead_profile.id` rows. **Per-row Reassign buttons must always pass this**, or a single click would sweep the source's whole pipeline.
- `mark_inactive: true` — runs `flipPoolMembersInactive(institute, fromUserId)` AFTER the routing loop, in the same `@Transactional`. The "reassign-first" flow.

### 7.3 Atomicity

The entire `planAndApply` runs under one `@Transactional`. If a single lead's `assignCounselor` throws, the whole batch (plus the optional inactive flip) rolls back. Each successful per-lead step:

1. `UserLeadProfileService.assignCounselor(...)` — the canonical setter.
2. `TimelineEventService.logJourneyEvent(COUNSELOR_ASSIGNED, ...)` with metadata:
   ```json
   {
     "counselor_id": "<new>",
     "counselor_name": "<new name or empty>",
     "reassigned_from": "<old user_id>",
     "trigger": "WORKBENCH_REASSIGN",
     "mode": "SINGLE|ROUND_ROBIN|MANUAL",
     "assigned_by": "<actor name or empty>"
   }
   ```

### 7.4 Edge case: zero open leads + `mark_inactive`

`planAndApply` early-returns with `totalLeads = 0` but still calls `flipPoolMembersInactive`. Response: `{ total_leads: 0, marked_inactive: true }`. This is intentional so the "Mark inactive" button works even when the counsellor has nothing pending.

### 7.5 Frontend flow ([`ReassignDialog.tsx`](../frontend-admin-dashboard/src/routes/counsellors/-components/ReassignDialog.tsx))

- "Mark inactive" button → `startMarkInactive(userId)` pre-fetches `fetchCounsellorLeads(institute, user, 'OPEN', 0, 500)` then opens the dialog with `markInactive=true`. Counsellor stays ACTIVE until Confirm fires.
- "Mark active" → direct `setCounsellorStatus` mutation. Invalidates **both** `['workbench-counsellors', instituteId]` AND `['workbench-counsellors-candidates', instituteId]`.
- `markInactive && openLeads.length === 0` → dialog hides the mode picker, sends a no-op SINGLE with no target + `mark_inactive: true`. Server short-circuits to the inactive flip.
- MANUAL mode auto-fires `/reassign/preview` seeded with ROUND_ROBIN, renders an inline-override table.

---

## 8. Activity Feed

[`CounsellorActivityFeedService.fetchFeed`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/counsellor_workbench/service/CounsellorActivityFeedService.java) returns a UNION ALL of three sources, ordered by `created_at DESC` with `LIMIT ?`:

| Source table | Filter | Mapped to |
|---|---|---|
| `telephony_call_log` | `counsellor_user_id = ?` AND `institute_id = ?` AND time window | `action_type='CALL'`, metadata `{status, duration_seconds, recording_url, direction}` |
| `lead_followup` | `created_by = ?` OR `closed_by = ?` (joined to `audience_response` → `user_lead_profile`) | `FOLLOWUP_CREATED` / `FOLLOWUP_CLOSED` based on `is_closed`. `created_at = COALESCE(closed_at, created_at)` |
| `timeline_event` | `actor_id = ?` AND time window | Normalized: `COUNSELOR_ASSIGNED` + metadata `reassigned_from = me` → `LEAD_TRANSFERRED_OUT`; `counselor_id = me` → `LEAD_TRANSFERRED_IN`; ILIKE `%status%` → `STATUS_CHANGED`; ILIKE `%note%` → `NOTE_ADDED`; else upper(replace(' ', '_')) |

Defaults: from = now − 30d, to = now + 60s, limit clamped to [1, 200].

Lead resolution: each row carries a `lead_id` / `lead_name` resolved via lookups into `user_lead_profile` + `audience_response` → user_id.

---

## 9. Counsellor Ratings

Endpoint base: `/admin-core-service/v1/counsellor-rating`. Code at [`features/counsellor_rating/`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/counsellor_rating/).

### 9.1 Strategy types

| Type | Behaviour |
|---|---|
| `STATIC` | `score = manual_override`. Component fields (`conversion_ratio_score`, `velocity_score`) are NULL. |
| `STRATEGY_BASED` | Computed from data — see algorithm below. |

### 9.2 Strategy config (in `institute.setting` JSON)

```
LEAD_SETTING.data.workbench.{
  strategy_type:        "STATIC" | "STRATEGY_BASED"
  starting_rating:      number   // base score, added on top
  window_days:          number   // default 90
  success_status_keys:  string[] // default ["CONVERTED"]
  w_conversion:         number   // default 0.6
  w_velocity:           number   // default 0.4
  ideal_velocity_hours: number   // default 24
  worst_velocity_hours: number   // default 720 (30d)
  min_sample_size:      number   // default 5
}
```

> ⚠️ **PUT `/v1/counsellor-workbench/config` only persists `leads_team_id`** — every other field above is silently ignored by `setLeadsTeam`. See §11.

### 9.3 Score formula

For each counsellor `c` in window:

```
assigned         = COUNT(user_lead_profile WHERE assigned_counselor_id=c
                         AND assigned_at >= NOW() - INTERVAL window_days)
converted        = subset where conversion_status IN success_status_keys
if assigned < min_sample_size → score = starting_rating, skip
conversion_ratio = converted / assigned                  ∈ [0,1]
conversion_score = conversion_ratio * 100                ∈ [0,100]

avg_hours        = MEAN of (converted_at − assigned_at)  per converted lead
velocity_score   = clamp(0..100, 100 *
                    (worst_velocity_hours − avg_hours) /
                    (worst_velocity_hours − ideal_velocity_hours))

score = clamp(0..100, starting_rating + w_conversion*conversion_score
                                       + w_velocity*velocity_score)
```

**`assigned_at` is derived, not a column.** Computed via LATERAL: `MAX(timeline_event.created_at) WHERE type='USER_LEAD_PROFILE' AND type_id = ulp.user_id AND action_type = 'COUNSELOR_ASSIGNED'`. See §11 for a current bug here.

### 9.4 Recompute

- **Nightly** via Spring `@Scheduled` (`CounsellorRatingScheduler`).
- **Synchronous trigger** after any lead transition to a success status (debounced 5 min via Caffeine).
- **Admin force-refresh** via `POST /v1/counsellor-rating/recompute`.

### 9.5 Storage (V327, 2026-06-10)

Per-counsellor scores moved out of LEAD_SETTING JSON (which raced on concurrent recomputes and lost `manual_override` edits) into the `counsellor_rating` table.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `counsellor_user_id` | TEXT | |
| `institute_id` | TEXT | |
| `strategy_type` | VARCHAR(20) NOT NULL | Snapshot of strategy at last compute |
| `score` | NUMERIC(5,2) | 0..100 |
| `conversion_ratio_score` | NUMERIC(5,2) | NULL for STATIC |
| `velocity_score` | NUMERIC(5,2) | NULL for STATIC |
| `sample_size` | INTEGER | Assigned leads in window |
| `last_computed_at` | TIMESTAMP | |
| `manual_override` | NUMERIC(5,2) | STATIC value |
| UNIQUE | `(counsellor_user_id, institute_id)` | |

No backfill — rows populate from first post-deploy recompute.

### 9.6 Frontend

- [`<CounsellorRatingBadge instituteId userId size="sm|md|lg">`](../frontend-admin-dashboard/src/components/counsellor/CounsellorRatingBadge.tsx) — color-coded numeric badge.
- [`useCounsellorRating(userId)` / `useCounsellorRatingBatch(instituteId, userIds[])`](../frontend-admin-dashboard/src/components/counsellor/useCounsellorRating.ts) — TanStack Query hooks. Page-level batch warms the cache so per-row badges don't N+1.
- Settings page: [`CounsellorRatingSettings.tsx`](../frontend-admin-dashboard/src/routes/settings/-components/CounsellorRatingSettings.tsx) — strategy picker + weight inputs.

---

## 10. Data storage map — what is saved where

> **Bold** entries are the load-bearing fields you'll touch most.

### 10.1 Tables owned by **admin_core_service**

#### `audience_response` (migrations V32, V85, V99, V103, V104, V260, V261, V267 …)

The "lead" row — one per form submission / webhook.

| Column | What it holds | Written by | Read by |
|---|---|---|---|
| `id` (PK, VARCHAR(50)) | Response id | Submit/webhook handlers in `AudienceService` | Everywhere |
| `audience_id` | FK → `audience.id` (campaign) | Submit | Lead list, campaign cards |
| **`user_id`** | FK → `users.id` in auth_service (no real FK constraint) | Set when the lead is linked to a User row | Everything — this is the join key |
| `source_type` | `WEBSITE` / `META` / `GOOGLE` / `ORGANIC` / `OPT_OUT` / … | Submit | Source-conversion widget |
| `source_id` | Source-specific id (landing page, ad campaign, etc.) | Submit | |
| `submitted_at` | When form was submitted | Submit | TAT computation |
| `created_at` | Row insert time | Submit | Date windowing |
| `lead_status_id` | FK → `lead_status.id` | `LeadStatusService.changeStatus` | Workbench/funnel — current pipeline stage |
| `conversion_status` | `LEAD` / `CONVERTED` / `LOST` (NULLABLE) | Status flips | Funnel KPIs |
| `overall_status` | Coarse status (V104) | Status flips | |
| `parent_name` / `parent_email` / `parent_mobile` | Guardian info captured at submit (V85) | Submit | Lead detail |
| `enquiry_id` | FK to enquiry row (admissions integration) | Submit / merge | |
| `tat_due_at` / `tat_reminder_stage` | TAT scheduler bookkeeping (V260) | TAT scheduler | TAT alerts |
| `initial_score` (V267) | Snapshot of lead's starting score | Submit | Score history |

> ⚠️ Lead identity (name / email / mobile) is **NOT** on `audience_response`. Only `parent_*` (guardian) is. The lead's own name lives on `users.full_name` in **auth_service** and is fetched via AuthService HTTP.

#### `user_lead_profile` (V195, V200, V272)

One row per (`user_id`, `institute_id`) — the aggregate "where is this lead now".

| Column | What it holds | Written by | Read by |
|---|---|---|---|
| `id` (PK) | Profile id | `UserLeadProfileService.buildOrUpdateProfile` | Internal — most consumers join on `user_id` |
| **`user_id`** | FK → auth-service `users.id`; UNIQUE | Submit/score | Everything |
| `institute_id` | | | |
| **`conversion_status`** | NOT NULL DEFAULT `'LEAD'`. Canonical "open" = `IS NULL OR != 'CONVERTED'` | `markConverted` / `updateConversionStatus` | Workbench + reassign filter |
| `lead_tier` | `HOT` / `WARM` / `COLD` derived from `best_score` | `buildOrUpdateProfile` | Lead list |
| `best_score` / `best_score_response_id` | Highest score across all submissions | `buildOrUpdateProfile` | Lead list |
| `best_source_type` | Source of the best-scoring response | | |
| **`assigned_counselor_id`** | Current owner. Updated by manual assign + pool auto-assign + reassign | `UserLeadProfileService.assignCounselor` | Workbench, sales-dashboard, ratings |
| `assigned_counselor_name` | Snapshot of full_name at assignment | Same | |
| `last_activity_at` | Updated on any timeline / score event | `buildOrUpdateProfile` | Lead list staleness |
| `first_response_at` (V272) | ⚠️ **Dormant** — V272 backfilled it but **no runtime code stamps it**. See §11. | Migration backfill only | Nothing currently |
| `created_at` / `updated_at` | | | |
| `total_timeline_events` / `demo_login_count` / `demo_attendance_count` / `campaign_count` | Activity rollups | `buildOrUpdateProfile` | Reports |

> 🚫 There is **NO** `assigned_at` column. It's derived everywhere via `MAX(timeline_event.created_at) WHERE type='USER_LEAD_PROFILE' AND type_id = ulp.user_id AND action_type = 'COUNSELOR_ASSIGNED'`.

#### `lead_status` (V261, V263, V264)

Per-institute display catalog of pipeline stages.

| Column | What |
|---|---|
| `id` | PK |
| `institute_id` | |
| `status_key` | Stable code (`NEW`, `INTERESTED`, …). UNIQUE per institute |
| `label` | Display name |
| `color` | Hex chip color |
| `display_order` | **NOT `sort_order`** — naming gotcha |
| `is_default` | Status applied to brand-new leads |
| `is_active` | **NOT a `status` column** — boolean soft-delete flag |
| `is_system` (V263) | System-seeded (New/Converted/Lost) — can be renamed/recoloured but not deleted |

#### `lead_status_history`

Audit row per `lead_status` transition; drives the funnel "time in stage" reporting.

#### `lead_followup` (V273)

| Column | What |
|---|---|
| `id` (VARCHAR(255) PK) | |
| `audience_response_id` | FK → `audience_response.id` |
| `institute_id` | |
| **`created_by`** | Counsellor who scheduled (auth-service user_id) |
| `schedule_time` | When the follow-up is due |
| **`status`** | `PENDING` / `ONGOING` / `OVERDUE` / `COMPLETED` |
| **`is_closed`** | Boolean — closed or open |
| `content` | Body text |
| `closer_reason` | Why it was closed |
| `closed_by` | Auth-service user_id |
| `closed_at` | |
| `created_at` / `updated_at` | |

Used by activity feed, sales-dashboard followups widgets, and TAT/SLA reminders.

#### `timeline_event` (V127, V269)

General-purpose audit log across all entity types.

| Column | What |
|---|---|
| `id` (VARCHAR(36) PK) | |
| **`type`** | Entity type: `USER_LEAD_PROFILE`, `ENQUIRY`, `STUDENT`, `APPLICANT`, … |
| **`type_id`** | Entity id. **For `USER_LEAD_PROFILE` this is `user_lead_profile.user_id`**, NOT `.id`. |
| **`action_type`** | Enum NAME via `actionType.name()`. For counsellor assignments: `'COUNSELOR_ASSIGNED'` — not the human title. |
| `actor_type` | `ADMIN` / `SYSTEM` / `PARENT` / `STUDENT` |
| `actor_id` | Who took the action (NULL for system) |
| `actor_name` | Snapshot of name |
| `title` | Human-readable title ("Counselor assigned" / "Counselor reassigned") |
| `description` | Free-text detail |
| `metadata_json` | JSONB. For COUNSELOR_ASSIGNED: `{counselor_id, counselor_name, reassigned_from, trigger, mode, assigned_by}` |
| `category` (V269) | `JOURNEY` (system events) vs `ACTIVITY` (manual notes/calls) |
| `created_at` | |

> 🔑 **Most-missed invariant:** `type_id` for a `USER_LEAD_PROFILE` event is the lead's user_id. Joining `te.type_id = ulp.id` always returns nothing.

#### `counselor_pool*` (V265, V270)

| Table | Purpose |
|---|---|
| `counselor_pool` | Per-institute pool with assignment_mode (`MANUAL` / `ROUND_ROBIN` / `TIME_BASED`) + `schedule_pattern` (`PER_DAY` / `SAME_HOURS_ALL_DAYS`, V270) |
| `counselor_pool_audience` | Pool → audience join + `display_order` + `last_assigned_at` (rotation cursor) |
| **`counselor_pool_member`** | Per (pool, audience, counsellor) cell. Columns: `pool_id`, `audience_id`, `counselor_user_id`, **`status`** (`ACTIVE`/`INACTIVE`), `display_order`, `monthly_target`, `backup_counselor_user_id`. The workbench "Mark inactive" flips `status` on ALL rows for `(institute, counsellor)`. |
| `counselor_pool_shift` / `counselor_pool_shift_member` | Time-based shift schedule |

#### `counsellor_rating` (V327)

Already covered in §9.5.

#### `institute.setting` (JSON column on `institute`)

A nested JSON blob keyed under `LEAD_SETTING.data.workbench`:

```jsonc
{
  "leads_team_id": "<organization_team.id>",        // §4
  "strategy_type": "STRATEGY_BASED",                 // §9.2
  "starting_rating": 0,
  "window_days": 90,
  "success_status_keys": ["CONVERTED"],
  "w_conversion": 0.6,
  "w_velocity": 0.4,
  "ideal_velocity_hours": 24,
  "worst_velocity_hours": 720,
  "min_sample_size": 5
}
```

Plus other sibling sub-trees (`LEAD_SETTING.data.tat`, `LEAD_SETTING.data.scoring`, etc.) owned by other features.

#### `telephony_call_log`

Owned by the telephony feature, used here as an activity-feed source. Key columns: `counsellor_user_id`, `user_id`, `institute_id`, `status`, `duration_seconds`, `recording_url`, `direction`, `start_time`, `created_at`.

### 10.2 Tables owned by **auth_service**

| Table | Holds | Accessed by admin-core via |
|---|---|---|
| `users` | id, email, **full_name**, **mobile_number**, address, dob, profile_pic_file_id, is_root_user, last_token_update_time | `AuthService.getUsersFromAuthServiceByUserIds(ids)` HTTP batch |
| `organization_team` | Per-institute team tree (see §3.1) | `OrganizationTeamAuthClient` |
| `organization_team_member` | User → team mappings with `role_label`, `parent_user_id` chain (see §3.1) | `OrganizationTeamAuthClient` |

### 10.3 What lives where — quick reference

```
Lead identity (name / email / phone)          → users (auth-service)
Team graph + reporting chain                   → organization_team / _member (auth-service)
Lead pipeline row                              → audience_response (admin-core)
Lead aggregate / current state                 → user_lead_profile (admin-core)
Status catalog                                 → lead_status (admin-core)
Status changes audit                           → lead_status_history (admin-core)
Counsellor pool membership + ACTIVE flag       → counselor_pool_member (admin-core)
Counsellor rating score                        → counsellor_rating (admin-core)
Rating strategy CONFIG                         → institute.setting JSON (admin-core)
Counsellor assignment events                   → timeline_event (admin-core)
Reassign metadata (mode / trigger / actor)     → timeline_event.metadata_json (admin-core)
Call records                                   → telephony_call_log (admin-core)
Follow-ups                                     → lead_followup (admin-core)
Reassign-on-inactive bookkeeping (which pools) → counselor_pool_member.status (admin-core)
"assigned_at" timestamp                        → DERIVED on read from timeline_event
```

---

## 11. Known issues / hard-won lessons

Things that have bitten the team — keep these front of mind when working in this code.

### 11.1 Cross-DB constraint (the big one)

`admin_core_service` SQL **cannot** join `users`. Stripped from every workbench + sales-dashboard query; identity is hydrated via `authService.getUsersFromAuthServiceByUserIds` at the service layer. Pattern lives at [`CounsellorWorkbenchService.hydrateLeadIdentities`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/counsellor_workbench/service/CounsellorWorkbenchService.java) and [`SalesDashboardService.hydrateFollowupNames`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/sales_dashboard/service/SalesDashboardService.java).

### 11.2 `timeline_event` invariants

- `action_type` is the enum **NAME** (`COUNSELOR_ASSIGNED`), not the human title. `TimelineEventService.logJourneyEvent` calls `actionType.name()`. Filtering by the title (`'Counselor reassigned'`) silently matches nothing.
- `type_id` for `USER_LEAD_PROFILE` events is `user_lead_profile.user_id`. Joining on `ulp.id` matches nothing.

### 11.3 Canonical "open lead" predicate

`conversion_status IS NULL OR conversion_status != 'CONVERTED'`. The old `= 'LEAD'` filter silently zeroed open-lead counts and skipped reassign dialogs.

### 11.4 `lead_status` column naming

It's `display_order` + `is_active` (boolean). Not `sort_order` or `status = 'ACTIVE'`. Don't trust grep-of-other-tables.

### 11.5 Sales-dashboard SQL fixes (recent)

| Endpoint | Was broken because | Fix |
|---|---|---|
| `/conversion-funnel` | Used `sort_order` + `status='ACTIVE'` on `lead_status` (don't exist) | → `display_order` + `is_active = true` |
| `/upcoming-followups` | `(? || ' hours')::interval` — Postgres `||` needs text on both sides; JDBC binds int4 | → `? * INTERVAL '1 hour'` (native int×interval) |
| `/new-vs-existing` Q1 | Arg order swapped — dates bound to IN-list slots | → `[instituteId, from, to, ...users]` |
| `/new-vs-existing` Q2 | `JOIN te.type_id = ulp.id` matched nothing | → `ulp.user_id` + `te.type = 'USER_LEAD_PROFILE'` filter |
| `/reassignments` | Filtered by title `'Counselor reassigned'`; `instituteId` param unused → cross-tenant leak | → `action_type = 'COUNSELOR_ASSIGNED'` + `JOIN user_lead_profile` for institute scope |

### 11.6 ⚠️ Open bugs caught during this doc pass

These are real and should be tracked:

1. **`CounsellorRatingComputeService.ASSIGNED_AT_LATERAL`** still uses title-cased `te.action_type IN ('Counselor assigned','Counselor reassigned')` — the same anti-pattern fixed everywhere else. **Ratings velocity score is currently always `worst` because `assigned_at` resolves to NULL → `(converted_at − NULL) = NULL` → `avg_hours = NULL`.** Owner: ratings team. Replace with `te.action_type = 'COUNSELOR_ASSIGNED'`.
2. **`WorkbenchActivityRepository.fetchFeed`** `CASE WHEN action_type LIKE 'Counselor%'` will never match — stored value is `COUNSELOR_ASSIGNED`. Activity feed currently maps every assign event to the upper-cased catch-all instead of `LEAD_TRANSFERRED_OUT/IN`.
3. **`PUT /v1/counsellor-workbench/config`** only writes `leads_team_id`. Every rating-strategy field in the request body is silently dropped. `LeadWorkbenchSettingService.upsertRatingStrategy` exists but isn't wired to any controller endpoint. Frontend rating settings page can't actually save changes via this path.
4. **`user_lead_profile.first_response_at`** was added in V272 and backfilled. **No runtime code stamps it.** Three writers in `UserLeadProfileService` explicitly comment "first_response_at is NOT stamped here". TAT is computed on-the-fly from `timeline_event` (`AudienceService` / `AudienceResponseRepository`), so the column is dormant — safe to read as null, don't trust it.
5. **`ROUND_ROBIN` candidates are sorted purely by user_id alphabetically.** No rating-weighting, no current-load balancing. Heavy use imbalances.

### 11.7 Performance footguns

- `listCounsellorsForTeam` calls `orgTeamClient.mappingsForUser` once per user in the visible page slice — N+1 HTTP against auth-service. Bounded by `size`, but large pages hurt.
- Reassign-first pre-fetch and the reassign-target candidate query both hard-cap at `size=500`. A counsellor sitting on >500 open leads gets a partial sweep.
- `auth_service` failure during hydration is caught and logged, not propagated — name fields come back null. The workbench survives but UI shows user_ids. Watch the warn logs.

### 11.8 Local dev URLs

- `admin-core-service` runs on **port 8072 locally** (not 8071 — that's auth-service).
- The frontend resolves backend URL via [`baseUrl.ts`](../frontend-admin-dashboard/src/config/baseUrl.ts). On localhost it defaults to **`https://backend-stage.vacademy.io`** — so the frontend hits **stage**, not your local server. To test local admin-core changes flip the relevant URL constants in [`src/constants/urls.ts`](../frontend-admin-dashboard/src/constants/urls.ts) to `LOCAL_ADMIN_CORE_BASE`, or set `VITE_BACKEND_URL=http://localhost:8072`.

---

## 12. Migration index (relevant to this cluster)

| Version | File | Purpose |
|---|---|---|
| V31 | `V31__Create_audience_table.sql` | `audience` (campaign rows) |
| V32 | `V32__Create_audience_response_table.sql` | `audience_response` (lead submissions) |
| V85 | `V85__Add_session_id_to_audience_and_fields_to_response.sql` | `parent_name`/`parent_email`/`parent_mobile` on `audience_response` |
| V99 | `V99__Add_student_user_id_to_audience_response.sql` | Disambiguate parent-with-multiple-kids |
| V103 | `V103__Add_workflow_activate_day_to_audience_response.sql` | Workflow activation timestamp |
| V104 | `V104__Add_status_columns_to_audience_response.sql` | `conversion_status` + `overall_status` |
| V127 | `V127__Create_timeline_event_table.sql` | Generic audit timeline |
| V191 | `V191__Lead_distribution_and_scoring.sql` | Lead scoring tables |
| V195 | `V195__Create_user_lead_profile.sql` | Lead aggregate |
| V200 | `V200__Add_counselor_to_user_lead_profile.sql` | `assigned_counselor_id` + `assigned_counselor_name` |
| V260 | `V260__Add_tat_reminder_dedup_to_audience_response.sql` | TAT reminder dedup state |
| V261 | `V261__Create_lead_status_tables.sql` | `lead_status` + `lead_status_history` + `audience_response.lead_status_id` |
| V262 | `V262__Create_lead_sla_config_tables.sql` | TAT/SLA config tables |
| V263 | `V263__Add_is_system_to_lead_status.sql` | System-status flag |
| V264 | `V264__Seed_default_lead_statuses_for_all_institutes.sql` | Backfill defaults |
| V265 | `V265__Counselor_pool_and_assignment.sql` | 5 counselor-pool tables |
| V266 | `V266__Add_default_initial_score_to_lead_config_and_audience.sql` | Per-campaign starting score |
| V267 | `V267__Add_initial_score_to_audience_response.sql` | Snapshot of starting score |
| V269 | `V269__Add_category_to_timeline_event.sql` | `JOURNEY` vs `ACTIVITY` |
| V270 | `V270__Add_schedule_pattern_to_counselor_pool.sql` | `PER_DAY` vs `SAME_HOURS_ALL_DAYS` |
| V272 | `V272__Add_first_response_at_to_user_lead_profile.sql` | ⚠️ dormant column (§11.6 #4) |
| V273 | `V273__Create_lead_followup_table.sql` | `lead_followup` |
| V327 | `V327__Create_counsellor_rating_table.sql` | Per-counsellor scores (2026-06-10) |

---

## 13. Glossary

| Term | Meaning |
|---|---|
| **Lead** | An `audience_response` row. Identity (name/email/phone) lives in `users` in auth-service. |
| **Lead user_id** | `audience_response.user_id` / `user_lead_profile.user_id`. The join key everywhere. |
| **Lead profile** | A `user_lead_profile` row — aggregate state per (user_id, institute). |
| **Lead id** | `user_lead_profile.id` — internal PK; rarely used as a key from outside. |
| **Lead status** | One of `lead_status.status_key` (`NEW`, `INTERESTED`, custom…). Stored on `audience_response.lead_status_id`. |
| **Conversion status** | `LEAD` / `CONVERTED` / `LOST` on `user_lead_profile.conversion_status`. Different from lead status. |
| **Open lead** | `conversion_status IS NULL OR != 'CONVERTED'`. Canonical predicate. |
| **Leads team** | The organization_team designated as the workbench root (`leads_team_id` in LEAD_SETTING JSON). |
| **Home team** | A caller's first team mapping that sits inside the leads subtree. |
| **Descendants** | Users reachable via `parent_user_id` chain from a caller's team mappings, restricted to mappings under leads root. |
| **assigned_at** | DERIVED `MAX(timeline_event.created_at)` for `COUNSELOR_ASSIGNED` events on this lead. There is no column. |
| **mark_inactive** | Reassign-first flow: route leads first then flip counsellor's `counselor_pool_member.status` to INACTIVE, in one transaction. |
| **Workbench config** | `institute.setting.LEAD_SETTING.data.workbench` JSON — `leads_team_id` + rating strategy. |
| **Strategy CONFIG vs counsellor SCORE** | Config (weights, window) stays in JSON. Scores moved to `counsellor_rating` table in V327. |

---

*Questions / corrections — drop a Slack note in #vacademy-backend or edit this file in a PR. Keep it current; this is the single source of truth for new joiners on the CRM cluster.*

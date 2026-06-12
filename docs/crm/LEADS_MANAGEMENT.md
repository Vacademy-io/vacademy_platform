# Leads Management — Lead Lifecycle, Scoring, Statuses, TAT/SLA & Follow-ups

Onboarding doc for the lead-management core of the CRM: how a lead is born (forms, webhooks, ad platforms, walk-ins, bulk import), how it is scored and tiered, how its pipeline status moves, how TAT/SLA reminders fire, and how counsellor follow-ups work. Backend lives in `admin_core_service` under [`features/audience/`](../../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/audience/).

> Last reviewed: 2026-06-10. Reflects code currently on `main`.
>
> Sibling docs: [Campaigns & Audience Manager](CAMPAIGNS_AND_AUDIENCE_MANAGER.md) (the funnel above leads), [Lead Assignment & Counselor Pools](LEAD_ASSIGNMENT_AND_COUNSELOR_POOLS.md) (who gets the lead), [Recent Leads & Follow-ups UI](RECENT_LEADS_AND_FOLLOWUPS.md) (the frontend), [Leads Settings](LEADS_SETTINGS.md) (configuration), [Workbench & Sales Dashboard](CRM_WORKBENCH_AND_SALES_DASHBOARD.md) (manager surfaces).

---

## 1. The shape of a lead

A "lead" is spread across several tables that answer different questions:

```
audience_response       → "a person submitted this form on this campaign"   (one per submission)
lead_score              → "how good is this submission"                     (1-1 with response)
lead_status / _history  → "where in the pipeline is this submission"        (catalog + audit)
lead_followup           → "when will a counsellor call them back"           (N per response)
user_lead_profile       → "across ALL campaigns, where does this PERSON stand" (one per user+institute)
timeline_event          → "everything that ever happened to them"           (audit log)
users (auth_service)    → name / email / phone                              (cross-DB — HTTP only)
```

Key invariants (same as the workbench doc, repeated because everyone trips on them):

- **Lead identity (name/email/phone) is NOT in admin-core's DB.** Only `parent_name`/`parent_email`/`parent_mobile` (the raw form values) are. The linked `users` row lives in auth_service — hydrate via `AuthService.getUsersFromAuthServiceByUserIds`.
- `timeline_event.type_id` for `USER_LEAD_PROFILE` events is the lead's **user_id**, not the profile PK.
- Canonical "open lead": `conversion_status IS NULL OR conversion_status != 'CONVERTED'`.

---

## 2. Lead intake — every way a lead is created

All paths converge on creating an `audience_response`, scoring it, optionally auto-assigning a counsellor, and emitting a `LEAD_SUBMITTED` workflow trigger.

| # | Path | Entry point | source_type |
|---|------|------------|-------------|
| 1 | Public website form | `POST /open/v1/audience/lead/submit` (+ `/v2` where the workflow engine sends the email instead of inline code) | `WEBSITE` |
| 2 | Form + enquiry (admissions) | `POST /open/v1/audience/lead/submit-with-enquiry` — creates parent + child users and an `enquiry` row in one call | `WEBSITE` |
| 3 | Third-party form webhook | `POST /api/v1/audience/webhook/form` with `X-Vendor-ID` header → vendor strategy (`ZohoFormWebhookStrategy`, `GoogleFormWebhookStrategy`, `MicrosoftFormWebhookStrategy`, generic) | `ZOHO_FORMS` / `GOOGLE_FORMS` / `MICROSOFT_FORMS` |
| 4 | Meta Lead Ads | `POST /api/v1/webhook/meta` (HMAC `X-Hub-Signature-256` verified; lead detail fetched from Graph API) | `FACEBOOK_ADS` / `INSTAGRAM_ADS` |
| 5 | Google Lead Form Extensions | `POST /api/v1/webhook/google/{googleKey}` (no OAuth; full lead in one POST) | `GOOGLE_ADS` |
| 6 | Walk-in | `POST /v1/audience/walk-in/submit` — **auto-assigns the submitting user as counsellor** | `WALK_IN` |
| 7 | Bulk import (CSV) | `POST /open/v1/audience/lead/bulk-submit` and `/bulk-submit-with-enquiry` — per-row success/error report | per request |
| 8 | Manual admin add | Bulk-import dialog on the campaign card (single row) | `MANUAL` |

All `/open/**` and `/api/v1/webhook/**` paths are allowlisted in `ApplicationSecurityConfig` (no JWT). Webhook configuration (Meta OAuth, connector setup, field mapping) is covered in [CAMPAIGNS_AND_AUDIENCE_MANAGER.md §6](CAMPAIGNS_AND_AUDIENCE_MANAGER.md).

### 2.1 The canonical submit flow ([`AudienceService.submitLead`](../../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/audience/service/AudienceService.java))

1. Validate the audience (campaign) is ACTIVE.
2. Create/fetch the user in auth_service (`createUserFromAuthService`).
3. Duplicate guard: same `audience_id` + same `user_id` → reject (already submitted).
4. Insert `audience_response` — stamps `initial_score` from `audience.default_initial_score`, `workflow_activate_day_at`, default `lead_status_id`.
5. Save custom-field values.
6. Score it (`LeadScoringService.calculateAndSaveScore`) — also triggers `UserLeadProfileService.buildOrUpdateProfile`.
7. Counsellor assignment: explicit `counsellorId` in the request wins; else pool auto-assign (`CounselorAssignmentService.assignCounselorForLead`); else stays unassigned. See the [assignment doc](LEAD_ASSIGNMENT_AND_COUNSELOR_POOLS.md).
8. Emit `LEAD_SUBMITTED` workflow trigger (confirmation email etc. handled by workflow engine).

### 2.2 Dedup ([`LeadDeduplicationService`](../../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/audience/service/LeadDeduplicationService.java))

Within-campaign dedup on contact info, used by the enquiry flow:

```
dedupe_key = SHA256( LOWER(email) + "|" + digits-only(phone) ).substring(0, 32)
```

Stored on `audience_response.dedupe_key`, scoped per `audience_id`. A duplicate is **still saved** but flagged: `is_duplicate = true`, `primary_response_id` → the original, and a `DUPLICATE_MERGED` timeline event is written. Both rows keep their own call logs / followups.

---

## 3. Lead scoring

[`LeadScoringService`](../../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/audience/service/LeadScoringService.java) computes a 0–100 score per response, stored in `lead_score`.

### 3.1 Formula

| Factor | Default weight | How it's computed |
|---|---|---|
| Source quality | 25 | Lookup by `source_type`: GOOGLE_ADS=90, LINKEDIN_ADS=85, WALK_IN=85, FACEBOOK_ADS=80, INSTAGRAM_ADS=75, WEBSITE=70, MANUAL=40 |
| Profile completeness | 30 | Filled fields ÷ expected fields (enquiry + custom fields), scaled 0–100 |
| Recency | 25 | Linear decay from 100 (today) to 0 over the configured decay window (default 30 days) |
| Engagement | 20 | Timeline-event count (notes/calls/logins), capped at 100 |

Weights and the recency decay window are per-institute config (`LEAD_SETTING.data.scoringWeights` + `recencyDecayDays`, edited in Settings → Lead Settings → Config), read through [`LeadScoringSettingService`](../../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/audience/service/LeadScoringSettingService.java) with a 5-minute cache. Invalid configs (negative weight, sum ≠ 100, decay outside 1–365) fall back to the defaults above.

```
baseScore = (src×25 + comp×30 + rec×25 + eng×20) / 100
rawScore  = min(100, baseScore + initial_score)
```

- `initial_score` is the per-campaign floor (`audience.default_initial_score`, 0–50, default 20 in the UI) snapshotted at creation (V266/V267).
- Factor breakdown is persisted in `lead_score.scoring_factors_json` (each factor's score, weight, contribution) — this is what the score-detail popover renders.
- **Manual override**: `PUT /v1/audience/lead/{responseId}/score/manual` sets `is_manual_override = true`, which makes `calculateAndSaveScore` a no-op for that lead from then on (V268/V271).
- Percentile rank (`lead_score.percentile_rank`) is batch-recomputed every 15 minutes per campaign.

### 3.2 Tiers

Derived from score, both on `lead_score` and (from `best_score`) on `user_lead_profile.lead_tier`:

```
HOT  ≥ 80    WARM 50–79    COLD < 50
```

"Set tier" in the UI (`POST /v1/audience/user-lead-profile/update-tier`) works by **adjusting the score**, not by writing a free-standing tier value.

---

## 4. `user_lead_profile` — the per-person aggregate

[`UserLeadProfileService`](../../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/audience/service/UserLeadProfileService.java) maintains one row per (user, institute) aggregating all their submissions:

- `best_score` / `best_score_response_id` / `best_source_type` / `lead_tier`
- `conversion_status` (`LEAD` / `CONVERTED` / `LOST`) — **once CONVERTED, score updates freeze**
- `assigned_counselor_id` / `assigned_counselor_name` — the current owner (assignment is **user-level**, not per-response)
- Activity rollups: `campaign_count`, `total_timeline_events`, `demo_login_count`, `demo_attendance_count`, `last_activity_at`

Updated (a) in realtime after every score calculation, and (b) by a 30-minute batch rebuild (`batchRebuildProfiles`). `markConvertedIfExists` is called from enrollment flows so an enrolled learner's lead auto-converts.

`first_response_at` exists on the table (V272) but is dormant — see Known Issues in the [workbench doc §11.6](CRM_WORKBENCH_AND_SALES_DASHBOARD.md).

---

## 5. Lead statuses (pipeline stages)

Per-institute catalog in `lead_status` (V261–V264), managed by [`LeadStatusService`](../../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/audience/service/LeadStatusService.java).

- System defaults seeded idempotently on first access: **New** (`NEW`, is_default), **Converted** (`CONVERTED`), **Lost** (`LOST`) — `is_system = true`, renameable/recolorable but not deletable.
- Admins add custom stages (e.g. `DEMO_SCHEDULED`) with label, hex color, `display_order`. Delete = soft (`is_active = false`).
- Current stage lives on `audience_response.lead_status_id`.

`changeLeadStatus(audienceResponseId, statusId, actor, source)` is the single entry point for transitions (`POST /v1/lead-status/lead/{audienceResponseId}`). It:

1. Writes a `lead_status_history` row (`from_status_id` → `to_status_id`, `source` = `MANUAL` / `WORKFLOW` / `AUTO`).
2. Updates `audience_response.lead_status_id`.
3. If the target key is `CONVERTED`: marks the user profile converted (freezes scoring).
4. Logs the timeline event (`LEAD_CONVERTED` / `LEAD_LOST` / `STATUS_CHANGED`).
5. Emits the `LEAD_STATUS_CHANGED` workflow trigger.

Column-name gotchas (`display_order` not `sort_order`; `is_active` boolean not a `status` string) are documented in the [workbench doc §11.4](CRM_WORKBENCH_AND_SALES_DASHBOARD.md).

---

## 6. TAT / SLA reminders

Two distinct clocks, configured per-institute in the `lead_sla_config` tables (V262 — see [LEADS_SETTINGS.md §4](LEADS_SETTINGS.md)):

| Clock | Starts | Question it answers |
|---|---|---|
| **TAT** (turn-around time) | `submitted_at` | "Has anyone reached out to this brand-new lead yet?" |
| **Follow-up SLA** | last counsellor action | "Has the counsellor gone quiet on a touched lead?" |

### 6.1 The scheduler ([`LeadAutomationScheduler`](../../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/audience/scheduler/LeadAutomationScheduler.java))

Runs every 30 minutes. **Emit-only** — it fires workflow triggers; notifications/emails are the workflow engine's job.

**Scan 1 — SLA stages per lead:**

- Lead never touched (`lastCounselorActionAt == null`):
  - inside a "before" window → `LEAD_TAT_REMINDER_BEFORE` (stage e.g. `BEFORE_30M`)
  - past `submitted_at + tat_hours` → `LEAD_TAT_OVERDUE` (stage `OVERDUE`)
- Lead already touched: same logic against `lastAction + followup_sla_hours` → `FOLLOW_UP_DUE` / `FOLLOW_UP_OVERDUE`.

Dedup is replica-safe: `claimTatReminderStage` is an atomic conditional UPDATE keyed on `tat_reminder_dedup_key` = `{leadId}_{counselorId}_{stage}` — reassigning the lead to a new counsellor resets the cycle (`tat_reminder_assignee_id`). `tat_due_at` is denormalized onto `audience_response` purely for UI badges.

**Scan 2 — counsellor-scheduled follow-ups:** transitions `lead_followup` rows `PENDING → ONGOING` at `schedule_time` (emits `FOLLOW_UP_DUE`) and `ONGOING → OVERDUE` 30+ minutes past due (emits `FOLLOW_UP_OVERDUE`), via atomic `claimDueTransition` / `claimOverdueTransition`.

Trigger context includes `instituteId`, lead/user/enquiry/audience ids, campaign name, counsellor contact, lead contact (`parentName/Email/Mobile`), `tatStage`, `dueAt`, `minutesToBreach`, and `notifyRoles` from config.

---

## 7. Follow-ups (counsellor tasks)

`lead_followup` (V273), managed by [`LeadFollowupService`](../../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/audience/service/LeadFollowupService.java) + `LeadFollowupController`:

| Verb | Path | Purpose |
|---|---|---|
| POST | `/v1/lead-followup` | Create (PENDING) — body `{audience_response_id, schedule_time, content}`; emits `FOLLOWUP_SCHEDULED` timeline event |
| GET | `/v1/lead-followup/{audienceResponseId}` | All follow-ups for a lead, ordered by schedule_time |
| GET | `/v1/lead-followup/my-pending` | Caller's PENDING/ONGOING follow-ups |
| PUT | `/v1/lead-followup/{id}` | Reschedule / edit content (rejected once closed) |
| PUT | `/v1/lead-followup/{id}/close` | Mark COMPLETED with `closer_reason`; emits `FOLLOWUP_CLOSED` |

Lifecycle: `PENDING → ONGOING → OVERDUE → COMPLETED` (the middle transitions are scheduler-driven, §6.1). The Follow-ups page UI is documented in [RECENT_LEADS_AND_FOLLOWUPS.md §5](RECENT_LEADS_AND_FOLLOWUPS.md).

---

## 8. Listing & filtering leads — `POST /v1/audience/leads`

The single backend list endpoint behind Recent Leads, Campaign Users, and the Follow-ups page. [`AudienceService.getLeads`](../../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/audience/service/AudienceService.java) → native query `findLeadsWithFilters` (~170 lines of SQL joining `audience_response` ← `audience`, `lead_score`, `user_lead_profile`).

Filter surface (`LeadFilterDTO`): `audienceId`, `leadStatusId`, `sourceType`/`sourceId`, submitted date range, `searchQuery`, `minLeadScore`/`maxLeadScore`, `leadTier`, `assignedCounselorId`, `isUnassigned`, `conversionStatusFilter` (`EXCLUDE_CONVERTED` / `ONLY_CONVERTED` / `ALL`), `slaFilter` (`TAT_BEFORE` / `TAT_OVERDUE` / `FOLLOW_UP_DUE` / `FOLLOW_UP_OVERDUE` / `ANY_OVERDUE`), `customFieldFilters` (AND-combined), `excludeDuplicates`, page/size.

Request pre-processing worth knowing:

1. **RBAC** — three modes via the `AUDIENCE_ROLE_ACCESS` setting: `DEFAULT` (institute-wide), `COUNSELOR` (forced `assignedCounselorId = caller`), `AUDIENCE_LIST` (locked to granted audience ids). Plus **leads-team narrowing**: if the institute has a `leads_team_id` and the caller is in that subtree, visible leads = caller + org-chart descendants (see [workbench doc §4](CRM_WORKBENCH_AND_SALES_DASHBOARD.md)).
2. **Search expansion** — `searchQuery` is matched against `parent_name` in SQL *and* expanded to user_ids via an auth-service user search (name/email/phone), passed in as a CSV.
3. **TAT resolution** — `tat_hours` is read from `lead_sla_config` so the SLA filter predicates can compute deadlines in SQL.
4. **Hydration** — results are mapped to `LeadDetailDTO` with custom fields, score + tier, status label/color, follow-up count/status, timeline count, profile conversion status and assigned counsellor.

Other read endpoints: `GET /v1/audience/lead/{responseId}` (single, fully hydrated), `GET /v1/audience/lead/{responseId}/score` (factor breakdown), `POST /v1/audience/user-lead-profiles/batch` (profile batch used by every lead table), `GET /v1/audience/user-audiences?userId=` (campaign memberships).

---

## 9. Reports endpoints

[`LeadReportController`](../../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/audience/controller/) — consumed by `/audience-manager/reports`:

| Path | Returns |
|---|---|
| `GET /v1/reports/leads/summary?instituteId&fromDate&toDate[&teamId&counsellorUserId&audienceId&sourceType]` | Totals (leads / converted / lost / active / conversion rate / responded / avg response minutes / TAT-met % / overdue), `by_status`, `by_source`, `by_tier`, `trend_by_day` |
| `GET /v1/reports/counselor-performance?instituteId&fromDate&toDate[&teamId&counsellorUserId&audienceId&sourceType]` | Per-counsellor rows: assigned, responded, conversions, conversion %, avg response time, TAT met %, open, overdue + summary |

Since 2026-06-12 both endpoints are **RBAC-scoped** (mirroring `SalesDashboardService.scopedUsers`): a plain counsellor sees only their own numbers, a team head their subtree, an admin outside the leads team the leads-team scope (or unscoped when no leads team is configured). Explicit `counsellorUserId` outside a scoped caller's descendants returns 403. The per-lead counsellor identity is `COALESCE(linked_users.user_id, ulp.assigned_counselor_id)` across all seven report queries; an empty resolved scope yields a zeroed report, never a silent widening.

There is also `POST /v1/audience/center-heatmap` (`AudienceAnalyticsController`) for engagement-by-center heatmaps, and internal endpoints under `/admin-core-service/internal` (converted-users-per-campaign for notification service, user-by-phone search, opt-out handling).

---

## 10. Enums quick reference

| Enum | Values |
|---|---|
| `SourceTypeEnum` | `WEBSITE`, `GOOGLE_ADS`, `FACEBOOK_ADS`, `INSTAGRAM_ADS`, `LINKEDIN_ADS`, `TWITTER_ADS`, `WALK_IN`, `MANUAL`, `OPT_OUT` |
| Campaign status | `ACTIVE`, `PAUSED`, `COMPLETED`, `ARCHIVED` |
| `LeadFollowupStatus` | `PENDING`, `ONGOING`, `OVERDUE`, `COMPLETED` |
| Conversion status | `LEAD`, `CONVERTED`, `LOST` |
| `LeadJourneyActionType` (timeline) | `LEAD_SUBMITTED`, `STATUS_CHANGED`, `LEAD_CONVERTED`, `LEAD_LOST`, `SCORE_UPDATED`, `MANUAL_SCORE_UPDATE`, `DUPLICATE_MERGED`, `COUNSELOR_ASSIGNED`, `FOLLOWUP_SCHEDULED`, `FOLLOWUP_CLOSED`, … |
| Status-history source | `MANUAL`, `WORKFLOW`, `AUTO` |

Remember: `timeline_event.action_type` stores the enum **name** (`COUNSELOR_ASSIGNED`), never the human title.

---

## 11. Migration index (leads core)

| Version | Purpose |
|---|---|
| V31 / V32 | `audience` + `audience_response` |
| V85 / V99 / V103 / V104 | parent contact fields, `student_user_id`, workflow-activate day, conversion/overall status |
| V191 | Lead scoring tables (`lead_score`) |
| V195 / V200 | `user_lead_profile` + assigned counsellor columns |
| V260 | TAT reminder dedup state on `audience_response` |
| V261 / V263 / V264 | `lead_status` + history, `is_system`, default seeding |
| V262 | `lead_sla_config` + reminder windows + notify roles |
| V266 / V267 | Per-campaign `default_initial_score` + per-response snapshot |
| V268 / V271 | Manual score override |
| V272 | `first_response_at` (dormant) |
| V273 | `lead_followup` |

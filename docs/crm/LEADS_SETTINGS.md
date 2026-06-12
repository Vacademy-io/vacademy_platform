# Leads Settings — Everything Configurable in the CRM

The full configuration surface for leads: the Settings → Lead Settings tab (config / pools / workbench), the lead-status manager, TAT/SLA settings, counsellor-rating strategy, and display-settings gating. Includes the complete `LEAD_SETTING` JSON shape and which backend service owns each piece.

> Last reviewed: 2026-06-10. Reflects code currently on `main`.
>
> Related: [Leads Management](LEADS_MANAGEMENT.md), [Lead Assignment & Pools](LEAD_ASSIGNMENT_AND_COUNSELOR_POOLS.md), [Workbench doc](CRM_WORKBENCH_AND_SALES_DASHBOARD.md) §§4, 9.

---

## 1. Where settings live (two storage styles)

| Storage | What | Why |
|---|---|---|
| `institute.setting` JSON (`LEAD_SETTING` key) | Master enable flag, scoring weights & visibility, workbench `leads_team_id`, rating **strategy** | Free-form config, read via `/v1/institute-settings` |
| Dedicated tables | Lead statuses (`lead_status`), SLA config (`lead_sla_config` + windows + roles), counselor pools (V265), counsellor **scores** (`counsellor_rating`, V328) | Anything queried by SQL at runtime or racing on concurrent writes |

The historical direction of travel: things start in `LEAD_SETTING` JSON and graduate to tables when SQL needs them (statuses V261, SLA V262, rating scores V328).

---

## 2. The Settings → Lead Settings tab

Registered in [`settings/-utils/utils.ts`](../../frontend-admin-dashboard/src/routes/settings/-utils/utils.ts) as `SettingsTabs.LeadSettings` (`/settings?selectedTab=leadSettings`). Main component: [`LeadSettings.tsx`](../../frontend-admin-dashboard/src/routes/settings/-components/LeadSettings.tsx) with three sub-tabs:

| Sub-tab | Component(s) | What it edits |
|---|---|---|
| **Config** | inline in `LeadSettings.tsx` | `enabled` master toggle, scoring weights (must sum to 100), `recencyDecayDays`, score-badge visibility per table → `PUT /v1/institute-settings?settingKey=LEAD_SETTING` |
| **Pools** | [`PoolsList.tsx`](../../frontend-admin-dashboard/src/routes/settings/-components/pools/PoolsList.tsx) → pool editor at `/settings/leads/pools/$poolId` | Counselor pools — full guide in the [assignment doc](LEAD_ASSIGNMENT_AND_COUNSELOR_POOLS.md) |
| **Workbench** | [`LeadsTeamPicker.tsx`](../../frontend-admin-dashboard/src/routes/settings/-components/LeadsTeamPicker.tsx) + [`CounsellorRatingSettings.tsx`](../../frontend-admin-dashboard/src/routes/settings/-components/CounsellorRatingSettings.tsx) | The org team that is the leads root (`leads_team_id`), and the rating strategy |

Related settings components that render lead config elsewhere:

- [`LeadStatusesManager.tsx`](../../frontend-admin-dashboard/src/routes/settings/-components/LeadStatusesManager.tsx) — pipeline-stage CRUD (§3)
- [`LeadSlaSettings.tsx`](../../frontend-admin-dashboard/src/routes/settings/-components/LeadSlaSettings.tsx) — TAT + follow-up SLA (§4)

---

## 3. Lead statuses (pipeline stages)

UI: `LeadStatusesManager` — add / rename / recolor / reorder / set-default; system statuses (New / Converted / Lost) are renameable but not deletable; delete is a soft-deactivate.

| Verb | Path |
|---|---|
| GET | `/v1/lead-status?instituteId=` (seeds the 3 system defaults on first access) |
| POST | `/v1/lead-status?instituteId=` |
| PUT | `/v1/lead-status/{id}` |
| DELETE | `/v1/lead-status/{id}` (soft) |

Backed by `lead_status` (V261/V263/V264) — full column reference in [LEADS_MANAGEMENT.md §5](LEADS_MANAGEMENT.md). Frontend hook: [`use-lead-statuses.ts`](../../frontend-admin-dashboard/src/hooks/use-lead-statuses.ts), query key `['lead-statuses']`.

---

## 4. TAT / Follow-up SLA settings

UI: `LeadSlaSettings` — two sections:

- **New Lead Response Time (TAT):** enable, `tat_hours` (default 24), multiple before-deadline reminder windows (minutes), notify roles.
- **Follow-up Reminders:** enable, `followup_sla_hours` (default 24), remind-before minutes (default 30), notify roles.

Endpoint: `GET/PUT /v1/lead-sla-config?instituteId=` ([`LeadSlaConfigController`](../../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/audience/controller/LeadSlaConfigController.java)). [`LeadSlaConfigService`](../../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/audience/service/LeadSlaConfigService.java) writes three tables atomically (V262):

| Table | Holds |
|---|---|
| `lead_sla_config` | One row per institute: `tat_enabled`, `tat_hours`, `followup_enabled`, `followup_sla_hours`, `followup_remind_before_minutes` |
| `lead_sla_reminder_window` | N before-windows per `sla_type` (`TAT` / `FOLLOWUP`) with `before_minutes` + `display_order` |
| `lead_sla_notify_role` | Roles to notify per `sla_type` |

`getSchedulerConfig(instituteId)` reshapes this for [`LeadAutomationScheduler`](../../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/audience/scheduler/LeadAutomationScheduler.java) (trigger keys `LEAD_TAT_REMINDER_BEFORE`, `LEAD_TAT_OVERDUE`, `FOLLOW_UP_DUE`, `FOLLOW_UP_OVERDUE`) — runtime behaviour in [LEADS_MANAGEMENT.md §6](LEADS_MANAGEMENT.md). Frontend hook: [`use-lead-sla-config.ts`](../../frontend-admin-dashboard/src/hooks/use-lead-sla-config.ts).

---

## 5. The `LEAD_SETTING` JSON — full shape

Stored under `institute.setting → LEAD_SETTING → data`. Read/written via `GET/PUT /v1/institute-settings?settingKey=LEAD_SETTING`; the workbench subtree is also managed by [`LeadWorkbenchSettingService`](../../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/counsellor_workbench/service/LeadWorkbenchSettingService.java).

```jsonc
{
  "enabled": true,                          // master switch — false hides ALL lead UI
  "scoringWeights": {                       // must sum to 100 in the UI
    "sourceQuality": 25,
    "profileCompleteness": 30,
    "recency": 25,
    "engagement": 20
  },
  "recencyDecayDays": 30,
  "showScoreInEnquiryTable": true,
  "showScoreInContactsTable": true,
  "showScoreInStudentsTable": true,
  "workbench": {
    "leads_team_id": "<organization_team.id>",   // the leads root — unlocks /counsellors + /sales-dashboard
    "rating": {                                  // strategy CONFIG (scores live in counsellor_rating table)
      "strategy_type": "STRATEGY_BASED",         // or "STATIC"
      "starting_rating": 0,
      "window_days": 90,
      "success_status_keys": ["CONVERTED"],
      "w_conversion": 0.6,
      "w_velocity": 0.4,
      "ideal_velocity_hours": 24,
      "worst_velocity_hours": 720,
      "min_sample_size": 5
    }
  }
  // sibling sub-trees under LEAD_SETTING.data owned by other features (tat legacy, doubts query_types, …)
}
```

Frontend hook: [`use-lead-settings.ts`](../../frontend-admin-dashboard/src/hooks/use-lead-settings.ts) (query key `['lead-settings-config']`) with client-side defaults when the institute has never saved the setting.

---

## 6. Counsellor rating settings

UI: `CounsellorRatingSettings` (Workbench sub-tab) — strategy picker (Automatic = `STRATEGY_BASED`, Manual = `STATIC`), presets (Balanced / Reward Closers / Reward Fast Callers), advanced tuning for every field in §5's `rating` block, and a "Refresh scores" button → `POST /v1/counsellor-rating/recompute`.

Score **storage** is the `counsellor_rating` table (**V328** — one row per counsellor+institute: `score`, `conversion_ratio_score`, `velocity_score`, `sample_size`, `manual_override`, `last_computed_at`). Read endpoints: `GET /v1/counsellor-rating?`, `POST /batch`, `GET /leaderboard`, `PUT /{counsellorUserId}/manual` (STATIC override). Algorithm + recompute cadence: [workbench doc §9](CRM_WORKBENCH_AND_SALES_DASHBOARD.md).

---

## 7. ⚠️ Known config gaps

1. **Rating-strategy fields don't persist via the workbench config endpoint.** `PUT /v1/counsellor-workbench/config` calls only `setLeadsTeam(instituteId, leadsTeamId)` ([controller line 42–44](../../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/counsellor_workbench/controller/)); `LeadWorkbenchSettingService.upsertRatingStrategy` exists but is not wired to any endpoint. The rating settings page can read config and trigger recomputes, but strategy edits via this path are silently dropped. (Workbench doc §11.6 #3.)
2. ~~**Scoring weights are decorative.**~~ **Fixed 2026-06-10:** `LeadScoringService` now reads per-institute `scoringWeights` + `recencyDecayDays` via [`LeadScoringSettingService`](../../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/audience/service/LeadScoringSettingService.java) (5-min Caffeine cache; invalid configs — negative weights or sum ≠ 100 — fall back to the 25/30/25/20 defaults with a warn). A weight change takes effect within 5 minutes on the *next* score calculation per lead; use the per-campaign "Recalculate scores" action to apply it immediately.
3. **`monthly_target` on pool members** is settable in the UI but never read at runtime ([assignment doc §2](LEAD_ASSIGNMENT_AND_COUNSELOR_POOLS.md)).

---

## 8. Display-settings gating (who sees which tabs)

Defined in [`constants/display-settings/admin-defaults.ts`](../../frontend-admin-dashboard/src/constants/display-settings/admin-defaults.ts), toggled in the Display Settings admin UI, persisted via `display-settings.ts` service (API + localStorage fallback).

- Sidebar **Leads** section (category CRM, [`sidebar/utils.ts:379`](../../frontend-admin-dashboard/src/components/common/layout-container/sidebar/utils.ts#L379)) sub-items: `lead-list-leads` (→ `/audience-manager/list`), `recent-leads`, `follow-ups`, `counsellors` (→ `/counsellors`), `sales-dashboard`. **`counsellors` and `sales-dashboard` are hidden by default** (`SUB_ITEMS_HIDDEN_BY_DEFAULT`) — typically enabled once a leads team is configured.
- `/audience-manager/reports` has a sidebar entry (`lead-reports`, visible by default) since 2026-06-12.
- The "Lead Profile Tab" in the student side-view is off by default (`leadTab: false`).
- Independently of display settings, `LEAD_SETTING.enabled = false` hides all lead UI (columns, actions, tabs).
- Routes behind a disabled gate render `FeatureDisabledNotice`-style lock cards rather than 404s.

---

## 9. Settings quick-reference

| Setting | Where edited | Where stored | Consumed by |
|---|---|---|---|
| CRM on/off (`enabled`) | Lead Settings → Config | LEAD_SETTING JSON | every lead UI surface |
| Scoring weights / decay | Lead Settings → Config | LEAD_SETTING JSON | `LeadScoringService` (via `LeadScoringSettingService`, 5-min cache) |
| Score-column visibility | Lead Settings → Config | LEAD_SETTING JSON | LeadTable / contacts / students tables |
| Pipeline statuses | Lead Statuses manager | `lead_status` table | status chips, funnel, workflows |
| TAT / follow-up SLA | Lead SLA settings | `lead_sla_config` + 2 tables | `LeadAutomationScheduler`, SLA filters/badges |
| Per-campaign initial score | Campaign create/edit form | `audience.default_initial_score` | `LeadScoringService` floor |
| Pool assignment (modes, rotation, shifts, backups) | Lead Settings → Pools | `counselor_pool*` tables | `CounselorAssignmentService` |
| Leads team (workbench root) | Lead Settings → Workbench | LEAD_SETTING `workbench.leads_team_id` | workbench RBAC, sales dashboard, eligible assignees |
| Rating strategy | Lead Settings → Workbench | LEAD_SETTING `workbench.rating` (⚠️ gap #1) | `CounsellorRatingComputeService` |
| Counsellor scores | computed / manual override | `counsellor_rating` table (V328) | leaderboard, badges |
| Tab visibility | Display Settings | display-settings JSON | sidebar + route gates |

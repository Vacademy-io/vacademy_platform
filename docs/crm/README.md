# CRM Documentation Index

Onboarding doc set for the Vacademy CRM cluster (admin_core_service + frontend-admin-dashboard, with identity/teams in auth_service). Start here.

> All docs last reviewed 2026-06-10 against `main`.

## The doc set

| Doc | Covers |
|---|---|
| [CAMPAIGNS_AND_AUDIENCE_MANAGER.md](CAMPAIGNS_AND_AUDIENCE_MANAGER.md) | Campaigns (audiences): CRUD, custom-field form builder, share links / embed / API integration, Meta & Google & Zoho/Google-Forms/MS-Forms webhook connectors, campaign-users page, workflow linking |
| [LEADS_MANAGEMENT.md](LEADS_MANAGEMENT.md) | The lead lifecycle backend: every intake path, dedup, scoring & tiers, pipeline statuses + history, TAT/SLA scheduler, follow-up tasks, `user_lead_profile` aggregate, the `/v1/audience/leads` listing engine, reports endpoints |
| [LEAD_ASSIGNMENT_AND_COUNSELOR_POOLS.md](LEAD_ASSIGNMENT_AND_COUNSELOR_POOLS.md) | How leads get an owner: counselor pools, MANUAL / ROUND_ROBIN / TIME_BASED routing, rotation cursor, backups, shifts, manual assignment, pool-management UI |
| [RECENT_LEADS_AND_FOLLOWUPS.md](RECENT_LEADS_AND_FOLLOWUPS.md) | The counsellor-facing frontend: Recent Leads inbox, shared LeadTable + side-view + dialogs, Follow-ups list/calendar, Lead Reports page, query-key map |
| [LEADS_SETTINGS.md](LEADS_SETTINGS.md) | Everything configurable: Lead Settings tab, status manager, TAT/SLA config, full `LEAD_SETTING` JSON shape, rating strategy, display-settings gating, known config gaps |
| [CRM_WORKBENCH_AND_SALES_DASHBOARD.md](CRM_WORKBENCH_AND_SALES_DASHBOARD.md) | Manager surfaces: counsellor workbench (`/counsellors`), sales dashboard, counsellor ratings, the reassign engine, org-team hierarchy & RBAC, the data-storage map, known issues |
| [EXOTEL_CALL_INTEGRATION.md](EXOTEL_CALL_INTEGRATION.md) | Telephony: click-to-call from lead rows, provider-agnostic SPI (Exotel first), SSE live status, recording capture into the timeline |
| [CRM_PRODUCT_DEEP_DIVE.md](CRM_PRODUCT_DEEP_DIVE.md) | Product audit (2026-06-12): multi-level report hierarchy design, per-persona experience gaps, unsurfaced-data report ideas, AI layer, trust/correctness debt, prioritized roadmap |

## Reading order for new joiners

1. **CRM_WORKBENCH_AND_SALES_DASHBOARD.md §1–2** — the two-database topology (admin-core vs auth-service) and why nothing can `JOIN users`. Every other doc assumes this.
2. **CAMPAIGNS_AND_AUDIENCE_MANAGER.md** — where leads come from.
3. **LEADS_MANAGEMENT.md** — what happens to them.
4. **LEAD_ASSIGNMENT_AND_COUNSELOR_POOLS.md** — who works them.
5. **RECENT_LEADS_AND_FOLLOWUPS.md** — the screens counsellors live in.
6. **LEADS_SETTINGS.md** + the rest as needed.

## The five invariants everyone trips on

1. Admin-core SQL **cannot join `users`** — hydrate identity via `AuthService.getUsersFromAuthServiceByUserIds` after the query.
2. `timeline_event.type_id` for `USER_LEAD_PROFILE` events is the lead's **user_id**, not the profile PK; `action_type` stores the enum **name** (`COUNSELOR_ASSIGNED`), never the human title.
3. Open lead = `conversion_status IS NULL OR != 'CONVERTED'`.
4. `lead_status` columns are `display_order` + `is_active` (boolean) — not `sort_order` / `status`.
5. There is **no `assigned_at` column** — it is derived from `timeline_event` on read.

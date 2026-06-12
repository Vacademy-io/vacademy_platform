# Recent Leads, Follow-ups & Lead Reports — Frontend Guide

The counsellor-facing daily-driver surfaces of the CRM: the cross-campaign **Recent Leads** inbox, the **Follow-ups** queue (list + calendar), and the **Lead Reports** analytics page. All in `frontend-admin-dashboard` under [`src/routes/audience-manager/`](../../frontend-admin-dashboard/src/routes/audience-manager/).

> Last reviewed: 2026-06-10. Reflects code currently on `main`.
>
> Related: [Leads Management](LEADS_MANAGEMENT.md) (the backend these pages call), [Campaigns & Audience Manager](CAMPAIGNS_AND_AUDIENCE_MANAGER.md) (per-campaign twin of this table), [Exotel Call Integration](EXOTEL_CALL_INTEGRATION.md) (the Call button), [Workbench doc](CRM_WORKBENCH_AND_SALES_DASHBOARD.md) (the manager's view of counsellors).

---

## 1. Shared building blocks

Every leads surface (Recent Leads, Campaign Users, Follow-ups) is built from the same shared parts in [`src/components/shared/leads/`](../../frontend-admin-dashboard/src/components/shared/leads/):

| Piece | File | Role |
|---|---|---|
| `LeadCardVM` | `lead-view-model.ts` | Universal lead row shape. Adapters: `recentLeadToVM()` (from `RecentLeadDetail`), campaign-users adapter. `.toStudent()` maps to a partial `StudentTable` so the shared student side-view can render a lead. |
| `LeadActionHandlers` | `lead-actions.ts` | The single callback contract: `onOpenDetails`, `onAddNote?`, `onAssignCounsellor?`, `onSetTier?`, `onSetStatus?`, `onCallLead?`, `canCall?`, `renderExtraActions?` |
| `LeadTable` | `lead-table.tsx` | The table itself — columns below |
| `useUpdateLeadTier` | `use-update-lead-tier.ts` | Tier mutation + invalidation |
| `usePlaceCall` | `use-place-call.ts` | Click-to-call mutation with SSE status streaming (see telephony doc) |
| `useLeadSettings` | `src/hooks/use-lead-settings.ts` | LEAD_SETTING config (master `enabled` flag, score-column visibility, SLA defaults) |
| `useLeadStatuses` | `src/hooks/use-lead-statuses.ts` | Per-institute status catalog |
| `useLeadProfiles` / `useLatestNotesBatch` | | Batch hooks — profile + latest-note per visible row, no N+1 |

### LeadTable columns ([`lead-table.tsx`](../../frontend-admin-dashboard/src/components/shared/leads/lead-table.tsx))

1. **Lead name** (always) — avatar, name, relative submit time, `TatStatusBadge` (red overdue / yellow due-soon / red follow-up-overdue)
2. **Contact** (always) — email + phone, Call button via `CallPickerPopover` when telephony is enabled
3. **Lead source** — campaign pill (hidden on Follow-ups)
4. **Lead status** — editable chip via `LeadStatusSelect` → `POST /v1/lead-status/lead/{responseId}`
5. **Lead score** — 0–100 bar (gated by `showScoreInEnquiryTable`)
6. **Tier** — inline HOT/WARM/COLD dropdown → `useUpdateLeadTier`
7. **Reach out in** — TAT countdown or "✓ Contacted · 2:28 PM"
8. **Follow up at** — follow-up SLA countdown
9. **Lead owner** — assigned counsellor + assign/reassign button
10. **Activity** — latest-note preview + "Add note"

Tier display falls back to score-derived (≥80 HOT, ≥50 WARM, else COLD) when the profile has no explicit tier. Columns are toggleable via the "Manage Column" popover (`hiddenColumns` set).

---

## 2. Recent Leads page

Route `/audience-manager/recent-leads` → [`recent-leads-page.tsx`](../../frontend-admin-dashboard/src/routes/audience-manager/recent-leads/-components/recent-leads-page.tsx) (~900 lines). Sidebar id `recent-leads`, gated by display settings + `useLeadSettings().enabled`.

### 2.1 Filters & state

| State | Values / notes |
|---|---|
| `rangeDays` + `customFrom/To` | Presets Last 24h / 7d / 15d / 30d / All time / Custom date pair |
| `audienceId` | Campaign filter (default all) |
| `searchInput` → `appliedSearch` | 500 ms debounce; backend also expands to auth-service user search |
| `tierFilter` | HOT / WARM / COLD / all (only when lead settings enabled) |
| `leadStatusFilter` | **Default `'__ALL_ACTIVE_VALUE'` = "Active leads" (excludes Converted)**; or all statuses; or one specific status key |
| `slaFilter` | ANY_OVERDUE / TAT_OVERDUE / TAT_BEFORE / FOLLOW_UP_DUE / FOLLOW_UP_OVERDUE / all |
| `counsellorFilter` | Admin-only dropdown (RBAC-scoped); counsellors are server-locked to their own leads |
| `page` / `pageSize` | 10/20/50, default 20; any filter change resets to page 0 |
| `hiddenColumns`, `isSidebarOpen`, `noteTarget`, `counsellorTarget` | UI state |

CSV export pages through the current filter set in chunks of 200.

### 2.2 Data flow

```
POST /v1/audience/leads        ← the list (RecentLeadsRequest: institute_id, audience_id?,
                                  submitted_from/to_local, search_query, lead_tier,
                                  lead_status_id, conversion_status_filter, sla_filter,
                                  assigned_counselor_id, page, size)
POST /v1/audience/user-lead-profiles/batch     ← tier/score/owner per visible row
POST /timeline/v1/student/latest-notes-batch   ← activity column
GET  /v1/lead-status?instituteId=              ← status catalog
```

Row payload (`RecentLeadDetail`) carries `response_id`, `user_id`, campaign info, `parent_*` contact, hydrated `user {full_name,email,mobile_number}`, `custom_field_values` + metadata, and the SLA bundle (`tat_due_at`, `follow_up_due_at`, `tat_overdue`, `tat_due_soon`, `follow_up_overdue`, `tat_reminder_stage`).

### 2.3 Side-view (lead detail drawer)

Reuses the shared **student side-view** (`StudentSidebar` from manage-students): the row's `LeadCardVM.toStudent()` feeds it with `_response_id` / `_response_fields` / `_audience_campaign_name` extras. Tabs: overview (contact + form answers), lead journey timeline (`['lead-all-events', userId]` / `['cross-stage-timeline', userId]`), calls (telephony history), and the form response. The "Lead Profile Tab" inside the *student* drawer is itself display-settings gated (off by default).

### 2.4 Dialogs

- **Add note** ([`add-lead-note-dialog.tsx`](../../frontend-admin-dashboard/src/components/shared/add-lead-note-dialog.tsx)) — 4 tabs: NOTE / CALL_LOG / MEETING (→ `POST /timeline/v1/event` with `type: 'STUDENT'`, ACTIVITY category) and FOLLOW_UP (→ `POST /v1/lead-followup`; disabled with a hint when the row has no `audienceResponseId`). Invalidates `latest-notes-batch`, `cross-stage-timeline`, `lead-all-events`.
- **Assign counsellor** ([`assign-counselor-to-lead-dialog.tsx`](../../frontend-admin-dashboard/src/components/shared/assign-counselor-to-lead-dialog.tsx)) — debounced search over `GET /v1/audience/eligible-assignees` → `POST /v1/audience/user-lead-profile/assign-counselor`. Invalidates `['lead-profiles-batch']`, `['contacts']` + page keys.
- **Call** — `usePlaceCall` + live SSE toast; terminal states invalidate `['recent-leads']` + `['lead-profiles-batch']`. Full flow in [EXOTEL_CALL_INTEGRATION.md](EXOTEL_CALL_INTEGRATION.md).

---

## 3. Query keys (cache invalidation map)

| Key | Used by |
|---|---|
| `['recent-leads', instituteId, …filters, page, size]` | the list |
| `['lead-profiles-batch', stableKey]` | tier/owner/score per row — invalidate after tier/assign/status mutations |
| `['latest-notes-batch', stableKey]` | activity column — invalidate after add-note |
| `['lead-statuses']` | status catalog |
| `['lead-settings-config']` | LEAD_SETTING |
| `['counsellor-options', instituteId]` | counsellor filter dropdown |
| `['campaigns-list']` | audience filter dropdown |
| `['follow-ups', instituteId, counsellorId]` | follow-ups page |
| `['lead-all-events', userId]`, `['cross-stage-timeline', userId]` | side-view timeline |
| `['lead-report-summary', …]`, `['counselor-performance', …]` | reports page |

---

## 4. Follow-ups page

Route `/audience-manager/follow-ups` → [`follow-ups-page.tsx`](../../frontend-admin-dashboard/src/routes/audience-manager/follow-ups/-components/follow-ups-page.tsx). Fetches the same `POST /v1/audience/leads` (200/page, `conversion_status_filter: 'EXCLUDE_CONVERTED'`, optional `assigned_counselor_id`) and classifies **client-side**.

### 4.1 Buckets ([`follow-up-buckets.ts`](../../frontend-admin-dashboard/src/routes/audience-manager/follow-ups/-components/follow-up-buckets.ts))

A lead is "pending" if it has `tatDueAt` or `followUpDueAt`; the effective deadline prefers `followUpDueAt`. Four stat tiles, click-to-filter:

| Bucket | Rule |
|---|---|
| **Overdue** (red) | `tatOverdue` or `followUpOverdue` |
| **Today** (amber) | due within today's wall-clock day |
| **Upcoming** (blue) | due within 7 days |
| **All** | every pending follow-up |

### 4.2 Views & state

- **List view** — shared `LeadTable` sorted soonest-due first (score + source columns hidden).
- **Calendar view** ([`follow-ups-calendar-view.tsx`](../../frontend-admin-dashboard/src/routes/audience-manager/follow-ups/-components/follow-ups-calendar-view.tsx)) — month grid (Sunday start), ≤3 colour-coded pills per day (dominant bucket: overdue > today > upcoming), click-a-day → LeadTable of that day below.
- All view state is **URL-driven** ([`use-follow-ups-view-state.ts`](../../frontend-admin-dashboard/src/routes/audience-manager/follow-ups/-components/use-follow-ups-view-state.ts)): `?view=calendar&month=2026-06&date=2026-06-10&counsellor=<userId>`.
- Role gating: admins get the counsellor filter; counsellors are locked to their own queue.

Closing a follow-up happens from the side-view / add-note flows (`PUT /v1/lead-followup/{id}/close`) — the page itself is a read queue.

---

## 5. Lead Reports page

Route `/audience-manager/reports` → [`lead-reports-page.tsx`](../../frontend-admin-dashboard/src/routes/audience-manager/reports/-components/lead-reports-page.tsx) + [`get-lead-reports.ts`](../../frontend-admin-dashboard/src/routes/audience-manager/reports/-services/get-lead-reports.ts). Sidebar entry `lead-reports` (Leads group, visible by default) added 2026-06-12; counsellor rows / status legend / source rows / Total-Leads KPI drill through to Recent Leads with matching URL filters.

- Date-range filter (default last 30 days) + refresh.
- KPI cards: total leads, conversion rate, avg response time, TAT met %.
- Status donut + daily submitted-vs-converted trend line.
- Source and tier breakdown tables.
- Counsellor performance table (assigned / responded / conversions / conversion % / avg response time / TAT met % / open / overdue), sortable, colour-coded rates.

Endpoints: `GET /v1/reports/leads/summary` and `GET /v1/reports/counselor-performance` (shapes in [LEADS_MANAGEMENT.md §9](LEADS_MANAGEMENT.md)).

---

## 6. Gotchas

- **"Active leads" is the default status filter** — converted leads vanish from Recent Leads by default. Users asking "where did my lead go after conversion" → switch to "All statuses".
- The follow-ups page classifies buckets **client-side over a 200-row page** — a counsellor with >200 pending leads gets truncated buckets.
- `useLeadSettings().enabled === false` hides the entire lead UI surface (tabs, columns, actions) — check this first when "the CRM disappeared".
- Tier/assign/status mutations must invalidate `['lead-profiles-batch']` or rows show stale owner/tier; the shared hooks accept extra `invalidateKeys` for the page's own list key.
- Side-view is the *student* sidebar fed with a partial record — fields it expects but a lead lacks render empty, which is expected.

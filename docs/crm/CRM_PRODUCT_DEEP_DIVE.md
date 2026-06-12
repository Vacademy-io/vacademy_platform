# CRM Product Deep Dive — Experience Upgrades & Multi-Level Reporting

Product audit of the CRM (2026-06-12): where the experience falls short per persona, what data we already capture but never show, what the market ships that we don't, and a prioritized roadmap. Produced from a 7-agent code + market audit (95 findings, all verified against `main` with file evidence).

> Companion docs: [README](README.md) for the architecture set. Findings reference code as `file:line`.

---

## 0. Executive summary

**The central finding: our CRM collects multi-level data but reports at exactly one level — institute-wide.** The org-team graph, RBAC scope service, and per-counsellor/per-campaign/per-stage data all exist; the report layer just never consumed them:

- The two report endpoints (`/v1/reports/leads/summary`, `/v1/reports/counselor-performance`) accept **only `instituteId + dates`** — no team, counsellor, campaign, or source parameter ([LeadReportController.java:26-40](../../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/audience/controller/LeadReportController.java)).
- They are **not RBAC-scoped**: any authenticated counsellor can fetch every colleague's performance numbers (no `CustomUserDetails`, no `CounsellorScopeService`) — a privacy leak *and* the missing "my report" feature in one.
- The reports page has **no sidebar entry** (URL-only), the sales dashboard's **team picker was never built** (`const teamId = undefined // RBAC adds a team picker in a follow-up`, [sales-dashboard/index.lazy.tsx:118](../../frontend-admin-dashboard/src/routes/sales-dashboard/index.lazy.tsx)) even though **8 backend widgets already accept `team_id`**, and **no aggregate anywhere is clickable** (zero `navigate`/`Link` in any dashboard widget).

Beyond reports, the audit converged on five themes:

1. **Leveled reporting** — the hypothesis this dive set out to test. Confirmed, and cheap: most of it is parameter-threading plus FE wiring (§1).
2. **Counsellor throughput** — no "My Day" queue, no post-call disposition flow, assignment notifications effectively non-realtime (§2).
3. **Manager coaching & control** — call recordings fully plumbed in the backend but unreachable in the UI; `monthly_target` stored but never read; no capacity/load or proactive alerting (§3).
4. **Trust & correctness debt** — confirmed live bugs (rating velocity, settings saves silently dropped, transfer mislabels), attribution that rewrites history on reassign, UTC day-bucketing wrong for IST, silent webhook lead loss (§5).
5. **AI layer** — transcription, credits metering, and the workflow engine make call intelligence and lead briefs near-term builds, not moonshots (§4).

---

## 1. The headline: a five-level report hierarchy

### 1.1 The levels and what each persona gets

| Level | Persona | Report content | Plumbing status |
|---|---|---|---|
| **Institute** | leadership/admin | today's KPI rollup, funnel, source mix, trend | ✅ exists (the only level today) |
| **Team** (org subtree) | manager | same KPIs scoped to `descendantUserIdsForCaller` / chosen sub-team, team-vs-team comparison | 🟡 server-side scoping exists (`SalesDashboardService.scopedUsers`); reports endpoints + FE picker missing |
| **Counsellor** (manager view) | manager | scorecard: assigned / responded / converted / avg response / TAT met / calls / talk time / **target vs actual** | 🟡 `findReportCounselorPerformance` computes most of it institute-wide; needs scoping + drawer surface |
| **Counsellor-self ("My performance")** | counsellor | own calls today, TAT %, open/overdue, conversions, rating trend | ❌ nothing today — counsellors have zero self-analytics |
| **Campaign / Source** | marketer | per-campaign funnel, CPL/CPA (needs spend capture), speed-to-lead, duplicate rate, connector health | 🟡 campaign cards exist but period hardcoded `WEEK`, attribution by lead-creation date, `LIMIT 20` |
| **Lead-cohort** | leadership | intake-week cohort maturation (% converted after 7/14/30/60d), conversion-lag distribution | ❌ no cohort concept anywhere (`grep cohort` = 0 hits) |

### 1.2 Build plan (four phases, each independently shippable)

**R1 — Foundation (mostly S/M effort, do first):**
- Add optional `teamId / counsellorUserId / audienceId / sourceType` params to both report endpoints; thread into the 7 native queries in [AudienceResponseRepository.java:967-1168](../../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/audience/repository/AudienceResponseRepository.java) as AND-clauses.
- Inject `CustomUserDetails` + `CounsellorScopeService.descendantUserIdsForCaller` as the default scope (mirror `SalesDashboardService.scopedUsers` priority order). Fixes the leak and creates counsellor-self/team levels in one change.
- Ship the sales-dashboard **team picker** (populate from `GET /counsellor-workbench/me/team` → `descendant_team_ids`; the `teamId` prop plumbing already reaches every widget). Fix the leaderboard team-filter bug (it scopes to leads-root, ignoring the passed team — [CounsellorRatingService.java:72-75](../../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/counsellor_rating/service/CounsellorRatingService.java)).
- Add **Reports to the sidebar** (display-settings gated) — it's currently dead inventory.
- **Drill-through everywhere**: every aggregate (funnel stage, source row, counsellor row, KPI tile) navigates to `/audience-manager/recent-leads` with equivalent filters pre-applied — `POST /v1/audience/leads` already supports them all. Pure FE wiring; highest UX leverage per unit effort in the whole stack.

**R2 — Levels as surfaces:**
- Filter bar on the reports page (team / counsellor / campaign / source selects) + period-over-period delta chips on KPI cards (prior-window query is trivial).
- Counsellor drawer "Performance" tab upgrade: KPI header from counsellor-filtered counselor-performance + rating component breakdown (`conversion_ratio_score` / `velocity_score` are already in `RatingDTO`, rendered nowhere) + date control (today it renders two borrowed widgets, one silently all-time).
- The same panel doubles as the **"My performance"** page for counsellors.
- Campaign report fixes: honor the page date range (period is hardcoded `WEEK`), attribute conversions by **converted-in-window** (today a lead converted this week from last month's cohort is invisible), remove `LIMIT 20`.

**R3 — New report types from data we already capture (§ "unsurfaced data"):**

| Report | Source data (already written, never read) |
|---|---|
| **Stage velocity / time-in-stage / funnel flow** | `lead_status_history` — write-only today; sole reader is a per-lead audit list, and even `getHistory` has no controller mapping. Median time per stage, stage→stage drop-off, aging buckets ("stuck > 14d", click-through), backward-transition detection |
| **Call-outcome analytics** | `telephony_call_log` has status/duration/direction/price/caller_id; the only aggregate is `COUNT(*)` per day. Connect rate, talk time, attempts-before-connect, best-hour heatmap, inbound/outbound mix, cost-per-conversion, per-ExoPhone answer-rate (validates STICKY_PER_LEAD) |
| **Speed-to-lead** | submission → first connected call/touch; distribution vs the 5-min/30-min benchmark buckets (the most-cited admissions metric; Meritto markets "80% drop after 5 minutes") |
| **Score calibration** | conversion rate by score band / tier per source — validates the now-configurable scoring weights; manual-override count as a distrust signal |
| **SLA compliance trend** | `tat_reminder_stage/count` bookkeeping → breach trends per team/counsellor over time, not the current point-in-time % |
| **Follow-up closure reasons** | `lead_followup.closer_reason` captured on every close, never aggregated |
| **Duplicate rate per source/campaign** | `is_duplicate` flags exist; no report, no UI |
| **Cohort maturation** | intake week/month × cumulative conversion at 7/14/30/60d from `lead_status_history` timestamps — makes early campaign comparison honest during admission season |

**R4 — Distribution & goals:**
- **Scheduled digests**: weekly manager email (team KPIs + WoW delta + top/bottom + overdue counts) and a counsellor "your week" — aggregates all exist; needs a scheduler + template through the existing notification/workflow engine. Market table stakes (LeadSquared SIERA subscriptions, HubSpot recurring dashboard emails).
- **Targets vs actuals**: `counselor_pool_member.monthly_target` is settable in the UI and read by *nothing* ([CounselorPoolService.java:447,666](../../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/counselor_pool/service/CounselorPoolService.java) are the only touchpoints). Wire into workbench cards ("14/30 this month"), counselor-performance columns (attainment %, pace), and a team rollup on the KPI band.
- Export (CSV at minimum) on the counsellor performance table and reports page.
- **Attribution fairness**: counselor-performance credits everything to the *current* owner (`COALESCE(lu.user_id, ulp.assigned_counselor_id)`) — a reassign rewrites the past. The full ownership chain exists in `timeline_event` (`reassigned_from` metadata); compute period attribution from it, or at minimum surface "reassigned-in" counts. Matters for ratings/leaderboards too.

**Prerequisites that make R3 honest:** lost-reason capture (§5 #4) and institute-timezone day bucketing (§5 #5).

---

## 2. Counsellor experience (the 50-calls/day persona)

1. **"My Day" queue (highest impact)** — there is no landing surface for a shift. Recent Leads holds 6 filters in `useState` (no `validateSearch` → all state lost on reload); Follow-ups only contains leads that already have SLA timestamps. Ship a counsellor home merging: new-since-last-login, due-today/overdue follow-ups, TAT-at-risk — with one "start working" entry point. Cheap step 1: URL-sync Recent Leads filters + persist last-used view.
2. **Post-call disposition + work mode** — after a call ends, `usePlaceCall` only invalidates queries; logging outcome/status/next-follow-up is 3 separate dialogs. Auto-open a disposition sheet on terminal call status (outcome chips + note + status + next follow-up in one submit, linked to the `telephony_call_log` id), and a J/K next-lead work mode. This is the single biggest throughput lever. (Market: progressive-dialer campaigns on Exotel APIs are the L-effort extension.)
3. **Notifications are effectively non-realtime** — pool assignment sends a bell whose navbar query has `staleTime` 30s and **no refetch interval**; manual assignment, workbench reassign, and bulk-import assignment notify **nobody**. Notify on all paths + a refetch interval or SSE + optional email/WhatsApp ping.
4. **Follow-ups page** — three concrete issues: client-side bucketing over one 200-row page (counts silently wrong for busy queues), no close/complete action on the page itself (the only close UI lives behind the display-settings-gated Lead Profile tab, off by default), and a 1-line bug: `noteTarget` is set without `responseId` so "schedule next follow-up" from this page is permanently disabled ([follow-ups-page.tsx:190-191](../../frontend-admin-dashboard/src/routes/audience-manager/follow-ups/-components/follow-ups-page.tsx)).
5. **Smaller frictions**: no bulk actions/row selection anywhere; phone search is raw substring (no `+91`/space normalization); duplicates invisible (flags exist, no UI); hover-only row actions are unusable on touch *and* invisible to keyboard users; no per-lead WhatsApp/email send from lists (call is the only channel — the two-way WhatsApp inbox is the market's highest-leverage channel gap for Indian admissions funnels).

---

## 3. Manager: coaching & control

1. **Call coaching surface** — backend is *complete* (recording playback endpoint, presigned URLs, metadata in the activity feed) but `LeadCallHistory` (inline audio player, built for this) is **rendered nowhere**, and `CounsellorActivityTab` ignores call metadata entirely — no duration, no play button. Mount it in the side-view, add a Calls tab to the counsellor drawer, render durations + play in Activity. Phase 2: manager QA notes per call + "reviewed" flag.
2. **Capacity/load view** — roster shows per-counsellor open-lead counts but no sort-by-load, distribution, overload flags, or idle signals (`last_activity_at` exists). Make the workbench the morning-check surface: sortable columns, load distribution bar, "no activity in 3 days" badges, SLA breaches per card.
3. **Rebalance + smarter round-robin** — reassign engine only drains one counsellor at a time; ROUND_ROBIN candidates are *everyone under leads root minus source, sorted alphabetically* — no ACTIVE-member filter (can route to deactivated members or managers), no load or rating weighting. Fix candidate quality, weight by `openLeadsCount`, then add a multi-source "Rebalance team" preview/apply.
4. **Proactive alerting** — `LeadAutomationScheduler` is emit-only by design and `notifyRoles` is role-based with no "this counsellor's manager" concept, despite `parent_user_id` chains powering all RBAC. Built-ins today: bell to assignee + alert to pool *creator*. Add: breach → notify manager (one hop up the chain), daily 9am team digest, spike rule (overdue > 2× trailing average).

---

## 4. AI layer (grounded in existing infra: ai_service + credits + workflow engine + in-house transcription)

Ordered by readiness:

1. **Call transcription → summaries on the lead timeline** (M) — recordings already land in S3 via media_service; transcription infra exists. Each call gets a summary timeline event.
2. **AI call-QA scorecards + objection mining** (L, builds on #1) — per-call LLM scorecard aggregated per counsellor in the workbench drawer; weekly objection clusters per team. (Talk/listen ratio needs diarization or dual-channel recording — ship scorecards without it first.)
3. **AI lead brief** (M) — one-paragraph "who they are / what they want / where it stalled / next step" at the top of the side-view; cached on `last_activity_at` so marginal cost ≈ 0; metered via credits.
4. **Next-best-action queue** (M) — deliberately **deterministic, not LLM**: priority = f(SLA urgency, score/tier, follow-up due, days-since-touch, last-call-outcome). Explainable reason chips per row ("TAT breaches in 40m"). Powers the My Day queue server-side and fixes the 200-row client bucketing at the same time.
5. **AI-drafted follow-up email/WhatsApp** (M) — phase 1 needs zero engine changes (ai_service draft endpoint called from an existing `HTTP_REQUEST` workflow node, piped into `SEND_EMAIL`/`SEND_WHATSAPP`); drafts land as reviewable timeline items, not auto-sends. Phase 2: first-class `AI_GENERATE` node + `CALL_COMPLETED` trigger.
6. **Weekly LLM narrative report** (M) — the `/insights` strip is hardcoded to exactly two deterministic insights; feed each team's week-vs-week aggregates to an ai_service narrative endpoint, store for the strip + email to team heads. One call per team per week — trivially meterable.

---

## 5. Trust & correctness debt (fix before building on top)

Confirmed-live issues, roughly ordered by severity:

| # | Issue | Evidence |
|---|---|---|
| 1 | **Reports endpoints leak institute-wide performance data to any authenticated user** (no RBAC) | LeadReportController has no `CustomUserDetails` |
| 2 | **Lead-visibility modes enforced on only 2 queries** — lead detail, timeline, followups, status changes, call logs never consult `AudienceRoleAccessService` (fail-open to DEFAULT); "own leads only" counsellors can fetch any lead by id | `AudienceService.java:372,1806` are the only call sites |
| 3 | **Rating velocity score silently broken** (title-cased `action_type` filter matches nothing → velocity always worst) + **rating settings page silently loses every save** (`PUT /config` only persists `leads_team_id`) + **activity feed mislabels every transfer** (`LIKE 'Counselor%'` never matches) — workbench doc §11.6 #1/#3/#2, all confirmed still present | `CounsellorRatingComputeService`, workbench config controller, `WorkbenchActivityRepository.fetchFeed` |
| 4 | **No lost-reason capture** — moving a lead to LOST takes no reason; "why we lose leads" is structurally unreportable. Add an institute-configurable lost-reason taxonomy + required picker, stored on `lead_status_history` | `LeadStatusService` status-change path has no reason param |
| 5 | **All daily analytics bucket by UTC** — every lead before 05:30 IST counts on the previous day; no institute-timezone concept exists (`AT TIME ZONE` = 0 hits in analytics SQL). Small horizontal fix every report inherits | `AudienceResponseRepository.java:1097` |
| 6 | **Webhook connector failures silently drop paid leads** — Meta/Google/Zoho intake errors are log-only; no dead-letter store, no failure counters, no admin alert, no health UI. An expired Meta token = ad leads vanish with zero trace | `AdPlatformWebhookService.java:121,160,328` |
| 7 | **Opt-out status invisible operationally** — click-to-call and per-lead messaging have no consent gate; no DND badge on rows | telephony has zero opt-out references |
| 8 | **Open intake endpoints have no spam defense** (incl. bulk variants) — bot submissions consume round-robin slots and pollute every report. Rate-limit + honeypot + quarantine state | `PublicAudienceController` |
| 9 | **Notification fatigue risk** — CRM events bypass the existing notification-preference substrate; design preferences/digests *before* shipping the §3.4 alerting stack | `notification_service` announcements prefs unused by CRM |

Also worth scheduling: a CRM setup checklist for new institutes (only lead statuses self-seed; everything else is scattered manual config with dead-end empty states), branch/center as a first-class lead dimension (multi-branch chains can't partition anything today), Hindi-first i18n for counsellor surfaces (i18next harness exists, covers only login), and an accessibility pass on the lead tables (2 ARIA attributes in the whole recent-leads tree).

---

## 6. Prioritized roadmap

**Now (weeks 1–4) — trust + foundation:**
R1 reports foundation (scope params + RBAC + sidebar + team picker + drill-through) · §5 #1–#3 fixes · follow-ups page bug + close action · assignment notifications on all paths · mount LeadCallHistory + drawer Calls tab.

**Next (quarter) — the leveled-report suite + counsellor throughput:**
R2 surfaces (filter bar, comparison chips, counsellor scorecard incl. "My performance") · stage-velocity + call-outcome + speed-to-lead reports (R3 core) · My Day queue backed by the deterministic priority endpoint · post-call disposition flow · targets vs actuals · weekly manager digest (R4 core) · lost-reason taxonomy + timezone fix (so the new reports are honest) · connector health page.

**Later (two quarters) — differentiation:**
Call transcription + summaries → AI call QA · AI lead brief · WhatsApp two-way inbox · progressive dialer · cohort maturation + score calibration + ROI (spend capture) reports · rebalance engine · LLM narrative digests · marketplace-grade extras (gamification/contests via the windowed leaderboard, branch dimension, re-engagement pools).

### Quick wins (S effort, ship anytime)
Sidebar entry for Reports · team picker (server already done) · drill-through links · KPI-band scoping consistency · follow-ups `responseId` one-liner · phone-search normalization · URL-sync Recent Leads filters · render rating components in the drawer · closure-reason + duplicate-rate widgets (data already aggregable) · windowed leaderboard for weekly contests.

---

*Full findings (95, with per-finding evidence) live in the audit run output; this doc is the curated synthesis. Questions → #vacademy-backend.*

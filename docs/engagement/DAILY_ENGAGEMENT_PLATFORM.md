# Daily Engagement Platform

Teacher-authored, time-scheduled daily tasks for learners — reading material, question of the day,
quizzes, games — tracked per learner, scored into a real points ledger, and ranked on leaderboards.

Status: **Phase 1 BUILT 2026-09-13 — not deployed, not runtime-verified.** Compiles clean
(backend `mvn compile`; both frontends add zero TypeScript errors over their baselines, ESLint and
the design gate pass). No service has been booted against a database, so the JPA queries and the
migrations are unproven at runtime. See §15 for exactly what is and isn't done.

Not to be confused with `ENGAGEMENT_ENGINES.md` in this folder, which is the *outbound* messaging
brain (WhatsApp/email/call). This document is the *in-app* daily engagement surface. They share
nothing but the word "engagement"; keep the packages separate.

---

## 1. Motive

Institutes want learners opening the app every day out of habit, not obligation. A teacher decides
what a batch sees on a given day, in a given window — "today 6 AM–8 PM, one question; answer and
leaderboard drop at 8 PM" — and can plan a day, a week, or a month ahead. Everything the learner
does is tracked, scored, and comparable.

Phase 4 replaces manual authoring with an AI planner. The schema below is designed so the AI writes
into the same tables a teacher does.

---

## 2. Verified current state

Checked against the repo on 2026-09-13. These findings drive most decisions below.

| Thing | Reality |
|---|---|
| Per-student points storage | **Does not exist.** No table holds a per-user point or XP total. Every `points` column in the schema (`rating.points`, `question.points`, `coding_submissions.max_points`) is unrelated. |
| Leaderboard `points` | Total focused-activity **minutes**, recomputed from `activity_log` per request — `LeaderboardService.buildFromActivityRows` / `LeaderboardEntryDTO.points`. All-time window, hardcoded from year 2000. |
| Learner XP pill / level / streak | Computed **in the browser** from activity logs, cached in `localStorage` — `frontend-learner-dashboard-app/src/services/play-gamification.ts`. The server never sees it. |
| Points & Scoring admin settings | Stored under `BADGES_REWARDS_SETTING.scoring`. Consumed **only by the browser** for the XP pill. The leaderboard never reads them. |
| Badges | `learner_badge` table — genuinely persisted (manual awards). Auto-unlock badges are client-evaluated. |
| Teacher planning | `teacher_planning_logs` (V49/V50/V52) — per `packageSession`, per interval bucket, `content_html`, `is_shared_with_student`. A **document**, not a task: no time window, no item type, no attempt record, no points. |
| HTML sandboxing | Already correct. `html-slide-iframe.tsx` renders with `sandbox="allow-scripts allow-popups"` and **no** `allow-same-origin` → opaque origin, plus a `postMessage` height protocol. |
| Scheduled jobs | `ReportSchedulerJob` + ShedLock (`ShedLockConfig`) already ticks hourly and resolves schedules against each institute's own timezone. Cluster-safe. |
| Push | Live — `notification_service` FCM, multi-tenant (`MultiTenantFirebaseManager`, `PushNotificationService`). |
| Institute timezone | `LANGUAGE_SETTING.timezone`, IANA string (e.g. `Asia/Kolkata`). Authored in Settings → Language. |

**Consequence:** the leaderboard ranks minutes, the XP pill shows a different number the server never
sees, and neither can express "20 points for answering today's question correctly." This is also why
the Institute-wide Leaderboard currently shows badge-holding learners at `0 pts`.

---

## 3. Decisions

Locked with the founder:

| # | Decision |
|---|---|
| 1 | Plan scope is **per batch** (`package_session`). |
| 2 | A learner can receive **multiple items in the same slot** — the Today card is a queue, not a single card. |
| 3 | A learner in **multiple batches** sees a merged feed, grouped and labelled by batch. |
| 4 | Timezone comes from the existing **institute** setting. Not learner-local. |
| 5 | **Missed-day policy is teacher-configurable**, per plan with per-item override. |
| 6 | Games are **teacher-uploaded HTML**. |
| 7 | Authoring approval workflow is **out of scope** — any authorised teacher publishes directly. |
| 8 | Learners **can see future items but cannot open them**. |

Assumed from my recommendations — reversible, but the plan is built on them:

| # | Assumption |
|---|---|
| A | **Option B**: introduce `points_ledger` rather than extending the minutes query. |
| B | **Daily item cap = 5** across all batches, institute-configurable. |
| C | **Catch-up recovers points but never repairs a broken streak.** |

---

## 4. Data model

New tables in `admin_core_service`. Next free Flyway number is **V512**, verified against
`git ls-tree HEAD` and `git log --all` rather than a working-tree listing — V512/V513/V514 exist on
no branch.

**Unrelated risk noticed while checking:** `V510__ai_call_follow_up_and_engagement.sql` exists in
git HEAD but is **deleted in the working tree** by uncommitted work that is not part of this
feature. If that deletion is committed and V510 has already been applied to an environment, Flyway
validation fails there and admin_core will not start. Not caused by this work, but it sits in the
same directory and would break a deploy carrying these migrations.

### 4.1 `points_ledger` — V512

The foundational piece. Append-only. Every point any subsystem ever awards lands here.

```sql
CREATE TABLE public.points_ledger (
    id              varchar(255) NOT NULL,
    user_id         varchar(255) NOT NULL,
    institute_id    varchar(255) NOT NULL,
    package_session_id varchar(255) NULL,   -- NULL = institute-wide award
    source_type     varchar(64)  NOT NULL,  -- ENGAGEMENT_ITEM | ENGAGEMENT_STREAK | ASSESSMENT | ACTIVITY | MANUAL
    source_id       varchar(255) NULL,      -- soft pointer (engagement_item.id, assessment id, ...)
    points          int4         NOT NULL,  -- signed; negative row = reversal
    reason          text         NULL,
    awarded_at      timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    idempotency_key varchar(255) NOT NULL,
    created_at      timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT points_ledger_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX idx_points_ledger_idem ON public.points_ledger (idempotency_key);
CREATE INDEX idx_points_ledger_user_inst ON public.points_ledger (institute_id, user_id);
CREATE INDEX idx_points_ledger_ps_time   ON public.points_ledger (package_session_id, awarded_at);
CREATE INDEX idx_points_ledger_source    ON public.points_ledger (source_type, source_id);
```

Rules:
- **Never update or delete a row.** A correction is a compensating negative row.
- `idempotency_key` is `{source_type}:{source_id}:{user_id}` for one-shot awards and carries the
  local date for repeatables (`ENGAGEMENT_STREAK:2026-09-13:{user_id}`). This is the at-most-once
  guarantee — a retried submit cannot double-award.
- Weekly/monthly leaderboards are a `WHERE awarded_at >=` on this table. That capability does not
  exist today at all.

### 4.2 `engagement_plan` — V513

```sql
CREATE TABLE public.engagement_plan (
    id                  varchar(255) NOT NULL,
    institute_id        varchar(255) NOT NULL,
    package_session_id  varchar(255) NOT NULL,
    title               varchar(500) NOT NULL,
    description         text NULL,
    subject_id          varchar(255) NULL,
    status              varchar(32) NOT NULL DEFAULT 'DRAFT',  -- DRAFT | PUBLISHED | ARCHIVED | DELETED
    timezone            varchar(64) NOT NULL,          -- snapshot of LANGUAGE_SETTING.timezone at create
    default_miss_policy varchar(32) NOT NULL DEFAULT 'EXPIRES',
    default_catch_up_days      int4 NULL,
    default_catch_up_percent   int4 NULL,
    created_by_user_id  varchar(255) NOT NULL,
    created_at          timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT engagement_plan_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_engagement_plan_ps ON public.engagement_plan (package_session_id, status);
```

`timezone` is **snapshotted onto the plan**, not read live. If an institute changes its timezone
mid-term, already-published slots must not silently shift by hours under learners who already
attempted them.

### 4.3 `engagement_slot` — V513

The scheduled window.

```sql
CREATE TABLE public.engagement_slot (
    id            varchar(255) NOT NULL,
    plan_id       varchar(255) NOT NULL,
    title         varchar(500) NULL,
    -- Wall-clock + recurrence, resolved against plan.timezone at read time.
    start_date    date NOT NULL,
    end_date      date NULL,           -- NULL = single day (= start_date)
    start_time    time NOT NULL,       -- e.g. 06:00
    end_time      time NOT NULL,       -- e.g. 20:00
    dow_mask      int4 NULL,           -- bitmask Mon=1..Sun=64; NULL = every day in range
    reveal_time   time NULL,           -- answers + leaderboard drop; NULL = reveal at end_time
    notify_time   time NULL,           -- push; NULL = no push
    sort_order    int4 NOT NULL DEFAULT 0,
    status        varchar(32) NOT NULL DEFAULT 'ACTIVE',
    created_at    timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT engagement_slot_pkey PRIMARY KEY (id),
    CONSTRAINT fk_engagement_slot_plan FOREIGN KEY (plan_id) REFERENCES public.engagement_plan(id)
);
CREATE INDEX idx_engagement_slot_plan_dates ON public.engagement_slot (plan_id, start_date, end_date);
```

**Store wall-clock + timezone, never UTC instants.** A recurring 6 AM slot stored as an instant
drifts an hour twice a year for any institute in a DST zone. India has no DST; a future customer
will. Resolution to instants happens at read time via `plan.timezone`.

`end_time < start_time` means the window crosses midnight — validate and reject at authoring time in
Phase 1 rather than supporting it; a 10 PM–2 AM engagement window is not a use case worth the bug
surface yet.

### 4.4 `engagement_item` — V513

```sql
CREATE TABLE public.engagement_item (
    id             varchar(255) NOT NULL,
    slot_id        varchar(255) NOT NULL,
    item_type      varchar(48) NOT NULL,
        -- READING_HTML | VISUAL_NOTE | QUESTION_OF_DAY | QUIZ | GAME | POLL
    title          varchar(500) NOT NULL,
    version        int4 NOT NULL DEFAULT 1,
    sort_order     int4 NOT NULL DEFAULT 0,
    is_required    boolean NOT NULL DEFAULT false,
    -- Content: exactly one of these is populated per item_type.
    content_html   text NULL,          -- READING_HTML, VISUAL_NOTE, GAME
    slide_id       varchar(255) NULL,  -- reuse an existing slide
    question_id    varchar(255) NULL,  -- QUESTION_OF_DAY
    assessment_id  varchar(255) NULL,  -- QUIZ
    payload_json   jsonb NULL,         -- POLL options, game config, per-type extras
    -- Scoring
    completion_points int4 NOT NULL DEFAULT 0,
    correct_points    int4 NOT NULL DEFAULT 0,
    max_score         int4 NULL,       -- GAME/QUIZ ceiling; server clamps to this
    is_verifiable     boolean NOT NULL DEFAULT false,  -- false => unverified, capped contribution
    -- Miss policy (NULL = inherit from plan)
    miss_policy       varchar(32) NULL,
    catch_up_days     int4 NULL,
    catch_up_percent  int4 NULL,
    status         varchar(32) NOT NULL DEFAULT 'ACTIVE',
    created_at     timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT engagement_item_pkey PRIMARY KEY (id),
    CONSTRAINT fk_engagement_item_slot FOREIGN KEY (slot_id) REFERENCES public.engagement_slot(id)
);
CREATE INDEX idx_engagement_item_slot ON public.engagement_item (slot_id, sort_order);
```

**Immutability after open.** Once a slot has opened *and* any attempt exists, editing content or
scoring creates a new row with `version + 1` and retires the old one. Attempts pin to the version
they were made against. Without this, a teacher fixing a typo at noon silently invalidates every
morning score.

### 4.5 `engagement_attempt` — V513

```sql
CREATE TABLE public.engagement_attempt (
    id              varchar(255) NOT NULL,
    item_id         varchar(255) NOT NULL,
    item_version    int4 NOT NULL,
    user_id         varchar(255) NOT NULL,
    institute_id    varchar(255) NOT NULL,
    package_session_id varchar(255) NOT NULL,
    status          varchar(32) NOT NULL,   -- STARTED | COMPLETED | SKIPPED
    is_correct      boolean NULL,           -- NULL for non-gradable types
    score           numeric NULL,           -- raw reported/computed score
    max_score       numeric NULL,
    response_json   jsonb NULL,             -- chosen option, game payload, scroll depth
    time_spent_ms   int8 NULL,
    points_awarded  int4 NOT NULL DEFAULT 0,
    is_late         boolean NOT NULL DEFAULT false,  -- completed under catch-up
    is_verified     boolean NOT NULL DEFAULT false,  -- server checked the answer
    started_at      timestamp NULL,
    completed_at    timestamp NULL,
    created_at      timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT engagement_attempt_pkey PRIMARY KEY (id),
    CONSTRAINT fk_engagement_attempt_item FOREIGN KEY (item_id) REFERENCES public.engagement_item(id)
);
CREATE UNIQUE INDEX idx_engagement_attempt_unique ON public.engagement_attempt (item_id, user_id);
CREATE INDEX idx_engagement_attempt_user ON public.engagement_attempt (user_id, completed_at);
CREATE INDEX idx_engagement_attempt_item_status ON public.engagement_attempt (item_id, status);
```

One attempt row per (item, user) — enforced by unique index, which is also the concurrency guard
against a double-tapped submit. Re-attempts, if ever wanted, become a separate child table rather
than a relaxed constraint.

The `(item_id, status)` index backs the "**70 people have attempted this**" counter.

---

## 5. Time semantics

All state is **derived from timestamps at read time**. No job decides whether an item is open.

```
now_local   = now() in plan.timezone
is_open     = now_local within [start_time, end_time] on a matching date
is_revealed = now_local >= (reveal_time ?? end_time) on that date
is_future   = slot date/time is ahead of now_local
is_catchable= !is_open && miss_policy != EXPIRES && now_local <= end + catch_up_days
```

Jobs exist only for things that genuinely must fire: the push notification and (later) leaderboard
snapshots. Reusing `ReportSchedulerJob`'s hourly + ShedLock pattern means no missed fires on deploy
and no double sends across replicas.

**Miss policies:**

| Policy | Behaviour |
|---|---|
| `EXPIRES` | Gone at `end_time`. Strongest hook. |
| `CATCH_UP_FULL` | Attemptable for `catch_up_days`, full points. |
| `CATCH_UP_REDUCED` | Attemptable for `catch_up_days`, `catch_up_percent` of points. |

In every catch-up case the attempt is flagged `is_late = true` and **the streak does not heal**
(assumption C). Streaks measure showing up on the day; points measure work done. Conflating them
makes the streak meaningless.

---

## 6. Multi-batch feed resolution

A learner in several batches could otherwise be hit with 12 tasks on a Monday. Resolution order:

1. Collect every `ACTIVE` enrollment → active `PUBLISHED` plans → currently-open slots.
2. Flatten to items, drop items with a `COMPLETED` attempt.
3. Sort: `is_required` desc → soonest `end_time` → `plan.package_session_id` enrollment order →
   `item.sort_order`.
4. Truncate to the institute's daily cap (**default 5**, assumption B).
5. Group by batch for display; every card carries its batch name.

Items dropped by the cap are **not** marked missed — they simply weren't shown. If they were, a
learner in four batches would accumulate phantom failures they were never offered.

Leaderboards stay **per batch**. Ranking learners across batches compares people doing different
work, which is noise dressed as competition.

---

## 7. Item types and tracking contracts

| Type | Content | Completion signal | Verifiable |
|---|---|---|---|
| `READING_HTML` | `content_html` or `slide_id` | dwell time ≥ threshold **and** scroll depth ≥ 80% | No — small points only |
| `VISUAL_NOTE` | same | same | No |
| `QUESTION_OF_DAY` | `payload_json` (options + key) | answer submitted | **Yes** — server holds the key |
| `QUIZ` | `assessment_id` | assessment submitted | **Yes** |
| `GAME` | `content_html` (teacher-uploaded) | `postMessage` score | **No** — clamped + capped |
| `POLL` | `payload_json.options` | option chosen | N/A — no correct answer |

**Reading must not outscore quizzes.** Dwell + scroll is a patience signal, gameable by leaving a tab
open. Keep `completion_points` for reading well below `correct_points` for a question, or the
leaderboard measures idling.

### Game score contract

Reuse `html-slide-iframe.tsx` verbatim — and no new message type was needed. It already gives the
document an opaque origin AND already speaks a result protocol:

```js
parent.postMessage({ type: 'vacademy:complete', score: 42, maxScore: 50 }, '*');
parent.postMessage({ type: 'vacademy:progress', percent: 80 }, '*');
```

A game written for an HTML slide therefore works as an engagement game unchanged.

Server-side, on receipt:
- clamp `score` to `item.max_score`;
- store `is_verified = false`;
- cap the ledger award for unverified items (institute-configurable, default: completion points only,
  no score-proportional bonus).

Teacher HTML is untrusted code running in the learner's browser. It cannot be trusted to report its
own score honestly — anyone with devtools can post any number. The sandbox protects the *session*;
the clamp protects the *leaderboard*.

---

## 8. API surface

**Admin/teacher** (`admin_core_service`, `/engagement/plan/v1/...`)

```
POST   /plan                       create plan
PUT    /plan/{id}                  update / publish / archive
GET    /plan/list                  filter by package_session, date range, status
POST   /plan/{id}/slot             add slot (+ items in one payload)
PUT    /slot/{id}                  update (versions items if already open)
DELETE /slot/{id}                  soft delete
GET    /plan/{id}/calendar         month view: slots + item summaries
GET    /item/{id}/tracking         per-learner attempt table + aggregate stats
POST   /plan/{id}/copy             copy plan to other batches (Phase 3)
```

**Learner** (`/engagement/learner/v1/...`)

```
GET    /feed                       today's open items + locked upcoming, in one response
GET    /item/{id}                  full payload; refused unless open or catchable
POST   /item/{id}/submit           complete, grade, award to ledger (idempotent)
```

`/upcoming` was folded into `/feed` (an `upcoming[]` array) — the home page needs both together and
a second round trip bought nothing. `/start` was dropped: the attempt row is created on submit, and
a STARTED row that nothing reads is just a write. `/item/{id}/stats` was folded in too, as
`completedCount` on each feed item. `/history` is Phase 2.

**Critical:** `/upcoming` returns title, date, type icon and nothing else. If tomorrow's payload
ships to the client and is hidden with CSS, tomorrow's answer is one devtools panel away — and in a
ranked batch, somebody will look.

**Points** (`/points/v1/...`)

```
GET    /me/summary                 total, this week, level, breakdown by source_type
GET    /leaderboard?scope=...&window=WEEK|ALL   ledger-backed ranking
```

---

## 9. Admin UX

Extends the existing `planning` module rather than starting a new one — it already has the HTML
editor, interval selector and batch scoping.

- **New route** `routes/engagement/` (plans list, calendar, composer, tracking).
- **Composer**: pick batch → pick date(s) → set window (start/end/reveal/notify) → add items → set
  points and miss policy → publish. Week and month views for planning ahead.
- **Tracking**: per item, a learner table (attempted / correct / score / time / late) with an
  aggregate header, plus a batch-level "who is slipping" view — learners with N consecutive misses.
- **Reuse**: `PlanningHTMLEditor.tsx` for authored HTML, the existing question picker for
  `QUESTION_OF_DAY`, the assessment picker for `QUIZ`.

## 10. Learner UX

- **Today card** at the top of the learner dashboard — a queue with progress ("2 of 3 done"), each
  card branded with its batch, a countdown to `end_time`, and the live attempt count as social proof.
- **Locked future strip** — the next few days visible but un-openable. Anticipation is a hook;
  ambiguity is not.
- **Reveal moment** — at `reveal_time`, the answer plus the batch leaderboard, as a celebratory
  state. Reuse `play-celebration.ts`.
- **Points surfaces** — the existing `XpDisplayWidget`, `StreakCounterWidget` and
  `AchievementBadgesWidget` get repointed at `/points/v1/me/summary` instead of `localStorage`.
- **Leaderboard framing** — top 10 by name, the learner's own row always visible, everyone else in
  bands ("Top 40%"), weekly window default. Rank 47 of 50 shown daily is a reason to stop opening the
  app, which is the opposite of the goal.

## 11. Jobs

| Job | Cadence | Work |
|---|---|---|
| `EngagementNotifyJob` | every 15 min, ShedLock | slots whose `notify_time` falls in this window → FCM push per enrolled learner |
| `EngagementStreakJob` | daily, per institute-midnight | close the day; award streak points to learners who completed a required item |

Both follow `ReportSchedulerJob`'s existing pattern.

---

## 12. Phases

### Phase 1 — Foundation (the only phase that unblocks everything else)
1. **V512** `points_ledger` + `PointsLedgerService` (award, reverse, summarise) with idempotency.
2. Repoint learner XP/streak/level at the server; keep `localStorage` purely as an offline cache.
3. Add a ledger-backed mode to `LeaderboardService` alongside the existing minutes mode — no
   breakage of the current leaderboard.
4. **V513** plan/slot/item/attempt tables + entities, repos, services.
5. Admin composer: create plan, slot, `READING_HTML` and `QUESTION_OF_DAY` items.
6. Learner Today card + feed + submit + tracking.

### Phase 2 — Depth
`QUIZ` and `GAME` types (with the clamp), reveal flow, weekly leaderboard, `EngagementNotifyJob`
pushes, the teacher tracking dashboard, `POLL`.

### Phase 3 — Scale for teachers
Reusable item library, copy-plan-across-batches, month calendar, templates, streak job.

### Phase 4 — AI planner
Teacher states intent, syllabus and timeline; the planner drafts plans/slots/items into these same
tables as `DRAFT` for review. Draft-and-approve, never autopilot — an AI publishing directly to 500
learners is one bad generation away from an incident.

---

## 13. Risks

| Risk | Mitigation |
|---|---|
| Forged game scores | Clamp to `max_score`, mark unverified, cap leaderboard contribution |
| Teacher HTML XSS | Already solved — opaque-origin sandbox, no `allow-same-origin`. Do not "improve" this by adding it. |
| Future payload leak | `/upcoming` returns metadata only |
| Edited item invalidates scores | Item versioning; attempts pin to version |
| Timezone drift | Wall-clock + snapshotted IANA zone, never stored instants |
| Multi-batch overload | Daily cap, capped items never counted as missed |
| Double-award on retry | `idempotency_key` unique index + unique attempt index |
| Leaderboard demotivation | Bands below top 10, weekly reset, own row always shown |
| Ledger table growth | Append-only and indexed; archive/rollup strategy revisited past ~50M rows |

## 14. Open questions

1. Do reading-type items need a **minimum dwell threshold** per item, or one institute-wide default?
2. Should the daily cap be **per batch** or **global across batches**? Plan assumes global.
3. When a learner **enrolls mid-plan**, do they see past slots as catch-up or start clean? Plan
   assumes start clean.
4. Does the existing **minutes-based leaderboard get retired** once the ledger lands, or do both
   remain as selectable modes?

---

## 15. Build status — Phase 1, 2026-09-13

### Shipped into the working tree (NOT committed, NOT deployed)

**Migrations** (`admin_core_service/src/main/resources/db/migration/`)
- `V512__Create_points_ledger.sql`
- `V513__Create_daily_engagement.sql` — plan, slot, item, attempt
- `V514__Create_engagement_notification_log.sql` — at-most-once push

**Backend** (`admin_core_service/.../features/`)
- `points_ledger/` — entity, repository, `PointsLedgerService` (award / reverse / summary),
  `PointsController` (`/admin-core-service/points/v1/**`)
- `engagement/` — four entities, four repositories, `EngagementScheduleResolver`,
  `EngagementPlanService` (authoring + item versioning), `EngagementLearnerService`
  (feed, open, grade, submit, redaction), `EngagementTrackingService`,
  `EngagementSettingsService`, `EngagementNotifyJob`, admin + learner controllers
- `institute/service/InstituteTimezoneService` — reads `LANGUAGE_SETTING.timezone`
- `leaderboard/` — `Metric.POINTS` / `Window.WEEK` modes reading the ledger, alongside the
  untouched legacy minutes ranking
- `SettingKeyEnums` — `ENGAGEMENT_SETTING`
- `StudentSessionInstituteGroupMappingRepository` — batch recipient lookup

**Learner app**
- `services/engagement.ts`, `services/points.ts`
- `routes/dashboard/-components/engagement/` — `EngagementTodayCard`, `EngagementItemDialog`,
  `engagement-visuals`
- `routes/dashboard/index.tsx` — card mounted at the top of the main column; XP/level/points now
  overlaid from the server with the client computation as fallback

**Admin app**
- `routes/engagement/` — route, plans list, `PlanComposerDialog`, service, types
- `routeTree.gen.ts` regenerated

### Verified
- `mvn compile` clean (backend)
- **28 unit tests pass** — `EngagementScheduleResolverTest` covers day-of-week masks, window
  boundaries, catch-up expiry, reveal timing, percentage clamping and cross-timezone resolution;
  `PointsAccrualJobTest` covers streak length, including gaps, inactive days and measuring to the
  day asked about rather than the latest day
- Both frontends add **zero** TypeScript errors over their baselines (learner baseline 761 under
  plain `tsc`, admin baseline 1)
- ESLint clean on all new files; design gate clean (one permitted, commented inline style)

### Deployed and verified on PROD, 2026-09-13 19:17 UTC

Pushed as `1914a35f47`; backend deployed and confirmed via `~/.kube/vacademy-prod-direct.yaml`:

- Flyway applied V512 → V513 → V514 in 174ms; schema at v514.
- `Started AdminCoreServiceApplication in 42.649 seconds`; 4/4 replicas `1/1 Running`, 0 restarts.
- 54 engagement/points classes present in the running `/app/admin_core_service.jar`.
- No errors attributable to this feature (the one `ERROR` in logs is a pre-existing
  `Catalogue not found for tag`).

**A clean boot is the proof the JPA queries are valid** — Spring Data validates every `@Query` at
startup, so the risk flagged before deploy is retired.

### END-TO-END VERIFIED ON PROD, 2026-09-14

A real plan was authored, answered by a real learner, and scored — against production.

| Step | Result |
|---|---|
| `POST /engagement/admin/v1/plan` | 200; plan stored with `timezone: Asia/Kolkata` snapshotted |
| `GET /engagement/learner/v1/feed` | task served, `state: OPEN`, correct IST→UTC window |
| Answer-key redaction | options served; `correctOptionId` and `explanation` **stripped** pre-reveal |
| `POST .../item/{id}/submit` | 200, graded server-side, `isCorrect: true`, `isVerified: true`, **30 pts** (10 completion + 20 correct) |
| Points summary | `totalPoints: 30`, breakdown `ENGAGEMENT_ITEM → "Daily engagement"` — the first ledger rows in the platform |
| **Double submit, wrong answer** | returned the ORIGINAL attempt unchanged, still 30 pts — no double-award, no overwrite |
| Feed after completion | `items: 0`, `completedToday: 1` |
| `GET .../item/{id}/tracking` | `completedCount 1`, `correctCount 1`, full per-learner row |
| Leaderboard `metric=POINTS` | rank 1 Shreyash Jain **30 pts**, rank 2 Deepankar Dey 0 — roster-scoped, both members present |

**Accrual verified on prod too.** Predicted from the raw activity rows before running it —
12 learner-days, two consecutive pairs for the test learner — then confirmed: `rowsWritten: 14`,
learner total **80** (ACTIVITY 40 / ENGAGEMENT_ITEM 30 / ENGAGEMENT_STREAK 10). Re-running the same
window wrote **0**; widening to 60 days wrote only the 7 genuinely new days. Leaderboard `WEEK` now
reads 30 against `ALL` 90 — a real window, not a copy of all-time.

**Five defects this exposed, every one of which compiled, booted and passed unit tests:**

1-2. Authorization + feed scoping (`b2a6f2f9c1`), below.
3. `::bigint` rewritten by Hibernate to `:bigint` → Postgres syntax error at execution (`4aaf7be365`).
   The repo already used `CAST(... AS bigint)` everywhere for exactly this reason.
4. A named parameter used twice renders as two placeholders, so the `GROUP BY` expression no longer
   matched the `SELECT` expression (`53d13557a6`). The local date is now computed once in a subquery.
   **A psql check with the zone inlined as a literal passes and hides this** — verify native queries
   with `PREPARE`/`EXECUTE` and real placeholders.
5. Backfilled awards were stamped "now", so a 30-day backfill put the learner's whole history inside
   today and inside the current weekly leaderboard window (`463c97c6d0`). Awards now carry the end of
   the local day they were earned. Totals were correct throughout — only their distribution over time
   was wrong, so any check that only compared totals would have passed.

**The original two, fixed in `b2a6f2f9c1`:**

1. The engagement admin endpoints performed **no authorization at all** — `instituteId` was just a
   string the caller supplied, so any authenticated user could publish onto another institute's
   learner home pages, or read and delete their plans. Every handler now requires staff membership.
2. The learner feed queried plans **by batch alone**, with no institute predicate, so a
   cross-institute plan appeared in the feed with its payload. `getItem`/`submit` already checked —
   that asymmetry is exactly what made it readable but un-openable, and what made it visible at all.

Neither would have been found by reading the code or by the unit tests. They surfaced because a
plan was created while naming the wrong institute and the learner was still served it.
- Frontends deploy separately (Cloudflare Pages, not k8s) — confirm the admin and learner bundles
  carry this work before expecting anything on screen.
- The stored QA test accounts return `Bad credentials` as of 2026-09-13; fresh ones are needed for
  a live round trip.

### Known gaps (deliberate, Phase 2+)
- ~~No streak job~~ — **BUILT 2026-09-14** as part of `PointsAccrualJob` (see below).
- ~~No admin tracking UI~~ — **BUILT 2026-09-14.** `/engagement` plans expand to their slots and
  tasks; each task opens a tracking table (per-learner status, correct/wrong, points, time, late
  flag) with completed/correct/accuracy stats. Slots load only on expand.
- Editing an existing plan's slots/items from the UI: the composer creates only. The backend
  supports update and item versioning.
- No `ENGAGEMENT_SETTING` settings screen; defaults apply (cap 5, 80% scroll, 15s dwell,
  unverified score bonus off).
- **Sidebar entry added 2026-09-14**: LMS → Learning Engagement → "Daily Engagement" (`/engagement`),
  with en/hi/fr/ar strings. Before this the route was unreachable except by typing the URL.
### Points accrual — ACTIVITY and streak points enter the ledger (2026-09-14)

`PointsAccrualJob` (nightly 00:30, ShedLock) turns learning activity into ledger rows, so POINTS
becomes a SUPERSET of the legacy minutes ranking instead of a replacement for it.

- Reads a purpose-built lean query (`ActivityLogRepository.findDailyActivityForInstitute`) that
  groups by `(user, institute-local date)`. The existing per-day query joins slide/module/subject/
  session and is far too heavy to run institute-wide nightly. Grouping by user+date also means a
  learner in several batches earns one day's points, not one per batch.
- Award sizes come from `BADGES_REWARDS_SETTING.scoring` — the values already on the Badges &
  Rewards screen, which until now only the browser read. Defaults mirror the learner app's
  `DEFAULT_SCORING`; **keep them in lock-step** or an institute that never opened that screen would
  see its points shift the day accrual starts.
- Idempotency key is `{SOURCE}:{local date}:{userId}`, so re-running is free. Each run reconsiders
  the last 3 days (activity can arrive late) and never settles *today*, which is still in progress.
  Backfilling history is just `accrueForInstitute(instituteId, moreDays)`.
- Skips any institute that has not enabled badges/leaderboard — writing points for an institute
  that never opted into a points economy would surface numbers nobody asked for.

`POST /admin-core-service/points/v1/accrual/run?instituteId=…&days=30` (institute admin) runs the
same accrual on demand, bounded to 365 days. It works **even while the nightly job is disabled** —
deliberately, so accrual can be tried on one institute and inspected before being switched on for
everyone. It is also the backfill tool: awards are idempotent per day, so widening `days` simply
fills in the earlier days it has not written yet.

**OFF BY DEFAULT: `vacademy.points.accrual.enabled=false`.** The first run writes points for every
active learner in every enabled institute, which changes what learners see. That should be a
deliberate switch, not a side effect of a deploy. Set it to `true` when you want accrual to begin.

Batch leaderboards in POINTS mode now scope by the batch **roster** rather than by
`package_session_id` on the ledger rows: engagement points carry a batch, but learner-level awards
(ACTIVITY, streaks) carry none and a package-session filter would silently drop them.

Still NOT in the ledger: **assessment points**. Best-score data lives in assessment_service, so it
needs a cross-service read; until then the `ASSESSMENT` source type is defined but unused.

- The learner leaderboard UI still requests the default ACTIVITY metric. **Deliberately not
  flipped yet.** `points_ledger` is currently written by daily engagement ONLY — nothing writes
  `ACTIVITY`, `ASSESSMENT` or `ENGAGEMENT_STREAK` rows. Flipping today would rank every learner at
  0 and be a regression on the current minutes ranking, which at least separates active learners.
  (b) is now half-built: activity and streak points accrue once `PointsAccrualJob` is switched on.
  Flip the UI to `metric=POINTS` once accrual has run and the numbers look right — verify against a
  real batch before flipping, since that is the moment every learner's visible rank changes.
- Strings in the new UI are not run through i18n.

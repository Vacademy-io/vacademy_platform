# Institute Pulse — v1 Implementation Plan

Institute-wide analogue of Course Pulse. Three rails on one screen: **Content** (what learners
are doing right now, across the whole institute), **Live Sessions** (invited / joined / absent),
**Assessments** (enrolled / submitted / in progress / not attempted), plus a **unified live feed**
that interleaves all three.

Mockup: `docs/INSTITUTE_PULSE_UI.html`.

---

## v1 scope decisions (locked)

**In:**
- KPI strip: In content · Classes on air · Assessments live · Needs attention · Next 60 min
- Content tree (Course → Subject → Module → Chapter → Slide, with live head counts)
- On-air session cards: invited / joined / late / no-show, turnout %
- Just-ended + attendance sync status
- Assessment funnel: not started / in preview / in progress / submitted
- Assessment risk list: stalled, near auto-submit, clock skew, overrun
- Unified live feed (content events + joins + submissions)

**Out of v1** (each has a stated reason, not just "later"):

| Dropped | Reason |
|---|---|
| Meeting infrastructure panel | Explicitly descoped by product |
| Hardest questions right now | Needs `GROUP BY question_id` over `question_wise_marks` for every in-flight attempt. That table has **no index on `attempt_id` or `assessment_id`** — FK constraints only, and Postgres does not index FK columns. Most expensive panel in the mockup by a wide margin |
| Live leaderboard incl. in-flight | Same `question_wise_marks` aggregation; unsubmitted attempts have no `total_marks` yet |
| Avg progress % / avg marks on in-flight cards | Same aggregation, or per-attempt JSON parsing of `attempt_data` / `duration_distribution_json` (both unindexed text) |
| "friction · usually 6m" slide badge | Needs a historical per-slide median. `PulseService.computeContentMap` currently hardcodes `.friction(false).baselineMedianSeconds(null)` — the badge in the mockup has never been implemented. Needs an offline precompute (see Phase 1 §4) |
| "People online" deduped across all 3 rails | Deduping requires shipping **user-id lists** across the service boundary, not counts. Show three separate numbers instead |
| "In the room now" for live classes | Not possible. `ZoomWebhookService` handles only `recording.completed` and `meeting.ended`; `participant_joined`/`participant_left` are an explicit `no-op` because correlating provider participant ids to our users needs SDK `customerKey` wiring. **"Joined" means _ever joined_** — label it that way in the UI |

---

## The two structural facts that shape everything

1. **Content + live sessions live in the `admin_core_service` DB. Assessments live in a
   physically separate `assessment_service` DB.** The Assessments rail is not a join — it is an
   HMAC-signed HTTP fan-out. `assessment_service` runs `maximum-pool-size=5` (3 on dev/stage).
   That pool is the hard server-side ceiling for the whole feature.

2. **Course Pulse is cheap because every query is bounded by the active set** —
   `activity_log.last_seen_at > now() - 5min`, riding `idx_activity_log_last_seen` (V404). Cost
   scales with *concurrent learners*, not table size. Going institute-wide breaks that property
   in exactly three places, all of which are fixed by indexes in Phase 1.

---

# Phase 1 — Capture layer ✅ DONE (2026-07-28)

Shipped as `admin_core_service` **V408__Institute_pulse_indexes.sql** (7 indexes) and
`assessment_service` **V25__Institute_pulse_indexes.sql** (5 indexes).

**V25 was cancelled in production** on its last statement — SQLSTATE 57014, "canceling statement
due to statement timeout" — taking assessment_service down (Flyway records a failed
non-transactional migration and refuses to start). Statements (a)–(d) had applied; (e)
`idx_aim_institute` had not.

Cause: these servers enforce a `statement_timeout`, and `CREATE INDEX CONCURRENTLY` makes two
full passes over the table **and waits out every transaction older than the build** — so its wall
time tracks the oldest open transaction, not table size. A small table is no protection, which is
why the last and smallest index was the one that died.

Fixed forward in **V409** (admin_core) and **V26** (assessment_service). V408/V25 are left byte-
for-byte untouched — they are already in `flyway_schema_history` on deployed environments and
editing them would break their checksums. The retry migrations add two things V408/V25 lacked:

- `SET statement_timeout = 0` — it is a `USERSET` parameter, so a session-level `SET` overrides
  the role/server default. The build still never blocks writers.
- A sweep that drops any of our indexes left `INVALID`. This is the non-obvious one: a cancelled
  concurrent build leaves the index behind marked invalid — the planner ignores it, writes still
  maintain it, and `CREATE INDEX IF NOT EXISTS` sees the name as taken and **skips** it. Without
  the sweep, one timeout leaves a permanently dead index that re-running can never repair.

**What actually happened in production, confirmed from the DB (2026-07-28):**

| Time | Event |
|---|---|
| 06:46:03 | V25 cancelled on statement (e), SQLSTATE 57014. Service down |
| ~06:46–06:48 | Cancelled/interrupted concurrent builds leave **all five** indexes present but `indisvalid = false` |
| 06:48:03 | A new pod re-runs V25. Every `CREATE INDEX IF NOT EXISTS` sees the name taken by the invalid index and **skips**. Migration completes in milliseconds, recorded `success = true`. Pods healthy |

The service recovered on its own — while doing none of the work. This is the trap the sweep
exists for, and it is self-concealing: any "does the index exist" check reports all five present.
The resulting state is strictly worse than before V25 ran:

- Planner ignores invalid indexes → the assessment funnel still seq-scans `student_attempt`;
  zero of the intended win.
- Writes still maintain all five → ongoing write cost on `student_attempt`,
  `assessment_user_registration`, `assessment`, `assessment_institute_mapping` for indexes
  nothing will ever read.
- Re-running V25 can never repair it.

**No manual Flyway repair is needed.** `flyway_schema_history` already shows V25 `success = true`
with a checksum matching the unedited file — which is exactly why V408/V25 were reverted rather
than patched in place. V26 is simply the next migration; deploying it drops the invalid indexes
and rebuilds them.

**Safest application** (avoids the rebuild running under a pod startup probe, which if killed
mid-build lands right back in the invalid state — deploy then no-ops):

```sql
-- check first: a concurrent build cannot finish until the oldest open transaction ends,
-- which is almost certainly what killed the original run
SELECT pid, state, age(clock_timestamp(), xact_start)
FROM pg_stat_activity WHERE state <> 'idle' ORDER BY xact_start LIMIT 5;

SET statement_timeout = 0;
DROP INDEX CONCURRENTLY IF EXISTS idx_aim_institute;
DROP INDEX CONCURRENTLY IF EXISTS idx_assessment_window;
DROP INDEX CONCURRENTLY IF EXISTS idx_aur_institute_assessment;
DROP INDEX CONCURRENTLY IF EXISTS idx_sa_registration;
DROP INDEX CONCURRENTLY IF EXISTS idx_sa_status_start;
-- then the five CREATE INDEX CONCURRENTLY statements from V26
```

Validation of V409/V26: applied to a throwaway database over stub tables matching the real DDL,
against a simulated partial-apply state (11 of 12 indexes present) → 12 of 12, clean idempotent
re-run. The sweep's `DROP` branch was exercised with an inverted predicate; the `indisvalid`
predicate itself could not be tested locally because catalog writes are blocked.
**Still not verified against a real environment** — the `EXPLAIN`-based exit criteria in §1.5
remain outstanding.

**Indexes only. No new columns, no new tables, no write-path changes.**

Every field v1 reads already exists and is already populated. Phase 1 is therefore purely
additive and zero-risk: nothing to backfill, no rollback story, no provider config, and no
existing read path is touched. It ships alone and is verified with `EXPLAIN`.

> **An `actual_start_at` column was considered and rejected.** It would have distinguished
> "0 joined because nobody came" from "0 joined because the teacher never started". Rejected
> because (a) `MIN(created_at)` over `live_session_logs` already answers it, as an index lookup
> on rows the joined-count query fetches anyway; (b) the only case it adds beyond that is a
> teacher alone in the room, which needs a Zoom `meeting.started` webhook subscription; and
> (c) it would populate for app-join and BBB sessions but stay NULL for Zoom-only sessions until
> the attendance sync runs — a field that is NULL for a whole provider class is worse than no
> field, because the UI cannot tell "not started" from "Zoom". See §1.3 for the real issue this
> surfaced.

## 1.1 `admin_core_service` — indexes (non-transactional, own file)

**`V408__institute_pulse_indexes.sql`** — all `CONCURRENTLY`, no other statements in the file.
Flyway runs an all-non-transactional migration outside a transaction but **errors if a
transactional statement is mixed in** — this is why V403/V404 were split.

```sql
-- Institute Pulse read paths. All CONCURRENTLY: live_session_logs and the tracked tables are
-- on the hot learner write path and must not be locked during deploy (matches V84 / V404).

-- (a) THE single highest-impact index in this feature.
--     live_session_logs has a PK and two FK constraints and ZERO secondary indexes. Postgres
--     does not index FK columns, so today EVERY joined-count, no-show list, late-joiner check
--     and join-curve on the Live Sessions rail sequentially scans the entire attendance log --
--     once per on-air session, per poll.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lsl_schedule_type_status
    ON live_session_logs (schedule_id, log_type, status);

-- (b) Live feed: "just joined" events, newest-first within a session.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lsl_session_created
    ON live_session_logs (session_id, created_at DESC);

-- (c)-(g) Live feed at institute scope.
--     The 5-way UNION in PulseRepository.getFeed filters `created_at > :sinceCutoff`, but the
--     tracked tables are indexed on activity_id ONLY. At batch scope the planner gets a small
--     driving set from idx_cpsm_package_session_id; institute-wide it does not, and this panel
--     alone would dominate the query budget.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_qst_created_at
    ON question_slide_tracked (created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quiz_sqt_created_at
    ON quiz_slide_question_tracked (created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ast_created_at
    ON assignment_slide_tracked (created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_asmt_st_created_at
    ON assessment_slide_tracked (created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_coding_submissions_submitted_at
    ON coding_submissions (submitted_at DESC);
```

**Already indexed — verified, nothing to add:**

| Read path | Existing index |
|---|---|
| Classes on air | `idx_live_session_institute_id_status (institute_id, status)` |
| Next 60 min | `idx_session_schedules_upcoming_optimized (meeting_date, start_time)` |
| Invited (BATCH expansion) | `idx_live_session_participants_source_optimized` + `idx_ssigm_package_session_id_status` |
| Enrolled denominator | `idx_ssigm_institute_id_status` |
| Content tree traversal | `idx_cpsm_package_session_id`, `idx_chapter_to_slides_slide_id`, `idx_activity_log_last_seen` |
| Just-ended / sync-pending | `session_schedules.last_attendance_sync_at` (direct column read) |

## 1.2 `assessment_service` — indexes (non-transactional, own file)

**`V25__institute_pulse_indexes.sql`** — all `CONCURRENTLY`.

`student_attempt` has **no secondary index of any kind** — PK plus two FKs. The whole
Assessments rail currently has no usable access path into it.

```sql
-- Institute Pulse: the assessment rail's access path.
--
-- assessment_user_registration.institute_id exists and is populated, so the institute scope
-- can be applied at the registration level directly -- assessment_institute_mapping is NOT on
-- the hot path for the funnel counts. (a) is therefore the entry point, (b) the join.

-- (a) Institute scope + enrolled denominator + the driving set for the funnel.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_aur_institute_assessment
    ON assessment_user_registration (institute_id, assessment_id);

-- (b) registration -> attempt. Unindexed today, so every funnel count seq-scans the largest
--     table in this service, against a 5-connection pool.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sa_registration
    ON student_attempt (registration_id);

-- (c) The risk list (stalled / near auto-submit / clock skew / overrun) and, as a bonus, the
--     hourly LearnerSchedulerRunner cron, which today full-scans student_attempt via
--     findByStatusNotIn(['ENDED']) once an hour.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sa_status_start
    ON student_attempt (status, start_time);

-- (d) "Assessments live now" discovery, and the post-window backlog.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assessment_window
    ON assessment (bound_start_time, bound_end_time)
    WHERE status <> 'DELETED';

-- (e) Only needed if a read path has to go institute -> assessment rather than
--     institute -> registration. Cheap; include it so the planner has the choice.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_aim_institute
    ON assessment_institute_mapping (institute_id);
```

**Already usable:** `assessment_user_registration_unique (assessment_id, user_id)`,
`idx_attempt_status (attempt_id, status)` on `ai_evaluation_process` for the AI-eval backlog.

## 1.3 Known capture-layer limitation: Zoom attendance freshness

Surfaced while evaluating the rejected column, and it is the one real gap in this rail. There
are **two** attendance write paths into `live_session_logs`:

| Path | Freshness |
|---|---|
| Live at join — `LIveSessionAttendanceService`, `GuestController`, the app join endpoint (BBB + in-app joins) | Row exists the moment the learner joins. Accurate in real time |
| Post-hoc sync — `ZoomAttendanceService`, `GoogleAttendanceService`, driven by the cron on `session_schedules.last_attendance_sync_at` | Rows appear only after a sync pass |

So **for a Zoom-hosted class in progress, invited/joined/absent under-reports** until the sync
cron catches up. This is a capture-layer fact, not a query problem — no index fixes it.

**v1 handling (UI honesty, no schema change):** the on-air card already has
`last_attendance_sync_at` available. For provider-synced sessions, show the counts with an
explicit "as of HH:MM" freshness stamp rather than presenting them as live. For BBB and in-app
joins, show them as live. Do not average the two into one undifferentiated number.

Closing the gap for real means persisting Zoom `participant_joined` — see post-v1 item 1.

## 1.4 New tables — none in v1

Two candidates were considered and both are deliberately deferred, with an explicit trigger for
revisiting:

| Candidate | Would enable | Deferred because | Revisit when |
|---|---|---|---|
| `slide_dwell_baseline` (slide_id, median_seconds, sample_count, computed_at) — nightly job | The "friction · usually 6m" badge | It is a nightly batch job plus a new job runner, for one badge; nothing else in v1 depends on it | Product asks for the friction badge specifically |
| `institute_assessment_pulse_snapshot` in `assessment_service` — 60s cron writes one row per live assessment | Makes the funnel a single indexed row-read instead of a live aggregation, insulating it from the 5-connection pool | With §1.2's indexes plus a 30s server cache the live query is affordable; a snapshot table adds a cron, a staleness story, and a second source of truth | Load testing shows the assessment endpoint's p95 exceeding the poll interval, or pool saturation under concurrent admins |

## 1.5 Phase 1 exit criteria

- [ ] `EXPLAIN (ANALYZE, BUFFERS)` on the joined-count query for one on-air session shows an
      index scan on `idx_lsl_schedule_type_status`, not a seq scan
- [ ] `EXPLAIN` on the institute-wide 5-way feed UNION shows index scans on all five
      `created_at` indexes
- [ ] `EXPLAIN` on the funnel query shows `idx_aur_institute_assessment` → `idx_sa_registration`,
      no seq scan on `student_attempt`
- [ ] Hourly `LearnerSchedulerRunner` runtime measurably drops (free win from §1.2c)
- [ ] No regression in Course Pulse latency (same indexes, strictly additive)
- [ ] Index build completed without blocking writes on `activity_log` / `live_session_logs` /
      `student_attempt` (all `CONCURRENTLY`)

---

# Phase 2 — Backend read layer

New package `admin_core_service/features/institute_pulse/`, modelled on `course_pulse/` but
**not** by parameterising it — the batch-scoped queries stay untouched.

## 2.1 Endpoints — one per rail, deliberately not one aggregate

```
GET /admin-core-service/institute-pulse/summary      ?instituteId          cache 10s
GET /admin-core-service/institute-pulse/content-map  ?instituteId          cache 10s
GET /admin-core-service/institute-pulse/live-classes ?instituteId          cache 10s
GET /admin-core-service/institute-pulse/feed         ?instituteId&windowMinutes  cache 10s

GET /assessment-service/institute-pulse/summary      ?instituteId          cache 30s
```

Splitting them is the single most important server-side decision. One combined endpoint means
the assessment query — against a 5-connection pool — dictates the latency and the failure mode of
the content and live-class rails too. Separate endpoints give independent failure domains and let
the assessment rail carry a longer TTL than the rest.

**The assessment rail is called DIRECTLY by the frontend, not proxied through admin_core.**
The dashboard already reaches assessment_service this way for ~60 endpoints: there is a single
`BACKEND_BASE_URL` with path routing (`/assessment-service/…`, `/admin-core-service/…`,
`/community-service/…`) and one JWT, so direct calling needs no new host, CORS rule, or auth
story. It is better on every axis:

- **Faster** — one hop, not two. Proxying pays the round trip twice on every poll.
- **Cheaper** — proxying blocks an admin_core Tomcat request thread for the full duration of the
  assessment round trip, on every poll, for every admin, purely to wait. It also deletes the HMAC
  client, its signing, and its response parsing from the codebase.
- **Correct cache placement, the real argument** — the binding constraint is assessment_service's
  5-connection pool. A cache in admin_core is per-JVM, so N replicas mean N misses against that
  pool and any other caller bypasses it entirely. Caching *inside* assessment_service means every
  caller shares one entry and the pool is defended by the service that owns it.

Proxying would only win if the two datasets had to be joined or deduplicated server-side — that
was the "people online, deduped across all 3 rails" number, which is already dropped from v1.

**Consequence:** the endpoint is user-facing, so `instituteId` is an untrusted request param
returning institute-wide data. See §2.4.

## 2.2 Query work

**`InstitutePulseRepository`** — three genuine rewrites, not `WHERE`-clause swaps:

1. **Active-learner set.** Replace the `chapter_package_session_mapping.package_session_id = :batchId`
   filter with a join through `student_session_institute_group_mapping` on `institute_id`.
   **Correctness trap:** a chapter mapped into several batches multiplies the learner's row, so
   head counts inflate. Batch scope hid this; institute scope exposes it. The `DISTINCT ON
   (al.user_id)` must be applied *before* the mapping join, or every count in the content tree
   is wrong.

2. **Needs-help counts must stop being correlated subqueries.** `PulseRepository.getActiveLearners`
   runs **three correlated subqueries per active learner**. At 50–200 concurrent that is fine;
   at 2,000 institute-wide it is ~6,000 subqueries per cache miss. Rewrite as a single grouped
   join over the active set, or compute struggle only for the top-N rows actually surfaced.

3. **Content tree gains a Course/Batch level** above Subject via a `package_session → package`
   join, and the roster cap moves into SQL rather than being applied in Java after materialising
   every row.

**`assessment_service` — new package `features/institute_pulse/`** (controller / service /
repository / dto), serving `GET /assessment-service/institute-pulse/summary?instituteId=` with
funnel counts + the risk list in one payload. **One query per poll, per institute** — never one
per assessment. No HMAC client on the admin_core side; the frontend calls it directly (§2.1).

Two native queries:

1. **Live assessments + funnel**, one query for the whole institute:
   ```
   assessment_user_registration (institute_id = ?)      <- idx_aur_institute_assessment
     -> assessment (bound_start_time <= now <= bound_end_time, status <> 'DELETED')
     -> LEFT JOIN student_attempt ON registration_id    <- idx_sa_registration
   GROUP BY assessment_id, attempt status
   ```
   Buckets derive in Java from the grouped counts: NOT_STARTED = registrations with no attempt
   row (this is what the LEFT JOIN buys — "not attempted" without a second query), then
   PREVIEW / IN_PROGRESS / SUBMITTED from `status`.

2. **Risk rows**, bounded to live attempts, capped server-side (~50 by severity — an institute
   can have thousands live). All columns already exist:

   | Rule | Expression |
   |---|---|
   | Stalled | `now() - server_last_sync > 2min` |
   | Near auto-submit | `start_time + max_time - now() < 5min` |
   | Clock skew | `server_last_sync - client_last_sync` |
   | Overrun | `now() > start_time + max_time` and not submitted |

**Do not touch `question_wise_marks`.** That is the v1 line — see the scope table.

## 2.3 Caching and polling

- Reuse the `PulseCache` pattern (`ConcurrentHashMap`, TTL, non-personalised keys). Institute
  payloads are identical for every admin of that institute, so sharing is safe and is what makes
  N concurrent admins cost the same as one.
- **Assessment TTL 30s, everything else 10s.** The assessment cache TTL must be ≥ the poll
  interval or the pool sees one round trip per admin per poll.
- **Drop the FE poll to 30s** for institute scope. The mockup's 15s is inherited from the
  single-batch view; institute-wide, per-refresh cost is roughly an order of magnitude higher.
- `PulseCache` is per-JVM, so each `admin_core` replica pays one miss per TTL. Fine at current
  replica counts; if that changes, the cache moves to Redis, not the query.

## 2.4 Authorization — required, not optional

`PulseController` takes `@RequestAttribute("user") CustomUserDetails` but never checks the caller
against the batch. At batch scope that is a limited exposure; at institute scope `instituteId` is
an unvalidated request param that returns institute-wide learner activity — and with the
assessment rail called directly by the browser (§2.1), that endpoint is user-facing too.

**Every one of the five endpoints must verify the caller's membership of the requested institute
before serving.** Cheap now, awkward to retrofit once the frontend is polling all five.

## 2.5 Config

New `institute-pulse.*` keys mirroring `pulse.*` so the two features tune independently
(`active-window-seconds`, `offline-window-seconds`, `roster-limit-*`, `feed-window-minutes-*`,
`cache-ttl-seconds`, plus `assessment-cache-ttl-seconds` and `assessment-timeout-ms`).

---

# Phase 3 — Frontend

`frontend-admin-dashboard`, new route under the institute dashboard.

- Five query hooks, one per endpoint, each with its own `refetchInterval` (30s; 60s for
  assessments). Background refetch stays disabled, matching `pulse-services.ts`.
- Tabs per the mockup **minus** the Meeting Infrastructure panel and the four dropped panels
  from the scope table. The Attention tab is assembled client-side from data the other rails
  already return — it is not a sixth endpoint.
- Each rail renders independently: an assessment-rail error shows an inline degraded tile, it
  does not blank the page.
- **Copy fixes carried from the analysis:** label live-class attendance "Joined (ever)", not
  "In the room" — we have no leave events. Where the scheduled window is open and no attendance
  row exists yet, show "not started yet" rather than a 0% turnout donut. For provider-synced
  (Zoom/Google) sessions, stamp the counts "as of HH:MM" from `last_attendance_sync_at` per §1.3.

---

## Sequencing

Phase 1 ships alone and is verifiable with `EXPLAIN` — no user-visible change, and the
`student_attempt` indexes pay for themselves immediately via the hourly cron. Phase 2 and 3 can
overlap once the endpoint contracts are fixed.

## Post-v1, in priority order

1. Persist Zoom `participant_joined` / `participant_left` (needs SDK `customerKey` wiring to
   correlate provider participant ids to our users). Fixes **both** open Live Sessions gaps at
   once: the §1.3 Zoom freshness lag, and the *ever joined* vs *in the room now* distinction.
   Two `case` arms plus the correlation work.
2. `slide_dwell_baseline` → the friction badge.
3. `question_wise_marks` indexes → unlocks hardest-questions and the in-flight leaderboard.

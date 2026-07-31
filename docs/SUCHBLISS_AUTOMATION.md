# SuchBliss Automation — Reference & Runbook

**Institute:** SuchBliss (`54d0a67f-8a13-4137-872d-f62d68ef7971`) · **Trial batch (package session):** `66b6da76-2958-4581-81f1-2d3babe98dd5` · **Learner portal:** member.suchbliss.com
**Built:** 2026-07-23 → 2026-07-29 · **Status:** LIVE in production since 2026-07-29 05:00 IST

This documents the daily class automation for SuchBliss's 14-day trial (modeled on the
Aanandham/"Holistic" blueprint), the engine changes that made it possible, the operational
runbook, and every gotcha found while building it. Companion docs:
[WORKFLOW_PLATFORM_PROGRESS.md](WORKFLOW_PLATFORM_PROGRESS.md) (engine reference),
[WORKFLOW_AI_ASSIST_DESIGN.md](WORKFLOW_AI_ASSIST_DESIGN.md) (AI drafter).

---

## 1. The learner experience (end to end, all proven live)

```
Enroll via invite (any of the 5 invite codes → trial batch)
   │
   ▼ every morning 5:00 AM IST          (sb_daily_session_creator_001)
10 live sessions created for the day: 5:30/6:30/7:30/8:30/9:30/11:00 AM,
12:00 PM, 5:30/6:30/8:00 PM — YouTube embed, whole batch as participant
   │
   ▼ every morning ~5:30 AM IST         (sb_daily_reminder_001, cron 5:20 → 5:30 tick)
WhatsApp per learner on trial day 1–14 (template demo_utility):
all 10 timings + "Day N: <topic>" + their unique link
   │
   ▼ learner taps the unique link (any time of day)
https://member.suchbliss.com/study-library/live-class/<username>
→ passwordless trusted login → attendance marked → AUTO-JOIN into whichever
session is live right now (YouTube embed). No list page, no clicks.
   │
   ▼ every night 9:30 PM IST            (sb_weekly_attendance_001 — despite the id, it is DAILY)
WhatsApp attendance recap (template demo_attendance_dailypractice):
week-so-far circles 🅜 🅣 Ⓦ 🅣 Ⓕ Ⓢ Ⓢ (filled = attended) + summary sentence
```

## 2. The three production workflows (DB rows, Aanandham-style)

All three live as hand-staged rows in `workflow` / `node_template` / `workflow_node_mapping`
/ `workflow_schedule` (no migration — same as Aanandham's). Stagers preserved at
`c:\tmp\stage_suchbliss_daily_workflows.py`, `c:\tmp\rework_attendance_nightly.py` (dev laptop).

### 2.1 `sb_daily_session_creator_001` — "SuchBliss Daily Session Creator (5:00 AM)"
Cron `0 0 5 * * ?` Asia/Kolkata · 5 nodes:

1. **TRIGGER** — `outputDataPoints` hold the entire day's config as data: `psId`, and
   `liveSessions[]` (10 items; each has title, SpEL `ZonedDateTime` start/lastEntry
   (start + 50 min), `java.sql.Time`/`Date` strings for the schedule, YouTube
   `defaultMeetLink`, `linkType 'youtube'`, `sessionStreamingServiceType 'embed'`,
   `waitingRoomTime 10`, `timezone Asia/Kolkata`, `status 'LIVE'`).
   **Meeting links are edited here** — one per timing; changing them later = editing this
   node's config (no code, no restage).
2. **ACTION ITERATOR / OBJECT_PARSER** on `liveSessions` — evaluates every string field
   in-place (SpEL → real objects).
3. **ACTION ITERATOR / QUERY `createLiveSession`** — one session per item.
   ⚠️ `createdByUserId` (we pass `'system'`) is REQUIRED — `live_session.created_by_user_id`
   is NOT NULL and its omission fails **silently** (see §5 gotchas).
4. **ACTION ITERATOR / QUERY `createSessionSchedule`** — today's schedule per session
   (`meetingDate` = today IST, times from the item, `recurrenceType 'once'`).
5. **ACTION ITERATOR / QUERY `createSessionParticipent`** — ONE `BATCH` participant per
   session (`sourceId` = trial PS id). The whole batch sees all 10 sessions; no per-learner rows.

### 2.2 `sb_daily_reminder_001` — "SuchBliss Daily Class Reminder (5:20 AM)"
Cron `0 20 5 * * ?` Asia/Kolkata → actually delivered at the **5:30 tick** (see §4) · 5 nodes:

1. **TRIGGER** — config data: `psIds`, `statusList ['ACTIVE']`,
   `templateName 'demo_utility'`, `lang 'en'`, `timingsText` (the full
   "Morning 5:30, 6:30 … | Evening …" string — edit copy here), `topicsList[14]`,
   `updatesList[14]` (the per-day calendar copy — edit here).
2. **QUERY `getSSIGMByStatusAndPackageSessionIds`** → `ssigmList` (per learner:
   `userId, name, mobileNumber, username, enrolledDate, …`).
3. **ACTION / SPEL_EVALUATOR `trialDay`** — **enrollment-based**: day 1 = the enrollment
   day itself, counted on the IST calendar
   (`ChronoUnit.DAYS.between(enrolledLocalDate, LocalDate.now(Asia/Kolkata)) + 1`).
   ⚠️ Deliberately NOT the roster query's built-in `learningDay` (that one counts in UTC
   and is off by one at 5:30 AM IST).
4. **ACTION / SPEL_EVALUATOR `whatsappData`** — only for `trialDay` 1..14; builds
   `demo_utility` vars: `{{1}}`=name, `{{2}}`=timingsText, `{{3}}`='Day N: topic',
   `{{4}}`=update line, `{{5}}`='See you on the mat!', `{{6}}`=unique link
   `'https://member.suchbliss.com/study-library/live-class/' + username`.
5. **SEND_WHATSAPP** — iterates learners with non-empty `whatsappData`.

### 2.3 `sb_weekly_attendance_001` — "SuchBliss Daily Attendance Recap (9:30 PM)"
Cron `0 30 21 * * ?` Asia/Kolkata (exact tick) · 9 nodes · template
`demo_attendance_dailypractice` (3 vars):

TRIGGER (config incl. `filledMarks`/`outlineMarks` circled-letter arrays, `weekDates`
Mon..Sun of the current week, **`targetUserIds` allowlist** — currently the 2 test users;
**set to `null` to open to every day-1..14 learner**) → roster QUERY → attendance QUERY
(`fetch_batch_attendance_report`, daysBack 7) → SPEL `trialDay` → SPEL `myAtt` (join
report→learner via `studentId == userId`; the report aliases `s.user_id AS studentId`) →
SPEL `circles` (per weekday: attended → filled 🅜, else outline Ⓜ; `attendanceStatus ==
'PRESENT'`) → SPEL `attendedDays` (distinct attended dates this week) → SPEL
`whatsappData` (`{{1}}` name, `{{2}}` circles, `{{3}}` = ENTIRE sentence:
"You practiced N days this week. <tiered closing>" — never "N of M classes";
totalSessions ≈ 70/week with 10 daily sessions) → SEND_WHATSAPP.

## 3. Auto-join (learner app)

Commit **`83625cecc`** (frontend-learner-dashboard-app): on
`/study-library/live-class/<username>`, a session that is **live right now always
auto-joins** — the selection dialog only appears for a genuine tie (2+ simultaneously
live) or when everything active is still in its waiting-room window.
- With the current 10-minute waiting windows and hour-apart sessions, at most one session
  is active at a time — so the pre-change app behaves identically. **Deploy is still
  recommended** before widening waiting windows.
- Waiting-room math: join window opens `waitingRoomTime` (10) minutes before start; a
  learner clicking ~1 h early lands on the upcoming-sessions list (no waiting room).
- Login is the passwordless trusted path (`EMAIL_OTP_VERIFICATION_ENABLED=false`);
  attendance is marked on join.

## 4. Scheduler mechanics you MUST know

- **`WorkflowExecutionJob` ticks every 15 minutes** (`0 0/15 * * * ?`) — a schedule fires
  at the first :00/:15/:30/:45 tick after `next_run_at`. Hence 5:20 → 5:30 delivery.
  Pick cron times on tick boundaries when exact timing matters.
- `workflow_schedule.next_run_at` is stored as **UTC wall time** in a `timestamp` column;
  cron recalculation honors the schedule's `timezone` (verified: recalcs landed on exact
  IST slots across days).
- To fire a scheduled workflow immediately: `UPDATE workflow_schedule SET status='ACTIVE',
  next_run_at=now()` and wait for the next tick. To park it: `status='INACTIVE'`.
- Executions are idempotent per (schedule, slot) — key `workflow_schedule_<id>_<millis>`.

## 5. Gotchas discovered (each cost us a live debugging session)

1. **`createLiveSession` silently no-ops without `createdByUserId`** — NOT NULL column;
   handler catches the save exception and returns an error map, which ACTION/ITERATOR
   counts as SUCCESS (`successCount` includes inner error maps!). Engine improvement TODO.
2. **`createSessionSchedule` returns no `scheduleId`** (only `{"SESSION_SCHEDULE":"SUCCEESS"}`,
   typo included) — fine for this design; blocks schedule-scoped links if ever needed.
3. **`SEND_WHATSAPP` `templateVars` were passed VERBATIM to Meta** (never resolved) until
   commit `6c6bc72ab` — learners received literal `#item['full_name']`. Values now resolve:
   `#`-SpEL (with `#item` bound) → item-field name → literal.
4. **`SpelEvaluator` lacked a `MapAccessor`** until `4297fd342` — dot-access broke after any
   persisted-DELAY resume (context beans → LinkedHashMaps).
5. **Roster `learningDay` counts in UTC** — off by one at IST early morning; compute days
   in SpEL with `LocalDate.now(Asia/Kolkata)`.
6. **Timestamps in scripts must be computed, never hardcoded** — a stale "tomorrow" constant
   made a resume_at land in the past and double-sent a drip day.
7. Participant `source_type` must be uppercase `'USER'`/`'BATCH'`; `live_session` status
   `DRAFT` is still learner-visible; sessions/schedules queries have no date filter —
   creator is NOT idempotent (double-fire would duplicate sessions; per-slot execution
   idempotency is the guard).
8. **Never press Test Run** on these workflows — mutating queries (session creation,
   participants) execute for real; SEND_WHATSAPP via COMBOT-style config has no dry-run gate.
9. Meta template variables cannot contain newlines; multi-line visuals = one variable per
   line (circle row) with static text around it. Meta rejected Aanandham's emoji-heavy
   multi-time bodies as UTILITY; plain bodies pass.
10. Templates: `demo_utility` (6 vars) is reused for the daily reminder — the timings list
    rides in `{{2}}`, so NO new template was needed. All learner-visible copy is variable-
    based → copy changes are workflow-config edits, never Meta re-approvals.

## 6. Testing methodology (reusable)

- **Time fast-forward for drip/delay workflows:** update the WAITING
  `workflow_execution_state.resume_at` to `now()` per hop; the real resume job (2-min tick)
  does everything else. 14 days walked in ~30 min; caught the templateVars bug.
- **Scoped live tests for scheduled workflows:** stage a temporary clone whose payload is
  allowlisted to one user (or whose SEND `on` filter is `.?[false]` for a no-send pipeline
  check), arm `next_run_at=now()`, let the real scheduler fire it, then retire the clone.
- **Verification data:** `workflow_execution_log` per node (⚠️ iterator success counts lie
  — see gotcha 1); `notification_service.notification_log` has the exact outbound payload
  (`bodyParams`) plus sent/delivered/read events per message.
- Stale test learners are silenced by pushing `ssigm.enrolled_date` far into the past
  (outside the 1–14 window) — no enrollment/status changes needed.

## 7. Current production state (as of 2026-07-29)

| Item | State |
|---|---|
| Morning creator + reminder | ACTIVE, self-sustaining (verified live 2026-07-29: 10 sessions at 5:00:00, 2 messages at 5:30:01) |
| Nightly recap | ACTIVE 9:30 PM, **allowlisted to 2 test users**; template `demo_attendance_dailypractice` was PENDING Meta review at activation |
| Old 14-day drip (`9c4bfb7e…`) | Retired (workflow + trigger INACTIVE, pending states cancelled) — superseded by the daily reminder |
| Auto-join FE (`83625cecc`) | Committed + pushed, **deploy pending** |
| Test learners | All silenced except `testmanshutrials` (0d1b25d9…, day anchor Jul 28) and `Test Shreyash trial` (7d622482…, Jul 27) |
| Engine fixes | `4297fd342`, `6c6bc72ab`, `9e0f3ab7b` (revert of question-suppression), `83625cecc` on `feature/onboarding-flow` |

## 8. Known open items / next steps

- Enrollment welcome + T-1 Sunday reminder + day-13 cancel notice + day-14 autodeduction
  flows (in design — see team discussion).
- **Day-anchor decision:** daily reminder currently counts day 1 = enrollment day (set for
  test users). The welcome/T-1 messaging ("starts next Monday") implies Monday-anchored
  cohorts — pick one before real learners enroll.
- Open recap to all learners: set `targetUserIds` to `null` in `sb_att_trigger` config.
- Custom URL buttons (YT/IG/FB) on templates; URL shortener; per-timing meeting links.
- Admin-dashboard editability pass for the hand-staged nodes (generic JSON editor today).
- Deploy learner app; `OPENROUTER_API_KEY` on admin-core pod (AI drafter only).

# Mentorship

End-to-end reference for the mentorship feature: what it does, how it is built, what
it deliberately reuses, and where the edges are.

Mentorship started as admin-push only — an admin promoted a team member and pushed
students onto them. It is now a full loop: learners can find and request mentors,
capacity is enforced, sessions resolve to an outcome, learners rate them, and admins
get a dashboard over the whole thing.

---

## 1. Architecture at a glance

The load-bearing decision: **mentorship owns relationships and outcomes; it owns no
scheduling.** A mentorship session *is* a `booking_instance` created by the existing
booking module, hosted by the mentor, with the existing Meet link, reminders and
calendar sync. Mentorship adds facts *beside* that row, never a parallel system.

```
auth_service.users ──┐
                     ├─► mentor ──────────────► booking_page  (availability, slots, buffers)
                     │     │                         │
                     │     │                         ▼
                     │     │                   booking_instance   ← THE SESSION
                     │     │                         │  (CONFIRMED / CANCELLED / RESCHEDULED)
                     │     ▼                         │
                     │  mentor_student_assignment    ├─► mentor_session_record    (mentor: outcome + notes)
                     │     ▲                         └─► mentor_session_feedback  (learner: rating + comment)
                     │     │
                     └──► mentor_request ────────────┘  (learner asks → admin approves → creates the assignment)
```

### Why outcome does not live on `booking_instance.status`

`booking_instance` is shared with non-mentorship bookings (lead calls, counselling).
Its status describes the **appointment** — was the slot kept. Mentorship needs to
know whether the **session** happened and what came of it. Those are different
questions: a `CONFIRMED` booking can still be a `NO_SHOW`.

Keeping them separate means non-mentorship bookings are completely unaffected, and
the displayed lifecycle is derived rather than stored twice:

```
cancellation  >  recorded outcome  >  time
```

So a cancelled session reads `CANCELLED` even if someone recorded an outcome, and a
past session nobody recorded reads `AWAITING_REVIEW` rather than silently counting
as delivered.

---

## 2. Data model

| Table | Migration | Holds |
|---|---|---|
| `mentor` | V411, +V417, +V454 | The mentor persona: display name, title, bio, photo, booking page, Google account, **expertise tags, max_mentees, is_discoverable** |
| `mentor_student_assignment` | V411 | Mentor↔student pairing. Many-to-many, soft-deleted, records method and who assigned |
| `mentorship_notification_log` | V434 | Idempotency ledger for scheduled notifications |
| `mentor_request` | V454 | A learner asking for a mentor; `mentor_id` NULL means "any available" |
| `mentor_session_feedback` | V456 | Learner's 1–5 rating + comment for one session |
| `mentor_session_record` | V457 | Mentor's outcome (`COMPLETED`/`NO_SHOW`), topic and notes for one session |
| `booking_instance` | (booking module) +V458 | The session itself. V458 adds the double-booking guard |

### Constraints that matter

Enforced in the **database**, not only in service code:

- `uq_mentor_institute_user` — a user is a mentor once per institute (soft-deleted rows release the slot)
- `uq_msa_mentor_student` — one live pairing per (mentor, student); multiple mentors per student stay possible
- `uq_mentor_request_pending` + `uq_mentor_request_pending_any` — one live request per (student, mentor), and one open-ended request per student
- `ck_msf_rating` — rating is 1–5; `uq_msf_booking_student` — one rating per learner per session
- `ck_msr_outcome` — outcome is `COMPLETED` or `NO_SHOW`; `uq_msr_booking` — one record per session
- `uq_booking_host_slot` (V458) — one live booking per (host, exact start)

---

## 3. Feature areas

### 3.1 Mentors and assignment

There are two ways to get a mentor, both in the same **Add mentor** dialog:

- **From your team** — promote an existing member (grants the auth `MENTOR` role
  best-effort, creates the profile row).
- **Invite by email** — for someone not in the institute yet. This reuses the
  existing `handleInviteUsers` invitation with `roleType: ['MENTOR']`, takes the
  returned user id, and creates the mentor row against it. No second trip to the
  Teams tab, and no second invitation mechanism.

If the invite succeeds but the mentor row fails, the person is left as an invited
team member — recoverable from the team list, and better than dropping the
invitation on the floor. Everything past "who is this" (photo, title, bio,
expertise, capacity) is folded behind **Add photo, expertise and capacity**, since
all of it is optional and editable afterwards.

Students are assigned manually or by **bulk round-robin**, which distributes by
least-current-load and skips anyone already paired.

**Capacity** (`max_mentees`, NULL = unlimited) is enforced on every path: manual
assign, round-robin, request creation, and request approval. Results report three
separate outcomes so no student silently disappears from the report:

```
assigned + skipped + capacityFull == students submitted
```

`skipped` means already paired with that mentor; `capacityFull` means no candidate
had room. Every existing mentor has `max_mentees = NULL`, so behaviour is unchanged
until a cap is set.

### 3.2 Discovery and requests (the pull direction)

Mentors an admin marks `is_discoverable` appear in the learner's **Find a mentor**
directory, searchable by name, title, bio and expertise tags. A learner requests one
(or leaves it open-ended); an admin approves or declines with a reason.

Approval routes through the **ordinary `assignManual` path**, so the pairing, its
audit fields and the "you have a new mentor" notice are identical to an admin-made
one — there is no second assignment code path. An approval is only recorded if a
pairing row exists afterwards; otherwise it rolls back and the request stays
`PENDING`, so a learner is never told "approved" while having no mentor.

Removing a mentor releases their pending requests as `CANCELLED` (not `DECLINED` —
it is not a judgement on the learner), freeing them to ask someone else.

`is_discoverable` defaults **false**, so no existing mentor becomes learner-visible
without an explicit opt-in.

### 3.3 Sessions

Booked through the existing booking page. After it happens the mentor records
`COMPLETED` or `NO_SHOW` plus optional topic and notes; the learner is prompted to
rate it 1–5.

- Only the invitee may rate; only the hosting mentor may record.
- Only after the session has started, and never for a cancelled one.
- Re-rating and re-recording revise in place rather than adding a second row.
- Mentor averages are **derived per read, never stored**, so deleting a rating
  genuinely removes its effect.

### 3.4 Cancellation and rescheduling

Previously reachable only via the invitee's emailed manage-token link. Now also
available to admins (any session) and mentors (their own).

The token lookup was split out of the operations (`cancelInstance` /
`rescheduleInstance`), so the emailed link and the authenticated endpoints run
**exactly the same code** — same teardown of the live session, reminders and
calendar event, same notification. Authorization is the only difference.

Rescheduling claims the old row under its optimistic `@Version` before creating the
replacement, so two concurrent reschedules cannot both produce one; a failure to
create the replacement restores the previous status. The replacement records
`reschedule_of_instance_id`, so history stays linked rather than duplicated.

### 3.5 Double-booking

Booking creation validated the slot and then inserted, with nothing in between — two
simultaneous requests for one mentor slot could both pass the check. V458 adds a
partial unique index over live bookings so the **database** decides the race; the
insert flushes immediately and the loser's constraint violation is translated into
the same *"This slot is no longer available"* message the pre-check produces.

The migration checks for pre-existing duplicates first and **warns rather than
failing**, so it can never take a deploy down.

> ⚠️ If production already contains duplicate `(host_user_id, scheduled_start_utc)`
> pairs among live bookings, the index is skipped and you get the warning instead of
> the protection. Resolve those rows, then create the index manually.

### 3.6 Notifications

Six triggers, each independently gated per channel (email / in-app / push /
WhatsApp) by the institute's `MENTORSHIP_SETTING` blob and editable from Settings:

| Trigger | Goes to | Default |
|---|---|---|
| `assignment` | learner + mentor | on |
| `booking` | learner | on (email off — the booking page already emails) |
| `cancellation` | learner | on |
| `session_reminder` | learner | on, 24h before |
| `checkin_reminder` | learner | **off** (opt-in — it emails out of the blue) |
| `request` | mentor on submit, learner on decline | on |

Approval deliberately sends nothing extra — the assignment it creates already fires
"You have a new mentor".

Scheduled triggers run under ShedLock with a claim-before-send ledger, so a crash
mid-send drops one notification rather than double-sending.

---

## 4. Screens

### Admin (`/mentorship/*`)

| Route | Purpose |
|---|---|
| `dashboard` | KPIs, session outcomes, mentor workload, needs-attention, upcoming sessions |
| `mentors` | Table: mentor, expertise, assigned students, upcoming sessions, capacity, status, actions |
| `mentors/$mentorId` | One mentor: overview, students, availability, sessions, feedback |
| `sessions` | Table of every session, filterable by lifecycle and mentor |
| `requests` | Learner request queue — pending / approved / declined / withdrawn |
| `my-mentorship` | A mentor's own view: profile, calendar, booking link, sessions to record |

Navigation is the sidebar group (Overview / Mentors / Sessions / Requests / My
Mentorship) and nothing else. Each screen opens with a `MentorshipPageHeader` —
title, one line of subtitle, its own actions — so there is no second navigation
strip repeating what the sidebar already shows.

`mentors/$mentorId` is a route rather than a modal: the tab lives in the URL
(`?tab=sessions`), so a mentor's session history is linkable and the back button
does what you expect. The mentor itself comes out of the dashboard query the list
screen already loaded, so opening one costs no extra request.

### Learner

**My Mentors** with three tabs — My mentors, Find a mentor, My requests — plus a
post-session rating prompt. The sidebar entry and dashboard widget appear when the
learner has a mentor *or* their institute lists mentors, so a learner with none is
not stuck at a dead end.

### Design notes

The dashboard follows the existing widget vocabulary (Card, tinted icon square,
Skeleton, drill-through link). Lists that are scanned and compared — mentors and
sessions — use `MyTable`, the design system's table, rather than card rows; a data
table is wider than a phone by nature, so it scrolls inside its own container and
the page body never scrolls sideways.

Two deliberate choices:

- **No donut for outcomes.** Four statuses that are often mostly zero read better as
  a segmented bar with labelled counts, and degrade to a real empty state.
- **No separate workload chart.** With a handful of mentors, an inline meter per row
  beats a plot with its own axes.

Every outcome carries an icon *and* a label, so colour is never the only cue. The
average rating is weighted by rating count, so one five-star review cannot outrank a
busy mentor.

---

## 5. Error handling and observability

Every mentorship API call site reports through a shared reporter that shows the
**backend's actual sentence** ("Asha Nair is at capacity (3 mentees)") rather than a
generic failure, and forwards genuine faults to Sentry.

Expected 4xx — validation, permission, already-requested — leave a **breadcrumb
rather than a captured event**: a user being told "no" is not a bug, and capturing
those was previously the dominant Sentry quota drain. 5xx and network errors are
captured, tagged `feature=mentorship` plus the action.

On the backend, mentorship deliberately swallows failures so a notification can
never roll back the assignment that triggered it. `MentorshipErrorReporter` keeps
the swallow but makes 13 such paths visible — six notification triggers, three
scheduler paths, four identity-hydration fallbacks that otherwise render a whole
list nameless.

---

## 6. Gotchas

**Spring `Page` responses mix two naming conventions.** The envelope is named from
`Page`'s getters (`totalElements`, `totalPages`) because the service sets no global
Jackson strategy, while the DTOs inside `content` are snake_case from their own
`@JsonNaming`. Reading `total_elements` off the envelope yields `undefined` — which
once rendered a populated mentor list as *"No mentors yet"*. Paginated mentorship
reads go through `normalizePage()`, which accepts either spelling, and empty states
key off `content.length` rather than a total.

**Booking status ≠ session outcome.** See §1. Do not "simplify" these into one field.

**Capacity is checked against live load *and* rows queued in the same request**, so
one oversized assign cannot push a mentor past their cap.

**`mentor_request` uses two partial unique indexes**, because Postgres treats NULLs
as distinct — one open-ended request per student needs its own index.

---

## 7. Verification status

| Area | State |
|---|---|
| Backend | 121 tests (assignment/capacity, discovery/requests, feedback, sessions, cancel/reschedule, double-booking, removal, scheduler, notifications) |
| Admin FE | 305 tests across the app; 103 mentorship |
| Learner FE | 155 tests |
| Migrations | V454–V458 applied against PostgreSQL and behaviour-verified: constraints, idempotency, triggers, duplicate-tolerant index creation |
| Dashboard | Verified against **production data** — every KPI, outcome count and workload figure computed from the prod DB and matched what renders |
| Responsive | Rendered at 1440 / 834 / 390px, zero horizontal overflow; zero-data state checked |

### Known limitations

- **Live meeting-join flow is untested.** Needs a running backend.
- **Authenticated screens were never rendered** — no credentials available. Mentors,
  Sessions and My Mentorship are covered by tests and route/type checks only.
- **"Next 5 upcoming" ordering unverified against real data** — production currently
  has no upcoming mentorship sessions, so only the empty state was exercised.
- **Visual mobile rendering is not proven.** Layout tests pin wrapping, truncation
  and the absence of fixed pixel widths; they cannot prove appearance.
- **V458 indexes exact start, not overlap.** True overlap prevention needs a Postgres
  exclusion constraint over a range type, which would change how start/end are
  stored. Exact-start collision is what the booking UI can actually produce, since
  invitees pick from generated slots.
- **Reschedule moves a session but cannot change its duration or mentor.**

---

## 8. Where the code lives

```
admin_core_service/…/features/mentorship/
  controller/   MentorController (admin)   MyMentorshipController (mentor + learner)
  service/      MentorService               mentor profiles, dashboard aggregate
                MentorAssignmentService     manual + round-robin, capacity
                MentorDiscoveryService      directory + request lifecycle
                MentorFeedbackService       learner ratings
                MentorSessionService        outcomes, admin session views, cancel/reschedule
                MentorshipNotificationService / MentorshipErrorReporter
  scheduler/    MentorshipReminderScheduler  session reminders + check-in nudges
  resources/db/migration/  V411, V417, V424, V433, V434, V454–V458

frontend-admin-dashboard/src/routes/mentorship/
  dashboard/ mentors/ sessions/ requests/ my-mentorship/
  -components/  MentorshipDashboard, MentorSessionsPanel, MentorDetailDialog,
                MentorRequestsPanel, RecordSessionDialog, SessionActionDialog,
                EditMentorDialog, MentorProfileFields, MentorChips …
  -utils/       page-response, assignment-result, filter-mentors

frontend-learner-dashboard-app/src/routes/my-mentors/
  -components/  MentorCard, DirectoryMentorCard, RequestMentorDialog, RateSessionDialog
  -utils/       directory, feedback
```

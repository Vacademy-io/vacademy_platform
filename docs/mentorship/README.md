# Mentorship & Schedule Booking

Two related capabilities. Most of the **booking** side and the **DM chat** already
exist in the codebase; the **mentorship** layer is new. This doc is the source of
truth for the design, what's built, and what's left.

---

## Part 1 — Calendar & Schedule Booking (already built, awaiting deploy)

A Calendly-style slot-booking system lives in `admin_core_service/features/booking`:

- `booking_page` — shareable "event type": slug, duration, slot granularity,
  buffer before/after, min-notice, booking horizon, timezone, availability windows
  (`availability_json`), Google-Meet allocation, approval toggle, reminders.
- `booking_instance` — one booked meeting on top of the `live_session` /
  `session_schedules` substrate; carries invitee, `scheduled_start/end_utc`,
  `meet_link`, `google_calendar_event_id` (reserved), `custom_field_values_json`,
  and an opaque `manage_token` for invitee self-service.
- `booking_types` + `booking_type_id` — the requested extension column (exists).
- Public flow: `PublicBookingController` @ `/admin-core-service/open/v1/booking`
  (slug-based). Authenticated: `MeetingsController` @ `/admin-core-service/v1/meetings`.
- Google **Meet** link minting via Meet REST API v2 (2-phase, outage-safe).
- Admin UI: `frontend-admin-dashboard/src/routes/meetings` (`BookingPageForm.tsx`).
- Learner UI: `frontend-learner-dashboard-app/src/routes/booking-response`,
  `booking-manage`.

Status: `docs/bookings/README.md` — "v1 Phases 0–2 built, not yet deployed."

**Genuine gap → Phase 3:** Google **Calendar** reflection. Only Meet exists today
(no Calendar OAuth scope, no `google-api-services-calendar` dep,
`google_calendar_event_id` is never written). Phase 3 adds a one-way push so booked
slots appear on the host's and invitee's calendars.

### Go-live (Phase 0, ops — no code)
1. Provision env secrets: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`,
   `OAUTH_TOKEN_ENCRYPTION_KEY`, env-correct `GOOGLE_OAUTH_REDIRECT_URI`
   (registered in Google Cloud console); admin FE `VITE_LEARNER_DASHBOARD_URL`.
2. Migrate DB (V397 + V398–V407 in the same window).
3. Build backend (`mvn -pl admin_core_service -am clean install`) + both FEs.
4. Deploy backend + admin FE + learner FE **together** (admin links target learner routes).
5. Per institute wanting Meet links: connect Google account (Settings → Google Meet).
6. Smoke test: create page → public link → book → lead + My Schedule + email + Meet
   link + manage-link cancel/reschedule.

---

## Part 2 — Mentorship

### Reused, not rebuilt
- **Session notes** → the existing `timeline_event` table (`category=ACTIVITY`,
  `student_user_id`, pinnable) via `TimelineEventService`, `/admin-core-service/timeline/v1`.
- **Direct messaging** → the existing `notification_service/features/chat` DM system
  (`openDirectConversation({targetUserId})`, SSE + FCM). Gated per-institute behind
  `settings.chat.enabled`; the DM role matrix is default-open once enabled. Enable in
  admin **Settings → Notification Settings**.
- **Scheduled calls** → `booking_instance` via `/admin-core-service/v1/meetings/my-calendar`.
- **Student↔institute** → `student_session_institute_group_mapping` (SSIGM).

### New: `admin_core_service/features/mentorship`  (Phase 1 — DONE)
Base path `/admin-core-service/mentorship/v1`.

Tables (V411; renumbered from V408 after course-pulse took V408–V410 on main):
- `mentor` — a user promoted to mentor in an institute (custom `display_name`,
  `title`, `profile_image_file_id`, `bio`, optional `booking_page_id`). Unique per
  (institute, user) while not DELETED.
- `mentor_student_assignment` — mentor↔student links. **Many-to-many** (multiple
  mentors per student). Unique (institute, mentor, student) while ACTIVE.
  `assignment_method` ∈ MANUAL | ROUND_ROBIN | BULK.

Auth (V15): a system-wide `MENTOR` role, seeded once (resolved by name in
`add-user-roles`; the per-institute scope lives on the `user_role` row).

Endpoints:
- Admin (require institute ADMIN): `POST/PUT/GET/DELETE /mentors`, `GET /dashboard`,
  `POST /assignments` (manual), `POST /assignments/bulk-round-robin`,
  `DELETE /assignments/{id}`.
- Self-service (require membership): `GET /my-mentees` (mentor), `GET /my-mentors` (student).

Promotion flow: grant the MENTOR role via `AuthService.addRolesToUserInternal`
(best-effort HMAC) → create the `mentor` profile. User identity (name/email/image)
is hydrated from auth_service by user id.

Round-robin: **least-loaded greedy** — seeds each mentor's current active count and
assigns each student to the lightest eligible mentor, skipping existing pairs (equal
distribution that respects prior load). One-shot; no persistent pool table in v1.

### New FE (Phase 2 — TODO)
- Admin `frontend-admin-dashboard/src/routes/mentorship` (clone the `meetings`
  module conventions): Mentor Dashboard, Add Mentor, Assignment (manual + bulk),
  and the role-conditional mentor view "My Mentorship" (mentees + notes + scheduled
  calls + Message).
- Learner `frontend-learner-dashboard-app/src/routes/my-mentors`: mentor cards with
  **Book** (mentor's booking page) + **Message** (`openDirectConversation`).

### Notifications & Settings (email + in-app + push)  (DONE)
`MentorshipNotificationService` (`features/mentorship/service`) fans mentorship
events out across **three channels** — email (`sendEmailViaUnified`), in-app bell
(`createSystemAlertAnnouncement`), and FCM push (`sendPushViaUnified`) — each gated
independently. Recipients are hydrated from auth_service by user id. Everything is
**best-effort**: a notification failure never rolls back the assignment/booking, and
each channel is fired **after the transaction commits** (via
`TransactionSynchronizationManager` / booking Phase-2), so an outage can't roll a
write back (cf. the live-session-notify-rolls-back-slide incident).

Wired events:
- **Mentor assigned** — `MentorAssignmentService.assignManual` + `bulkRoundRobin`.
  Notifies the student ("You have a new mentor") and/or the mentor ("New mentee
  assigned"). All channels + both recipients default ON.
- **Session booked** — `MeetingBookingService.createBooking` Phase 2 (covers admin
  and learner/public bookings — public `book()` delegates here). Adds in-app + push;
  the email confirmation is already sent by the booking page's own settings. No-op
  unless the host is a mentor.
- **Session cancelled** — `PublicBookingService.cancel`. Email + in-app + push. No-op
  unless the host is a mentor.

**Four channels, template-driven.** Each learner-facing channel — EMAIL, in-app
SYSTEM_ALERT, FCM PUSH, and **WHATSAPP** — is toggled and edited per trigger. Email /
alert / push carry inline editable templates (subject/title + body with
`{{placeholder}}` tokens, rendered in-code via `applyPlaceholders`). WhatsApp uses an
**approved Meta template** (by name, from notification_service) + an optional variable
mapping; when the mapping is empty, the full variable map is passed keyed by name so
notification-service auto-matches named template variables. WhatsApp send mirrors
`MeetingBookingService.sendConfirmationWhatsapp` via
`notificationService.sendUnified(channel="WHATSAPP", …)`. Placeholders:
`{{name}} {{mentor_name}} {{student_name}} {{session_title}} {{session_datetime}}`.

Config lives in the institute-setting blob under key **`MENTORSHIP_SETTING`**
(no new table/enum — generic `InstituteSettingService`). Shape:
```
{ assignment: {
    notify_student, notify_mentor,
    email:        { enabled, subject, body },
    system_alert: { enabled, title, body },
    push:         { enabled, title, body },
    whatsapp:     { enabled, template_name, language_code, variable_mapping } },
  booking:      { ...same channels; email defaults OFF (booking page emails) },
  cancellation: { ...same channels } }
```
When the setting (or any field) is absent the service falls back to **code-default
text with EMAIL/ALERT/PUSH ON and WHATSAPP OFF** (WhatsApp needs an approved template),
so notifications work out-of-the-box. The reader also accepts the legacy boolean channel
form (`"email": true`) for forward-compat. Admin UI: **Settings → Communications →
Messaging & Automation → Mentorship Settings** (`routes/settings/-components/MentorshipSettings.tsx`,
service `services/mentorship-settings.ts`; WhatsApp picker reuses `whatsappTemplateService`).
Blob keys are the exact snake_case names the backend reads — keep FE/BE in lockstep.

---

## Phase roadmap
- **Phase 0** — deploy booking + enable chat (ops). 
- **Phase 1** — mentorship backend. ✅ done (branch `feat/mentorship`).
- **Phase 2** — mentorship FE (admin module + learner tab).
- **Phase 3** — Google Calendar reflection. ✅ done — one-way push via `GoogleCalendarService`
  (reuses the per-institute Meet Google account; host + invitee attendees, `sendUpdates=all`;
  id in `booking_instance.google_calendar_event_id`; deleted on cancel/reschedule). Needs
  connected Google accounts to re-authorize once (adds the `calendar.events` scope).
- **Phase 4** — hardening (booking questions via master custom-fields, slot conflicts
  vs live classes, double-book lock, Meet-space cleanup on cancel).
- **Notifications & Settings** — email + in-app + push + **WhatsApp** across assignment /
  booking / cancellation, each channel toggled AND template-editable per trigger under
  `MENTORSHIP_SETTING`. ✅ done (branch `feat/mentorship-notifications-settings`).

## Market-standard 1:1 (branch `feat/mentorship-complete`)
Consolidation of the split branches into one: `main` + per-mentor Google + notifications
(V414 mentor-google migration renumbered to **V417** — main took V414–V416).
- **Booking link visible + copyable** ✅ done. Admin mentor list shows Copy-link + Open
  next to "Booking on"; My Mentorship has a "Your 1:1 booking link" card. URL =
  `${LEARNER_DASHBOARD}/booking-response?instituteId=&slug=`.
- **Mentor self-service availability** ✅ done. `GET/PUT /mentorship/v1/my-booking-page`
  (`MentorAvailabilityRequest` excludes host/slug so a mentor can only edit their own page;
  auto-provisions a default Mon–Fri 9–5 page). FE `AvailabilityDialog` — weekly hours grid +
  duration / min-notice / buffers / horizon — opened from My Mentorship.
- **Session types & durations** ✅ done (cross-app). `session_types_json` on `booking_page`
  (**V418**) + `BookingSessionTypeDTO` + `BookingPageService` read/write. Exposed on
  `PublicPageDTO`; the chosen length threads through `getSlots?duration` (slot engine gained a
  duration-override overload) + `PublicBookRequestDTO.durationMinutes` → `createBooking`.
  Mentor editor: "Session types" section in `AvailabilityDialog`. Learner: "Choose a session"
  picker in `booking-response` before the slot grid (empty list = unchanged single-duration).
- **Mentor "Upcoming sessions"** ✅ done. `MyScheduleCard` in My Mentorship — the mentor's own
  sessions across all mentees (today + next 30d) with learner name, Today badge, status, Meet
  Join; reuses `/meetings/my-calendar` (no backend change).
- **Mentee learning progress** ✅ done. The mentee dialog leads with the learner's in-progress
  courses (name + % + level) via the existing `useLearnerPackagesQuery` (search-by-user-id,
  type=PROGRESS) — no new endpoint.
- Paid 1:1 sessions / public mentor directory / ratings — not started (deprioritised).

## Post-merge enhancements
The P1–P4 feature merged to `main` (PR #2377). Follow-ups:
- **Add mentor from Teams + photo** (`feat/mentorship-add-mentor-ux`) — the dialog picks
  from the institute's team members (`fetchEligibleOrgUsers`) and supports a profile-photo
  upload, replacing the all-users search.
- **Dashboard widgets** (`feat/mentorship-add-mentor-ux`) — learner `MyMentorsWidget`
  (mentors + next upcoming session via `/meetings/by-lead?inviteeUserId=self`) and admin
  `MentorshipStatsWidget` (mentors/mentees/today/upcoming); backend `today_sessions` +
  `upcoming_sessions` counts on the dashboard endpoint. Both self-hide when empty.
- **Per-mentor Google** (`feat/mentorship-per-mentor-google`) ✅ — each mentor connects their
  OWN Google account via a **Connect Google** card in My Mentorship (mentor-scoped OAuth:
  `POST /mentorship/v1/my-google/initiate`; the shared callback links the connected account to
  `mentor.google_account_id`). Their bookings then use that account for Meet + Calendar (event
  on the mentor's own calendar), falling back to the institute default when a mentor hasn't
  connected. Reuses the existing multi-account `GoogleAccountStore` + the provider chain's
  `providerAccountId`. See `GET /mentorship/v1/my-mentor-profile` for connected status.

## Manual test
See [MANUAL_TEST.md](./MANUAL_TEST.md) for a step-by-step end-to-end test.

## Locked decisions (2026-07-28)
Dedicated `MENTOR` role (not reuse TEACHER) · one-shot round-robin (no pool table) ·
Google Calendar deferred to Phase 3 · start with Phase 0.

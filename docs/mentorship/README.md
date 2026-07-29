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

## Locked decisions (2026-07-28)
Dedicated `MENTOR` role (not reuse TEACHER) · one-shot round-robin (no pool table) ·
Google Calendar deferred to Phase 3 · start with Phase 0.

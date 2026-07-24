# Meeting Bookings (Calendly-style) — Audience Lists + CRM Meetings

**Status:** v1 (Phases 0–2) built 2026-07-20/21 · reviewed (4 adversarial passes, all P0/P1 fixed) · **not yet deployed**
**Owner docs:** this file · plan: `~/.claude/plans/vacademy-audience-booking-plan.md`
**Related docs:** `docs/googlemeetintegration/` (Meet provider used for link minting)

A self-service meeting-booking system: each CRM audience list (or any staff member) can have a
shareable public booking page; invitees pick a slot, become leads in the list, get a Google Meet
link and email reminders; admins see everything in **CRM → Meetings** (My Schedule / Team
Meetings) and on each lead's side-view.

---

## 1. Product summary

| Capability | How |
|---|---|
| Public booking link per audience list | Booking page (single fixed host) attached to the list; link opens on the learner portal |
| Booking → lead | Public booking runs through `submitLead`: creates an `audience_response` in the list (`source_type=AUDIENCE_BOOKING`), dedup + scoring + workflows apply |
| Custom fields on the booking form | Inherited from the list's campaign custom fields (`AUDIENCE_FORM` scope) — configure once in the campaign dialog; answers persist on the lead AND the booking |
| Google Meet link per booking | `allocate_google_meet` flag → provider layer mints a Meet space per occurrence (per-institute Google OAuth, see Meet docs) |
| Reminders | On-booking confirmation email to invitee + host (direct unified send); BEFORE_LIVE reminder rows through the live-session Quartz pipeline; WhatsApp channel ready but gated on Meta template approval |
| Availability rules | Weekly windows + date overrides, slot duration/granularity, buffers, min-notice ("allow booking after X"), booking horizon — all per page, evaluated in the page's IANA timezone |
| See any user's calendar | `GET /admin-core-service/booking/v1/calendar?userId=…` (pre-existing) + Meetings feeds below |
| My Schedule / Team Meetings | CRM sidebar group; Team tab = org-team descendants (role-agnostic) for managers, institute-wide for admins |
| Invitee self-service | Opaque `manage_token` → view / cancel / reschedule without login |
| Timezone | Invitee picks display tz (auto-detected); engine runs in page tz; DB stays UTC |

**Deliberate v1 decisions:** single fixed host per link (no round-robin/collective yet); Google
Calendar *sync* deferred (Phase 3: one-way push per staff member); booking itself is not
credit-metered.

---

## 2. Architecture

```
Learner portal (public)                Admin dashboard (auth)
/booking-response?instituteId&slug     CRM → Meetings (my-schedule / team)
/booking-manage?token&instituteId      Audience list card ⋮ → Booking Settings
        │                              Lead side-view → Meetings section
        ▼                                        │
PublicBookingController                MeetingsController
/admin-core-service/open/v1/booking    /admin-core-service/v1/meetings   (InstituteAccessValidator on every route)
        │                                        │
        └────────────► MeetingBookingService ◄───┘
                       │ (2-phase create: persist tx → post-commit Meet+email)
        ┌──────────────┼──────────────────────────────┐
        ▼              ▼                              ▼
 Step1/Step2        BookingSlotService          AudienceService.submitLead
 (live_session      (availability engine)       (lead + custom-field values)
  substrate)               │
        ▼                  ▼
 ProviderMeetingBatchService → GoogleMeetManager (Meet link per occurrence)
 schedule_notifications + Quartz → notification_service (email/WhatsApp)
```

A booking is **two rows**:
- a `live_session` (+ `session_schedules` occurrence) — the calendar/reminder/Meet substrate,
  created through the existing Step1/Step2 flow, `source = MEETING_BOOKING`;
- a `booking_instance` — the CRM metadata on top (page, invitee identity, audience_response link,
  manage token, lifecycle status, true-UTC times).

Feature package: `admin_core_service/.../features/booking/`
(`entity/ repository/ dto/ service/ controller/`).

---

## 3. Data model (migration `V397__Create_booking_page_and_instance.sql`)

### `booking_page` — the shareable "event type"
| Column | Notes |
|---|---|
| `institute_id`, `audience_id?` | `audience_id` null ⇒ standalone page (no lead creation) |
| `host_user_id` | single fixed host (v1 decision) |
| `slug` | public URL slug; **partial unique** per institute `WHERE status <> 'DELETED'` (soft-delete frees the slug) |
| `duration_minutes`, `slot_granularity_minutes`, `buffer_before/after_minutes` | slot math |
| `min_notice_minutes`, `booking_horizon_days` | earliest/latest bookable |
| `timezone` | IANA; availability windows interpreted here |
| `location_type` | `GOOGLE_MEET \| CUSTOM_LINK \| IN_PERSON \| PHONE` |
| `allocate_google_meet` | mint a fresh Meet link per booking |
| `require_approval` | booking lands `PENDING` instead of `CONFIRMED` |
| `availability_json` | `BookingAvailabilityDTO`: `weekly_windows[{day_of_week, start_time, end_time}]` + `date_overrides[{date, blocked?, windows?}]` (times `HH:mm` in page tz; `24:00` unsupported — use `23:59`) |
| `reminder_config_json` | `BookingReminderConfigDTO`: `on_booking_confirmation`, `channels[EMAIL\|WHATSAPP]`, `before_meeting_offsets_minutes[]` |
| `status` | `ACTIVE \| INACTIVE \| DELETED` (soft) |

### `booking_instance` — one booked meeting
| Column | Notes |
|---|---|
| `booking_page_id?` | null for admin create-on-behalf without a page |
| `live_session_id`, `schedule_id` | the substrate rows |
| `host_user_id`, `invitee_user_id?`, `audience_response_id?` | CRM linkage |
| `invitee_name/email/phone/timezone` | contact as captured on the form |
| `scheduled_start_utc`, `scheduled_end_utc` | **true UTC instants** (unlike the live-session wall-clock, see §6) |
| `status` | `CONFIRMED \| PENDING \| CANCELLED \| RESCHEDULED \| COMPLETED \| NO_SHOW` |
| `meet_link`, `google_calendar_event_id?` | latter reserved for Phase 3 |
| `custom_field_values_json` | booking-form answers `{field_key: value}` |
| `manage_token` | opaque UUID (122-bit) — invitee self-service without login |
| `version` | optimistic lock (`@Version`) — serializes concurrent reschedule/cancel |
| `reschedule_of_instance_id`, `cancel_reason` | lifecycle audit |

Both tables have `updated_at` triggers (entities mark the column non-writable).

---

## 4. Backend API

### Authenticated — `MeetingsController` @ `/admin-core-service/v1/meetings`
Every endpoint validates the caller's institute via `InstituteAccessValidator`; page lookups 404 on
institute mismatch.

| Endpoint | Purpose |
|---|---|
| `POST /booking-page` · `PUT /booking-page/{id}?instituteId=` · `GET /booking-page/{id}?instituteId=` · `GET /booking-pages?instituteId=&audienceId=&hostUserId=` · `DELETE /booking-page/{id}?instituteId=` | Booking-page CRUD. On `PUT`, `audience_id: ""` (empty string) explicitly detaches the page from its list; null leaves it unchanged |
| `POST /book` | Admin create-on-behalf. Accepts `booking_page_id?`, `host_user_id?`, `start_time` (ISO offset datetime), `duration_minutes?`, invitee contact, `audience_response_id?`, `invitee_user_id?`, `custom_field_values?`, `allocate_google_meet?`, `reminder_config?` — page defaults fill nulls |
| `GET /my-calendar?instituteId=&startDate=&endDate=` | Caller's hosted bookings. Window params accept **ISO offset datetimes** (preferred — exact local week bounds) or bare `yyyy-MM-dd` (UTC day fallback) |
| `GET /team-calendar?…` | Admins: institute-wide. Others: caller + all org-team descendants (any role) via `TeamScopeService` |
| `GET /scope?instituteId=` | `{is_admin, is_team_manager, team_user_ids}` — FE gating for the Team tab |
| `GET /by-lead?instituteId=&audienceResponseId=&inviteeUserId=&inviteeEmail=` | A lead's meetings — union across all three identifiers, deduped, newest first (email match catches bookings made on other lists with the same contact) |

### Public — `PublicBookingController` @ `/admin-core-service/open/v1/booking`
Unauthenticated (covered by the existing `open/**` permitAll rule). Slug is scoped by institute.

| Endpoint | Purpose |
|---|---|
| `GET /page/{instituteId}/{slug}` | Page render data + `custom_fields` (the linked list's campaign fields). Leaks no internal config (no host user id, no custom link) |
| `GET /page/{instituteId}/{slug}/slots?from=&to=&tz=` | Available slot starts as ISO offset datetimes in `tz` (range clamped to 62 days) |
| `POST /page/{instituteId}/{slug}/book` | `{name, email?, phone?, start_time, invitee_timezone, custom_field_values?}` (email-or-phone required) → booking view incl. `manage_token` |
| `GET /manage/{token}` | Invitee booking view |
| `POST /manage/{token}/cancel` | `{reason?}` → cancels session + schedules, deletes reminder rows, status `CANCELLED` |
| `POST /manage/{token}/reschedule` | `{start_time, invitee_timezone?}` → books replacement (custom fields carried over), retires old as `RESCHEDULED`, returns **new** manage token |

**Anti-abuse caps** on `book` (bounds email-bombing, host-calendar flooding, Meet-quota and
workflow-credit burn): max **200 bookings/page/day** and **5/email/page/day**
(`PublicBookingService.MAX_*`). Errors use invitee-friendly messages. The platform error envelope is
`ErrorInfo{url, ex, responseCode, date}` with HTTP 510 — the message is in **`ex`**.

---

## 5. Booking flows

### Public booking (`PublicBookingService.book`)
1. Resolve ACTIVE page by `(instituteId, slug)`; validate name + email-or-phone.
2. Re-validate the requested slot (`BookingSlotService.isSlotAvailable` — race guard, not a lock).
3. Enforce abuse caps.
4. **Lead creation (best-effort)** if the page has an `audience_id`: `AudienceService.submitLead`
   with `source_type=AUDIENCE_BOOKING`, `source_id=page.id`, contact as `UserDTO`, plus the
   booking-form `custom_field_values` — so answers land on the `audience_response` like a normal
   form fill. Dedup, scoring, counselor distribution and `AUDIENCE_LEAD_SUBMISSION` workflows all
   apply. A failure here logs and does **not** block the meeting (a broken list must not stop a
   customer from booking); the reverse can't happen (lead is created before the meeting).
5. `MeetingBookingService.createBooking` with a minimal host principal (public caller has no JWT;
   only `userId` is consumed downstream, for created-by stamping).

### `MeetingBookingService.createBooking` — shared by admin + public paths
**Phase 1 (one `TransactionTemplate` transaction):**
- Step1 → `live_session` + single schedule (`recurrence NONE`); **wall-clock conversion, see §6**.
- Step2 → participants (invitee user + explicit participants + **the host**) + BEFORE_LIVE
  `schedule_notifications` rows from the reminder config.
- Insert `booking_instance` (status `PENDING` if `require_approval`, else `CONFIRMED`;
  fresh `manage_token`; custom-field JSON).

**Phase 2 (post-commit, best-effort):**
- Meet allocation via `ProviderMeetingBatchService.createMeetingsForSession(provider=GOOGLE_MEET)`;
  link read back from `session_schedules.custom_meeting_link` onto the instance.
- Confirmation email (direct `NotificationService.sendEmailViaUnified`) to invitee email + host.

> **Why two phases:** `LiveSessionProviderService.createMeeting` is `@Transactional(REQUIRED)` — if
> Meet allocation ran inside the persist transaction, a provider failure (Google not connected,
> token expired, outage) would mark the shared tx rollback-only and the *entire booking* would 500
> and vanish. Post-commit, a Meet failure just logs; the provision-retry scheduler re-provisions
> pending schedules later. **Do not "simplify" this back into one `@Transactional` method.**

### Reschedule (`PublicBookingService.reschedule`)
Claim-first with optimistic locking: flip old instance → `RESCHEDULED` + `saveAndFlush`
(`@Version` makes a concurrent reschedule/cancel lose with a clean "just modified, reload" error)
→ create the replacement (carries invitee + custom fields, links `reschedule_of_instance_id`)
→ cancel old session + delete its reminder rows. If replacement creation fails, the old status is
restored (compensation). Old manage links render a "rescheduled" state and hide the join link.

### Cancel
Session + schedules → `CANCELLED`; `schedule_notifications` rows deleted; instance `CANCELLED`
with reason. (The already-minted Meet space is **not** deleted — see §9.)

---

## 6. Timezone conventions — read before touching times

Three different conventions coexist; mixing them up shifts meetings/reminders by the tz offset
(the classic 5.5 h bug):

1. **DB / JVM are UTC.** Hikari pins `SET TIME ZONE 'UTC'`; the admin_core JVM must stay UTC
   (never `TimeZone.setDefault`).
2. **Live-session substrate stores WALL-CLOCK.** `live_session.start_time` /
   `session_schedules.meeting_date+start_time` hold the wall-clock value *in
   `live_session.timezone`*, written such that rendering the timestamp at UTC yields that
   wall-clock (`Timestamp.valueOf(zonedLocalDateTime)` under a UTC JVM). Step1 extracts with
   `.toInstant().atZone(UTC)`; Step2's reminder trigger computation interprets the wall-clock in the
   session tz and converts to UTC. `MeetingBookingService` therefore converts the incoming ISO
   instant → page-tz wall-clock before Step1.
3. **`booking_instance` stores TRUE UTC instants** (`scheduled_start_utc/end_utc`) — frontends
   parse and render in the viewer's zone directly.

Slot engine: all window expansion happens in the **page** timezone; the invitee's `tz` parameter is
display-only. Slot strings round-trip exactly (ISO offset datetime → `OffsetDateTime.parse` →
same instant). FE calendar feeds send exact local week boundaries as ISO instants. The learner slot
picker fetches ±1 day around the visible strip because "days" differ between the page tz and the
invitee tz.

---

## 7. Reminders & notifications

| Event | Mechanism | Recipients |
|---|---|---|
| On booking | Direct `sendEmailViaUnified` (post-commit), subject "Meeting confirmed/requested: …" | Invitee email + host email |
| Before meeting | `schedule_notifications` BEFORE_LIVE rows → 5-min Quartz processor → unified send | **Only participants resolvable through student mappings** (see limitation) |
| Cancel/reschedule | Reminder rows removed; states rendered on manage links | — |

**Known limitation (P3 TODO):** the live-class reminder processor resolves recipients from student
tables, so BEFORE_LIVE reminders reach enrolled learners but **not** a pure CRM invitee or the staff
host. The on-booking confirmation is sent directly for this reason. A booking-aware reminder
dispatch (keyed on `invitee_email`/host) is the top follow-up.

**WhatsApp:** the channel plumbs through (`reminder_config.channels`), but sending requires an
approved Meta template — start approval early; recall the MARKETING-vs-Utility rejection history.

---

## 8. Frontend surfaces

### Admin dashboard (`frontend-admin-dashboard`)
- **Sidebar:** CRM category → **Meetings** group → My Schedule (`/meetings/my-schedule`), Team
  Meetings (`/meetings/team`).
- **My Schedule:** week list of hosted bookings; **New Meeting** (create-on-behalf dialog, supports
  prefill); **Share Booking Link** (booking-pages manager: list/copy/edit/delete/create).
- **Team Meetings:** gated by `GET /scope` (`is_admin || is_team_manager`); host column + filter
  (filter resets on week change).
- **Audience list card ⋮ → Booking Settings**
  (`audience-manager/list/-components/booking-settings/BookingSettingsDialog.tsx`): create/edit the
  list's booking page — host picker, duration, weekly availability grid, min-notice, horizon,
  timezone, **Allocate Google Meet**, require-approval, reminder channels — plus the public link
  (learner portal) with copy. Custom fields are *not* configured here: they're the campaign's
  fields, edited in the existing campaign dialog.
- **Lead side-view** (`student-side-view.tsx`, lead tab):
  `LeadMeetingsSection` — the lead's meetings (via `/by-lead`) + **Book meeting** button opening the
  create dialog prefilled (name/email/phone, `audience_response_id`, `invitee_user_id`).
- Shared code in `src/routes/meetings/` (`-services`, `-hooks`, `-types`, `-utils`, `-components`).
  Public link builder targets the **learner portal**:
  `{BASE_URL_LEARNER_DASHBOARD}/booking-response?instituteId=…&slug=…`.

### Learner app (`frontend-learner-dashboard-app`) — public, no login
- **`/booking-response?instituteId=&slug=`** — 3-step Calendly flow: slot picker (7-day strip,
  availability dots, tz toggle browser↔page, horizon-clipped) → details form (name + email-or-phone
  + the list's custom fields, RHF+zod, same renderer/validation as the audience form) →
  confirmation (Meet link, manage link).
- **`/booking-manage?token=&instituteId=`** — view/cancel/reschedule; reschedule reuses the slot
  picker and rotates to the new token (URL replaced); rescheduled/cancelled/past states read-only,
  join link hidden.
- Both routes are listed **explicitly** in `PUBLIC_ROUTES` (`__root.tsx`) — don't rely on the
  catalogue wildcard. Services use **plain axios** (never the authenticated instance — its
  interceptors would bounce invitees to /login). Error messages come from `response.data.ex`.

---

## 9. Accepted v1 gaps / known issues

- **Slot conflicts consider other bookings only** — the host's live classes / ad-hoc calendar
  events don't block slots yet (extend `BookingSlotService` with `getUserCalendar` overlap).
- **Cancelled/rescheduled meetings leave the old Google Meet space URL alive** (spaces aren't
  deleted; the retry scheduler won't re-provision cancelled schedules, so no runaway — but a saved
  link still opens a room).
- **BEFORE_LIVE reminders don't reach pure CRM invitees or hosts** (§7).
- **`24:00` as a window end is unsupported** — use `23:59`.
- **Availability windows are per page**, not synced to any external calendar (Phase 3).
- **Booking is race-guarded, not locked** — two invitees grabbing the same slot in the same second
  can double-book (second one wins too); acceptable at current traffic.
- Admin create-on-behalf ignores availability rules by design (admins can book anything).
- UTC-day fallback on calendar windows if a client sends bare dates (FEs send ISO instants).

## 10. Phase 3 roadmap

1. **Booking-aware reminder dispatch** (invitee email + host, WhatsApp once template approved).
2. **Google Calendar one-way push per staff member** — per-user OAuth (Calendar scope) mirroring
   the Zoom/Google token pattern (`TokenEncryptionService`, `institute_live_session_provider_mapping`),
   event insert/update/delete keyed by `booking_instance.google_calendar_event_id`.
3. Two-way busy-time sync (read staff calendars into the slot engine).
4. Round-robin / pooled hosts; per-page (standalone) custom fields; date-override editor UI;
   booking analytics; Meet-space cleanup on cancel.

## 11. Deploy checklist

- [ ] Meta WhatsApp template approval kicked off (email works day one).
- [ ] `V397` migration reviewed; mirror to devops-baseline if that flow applies; watch the
      prod table-ownership (Flyway 42501) gotcha for any later ALTERs.
- [ ] Backend: `mvn -pl admin_core_service -am clean install` (always `-am` — stale
      common_service otherwise).
- [ ] Admin FE: `pnpm run typecheck` + `pnpm run lint:naming`; Learner FE: `tsc -b` + design-lint.
- [ ] Deploy backend + **both** frontends together (admin links point at learner-portal routes that
      must exist).
- [ ] Smoke QA: create booking page on a test list → open public link → book with a new email →
      verify lead appears in the list (source `AUDIENCE_BOOKING`), meeting in My Schedule, lead
      side-view Meetings section, confirmation email, manage-link cancel + reschedule.
- [ ] If Meet allocation is enabled, verify the institute's Google account is connected
      (Settings → Google Meet) — bookings still succeed without it, links just come later/never.

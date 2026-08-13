# SuchBliss Automation — Reference & Runbook

**Institute:** SuchBliss (`54d0a67f-8a13-4137-872d-f62d68ef7971`) · **Trial batch (package session):** `66b6da76-2958-4581-81f1-2d3babe98dd5` · **Learner portal:** member.suchbliss.com
**Built:** 2026-07-23 → · **Status:** LIVE in production since 2026-07-29 05:00 IST · **Last revised:** 2026-08-12

Daily class automation plus the full paid-membership lifecycle for SuchBliss (modeled on the
Aanandham/"Holistic" blueprint): the workflows, the engine changes that made them possible,
the operational runbook, and every gotcha found while building it. Companion docs:
[WORKFLOW_PLATFORM_PROGRESS.md](WORKFLOW_PLATFORM_PROGRESS.md) (engine reference),
[WORKFLOW_AI_ASSIST_DESIGN.md](WORKFLOW_AI_ASSIST_DESIGN.md) (AI drafter),
[media_service/SHORT_LINK_SYSTEM.md](../media_service/SHORT_LINK_SYSTEM.md) (URL shortener).

---

## 1. The member journey (end to end)

```
Enrol via invite → ₹1 mandate authorisation (UPI Autopay / card)
   │  welcome WhatsApp fires on PAYMENT_SUCCESS, announcing the start date
   │
   ▼ trial starts the NEXT MONDAY, not at signup      (see §3, TRIAL_STARTS_ON)
Sun 6:00 PM   T-1 reminder: "your journey begins tomorrow"
   │
   ▼ each day of the 14-day trial
5:00 AM   10 live sessions created for the day        (Trial-Day Session Creator)
5:20 AM   that day's WhatsApp with all timings + the learner's unique link
9:30 PM   attendance recap: ✅ attended ❌ missed ⬜ not yet
   │
   ▼ day 13, 11:00 AM
autopay notice with a link to stop the renewal        (member.suchbliss.com/subscriptions/<username>)
   │
   ▼ day 15
charge → plan extends, invoice generated + emailed, payment-received WhatsApp
   │  on failure: dunning retries, then pay-to-continue link (same plan reactivates)
   ▼
post-trial members get their own daily session        (Members Daily Session)
```

Learner link: `https://member.suchbliss.com/study-library/live-class/<username>` — passwordless
trusted login → attendance marked → auto-join into whichever session is live now.

## 2. Live workflows

All are DB rows (`workflow` / `node_template` / `workflow_node_mapping` / `workflow_schedule`),
editable from the admin dashboard's workflow **Configuration** tab (§7).

| Workflow | id | Fires | Notes |
|---|---|---|---|
| Welcome WhatsApp | `suchbliss_welcome_wa_wf` | PAYMENT_SUCCESS (×5 invite triggers) | guard: `renewal != true`, so renewals don't get it |
| Trial-Day Session Creator (AI) | `3699fb87-…` | 5:00 AM daily | 10 slots × active trial days |
| Daily Class Reminder v2 | `sb_daily_reminder_v2_001` | 5:20 AM daily | one node per day 1–14 |
| Daily Attendance Recap | `sb_weekly_attendance_001` | 9:30 PM daily | id says weekly; it is daily |
| T-1 Sunday Reminder | `sb_t1_sunday_reminder_001` | Sun 6:00 PM | "starts tomorrow" |
| Day-13 Autopay Notice | `sb_d13_stop_notice_001` | 11:00 AM daily | `daysAhead=1` → exactly the day before the charge |
| Payment Deduction Confirmation | `sb_renewal_confirmation_001` | PAYMENT_SUCCESS | guard: `renewal == true` |
| Pay-to-Continue Reminder | `sb_paytocontinue_001` | (schedule INACTIVE) | for revoked-mandate / dunning-expired members |
| Members Daily Session (AI) | `8ee8535b-…` | 5:00 AM daily | post-trial cohort |

**Superseded (INACTIVE, keep for reference):** `sb_daily_session_creator_001`,
`sb_daily_reminder_001`, `sb_members_daily_001`, and the `AI TEST —` drafts from the
AI-drafter trials.

### Members' classes, per weekday
Trial classes are keyed by *day since enrollment* (day 1…14). Members' classes are keyed by
*day of the week*, because the programme repeats — so the members' creator
(`8ee8535b-…`) is configured as **one row per class slot** in the settings trigger's
`sessionSlots`:

| column | blank means | example |
|---|---|---|
| `time` / `entryEnd` | required | `07:00` / `07:50` |
| `days` | runs every day | `MON,WED,FRI` |
| `link` | use `meetingLink` | a different YouTube stream that day |
| `template` | use `dailyTemplate` | different WhatsApp copy that day |
| `title` | use `sessionTitle` | `Meditation Special` |

A "do not edit" TRANSFORM derives `todayDow`, `todaysSlots` (rows whose `days` is blank or
contains today), `classTimeText`, and first-non-blank picks for `todaysTemplate` /
`todaysTitle`. The three iterators run over `todaysSlots` and the send is gated on there
being a class at all — **a rest day sends nothing** rather than announcing a class that does
not exist. Adding a Saturday class is one new row.

> `templateVars` is one map for the whole node, so **every per-day template must take the
> same variables in the same positions** as `dailyTemplate`. A different variable count
> fails at Meta with error 132000.

Run-time template choice is why `SendWhatsAppNodeHandler.resolveTemplateName` exists: a
`templateName` starting with `#` or `T(` is evaluated against the context, anything else is
the literal name it has always been.

### Trial class links, per day
The trial creator resolves each session's link as **slot override → that day's link →
workflow default**:
- `dayLinks` — `{"day1": url … "day14": url}`, one box per day in the config tab. This is
  the control an admin uses daily.
- `linkSchedule` — day × slot grid, for the rare case one timing needs a different video.
- `defaultMeetLink` — final fallback, so a blank day still produces a working session.

### Learner buttons on the class screen
`live_session.learner_button_config` holds a **list** of buttons (YouTube/Instagram/Facebook),
set by the creator workflow and rendered under the player.

## 3. Trial anchoring (billing and content agree)

The trial starts on the programme's start weekday, not at signup — a Wednesday signup would
otherwise be charged after nine days of classes.

- **Billing:** invite `AUTOPAY_SETTING.TRIAL_STARTS_ON` (`"MONDAY"`, optional
  `TRIAL_TIMEZONE`). `UserPlanService.applyAutopaySetup` anchors `end_date` and
  `next_charge_at`; absent the setting, behaviour is unchanged (starts immediately).
- **Content:** the session creator, reminder v2 and recap compute the trial day from the same
  anchor via `trialStartsOn` + `trialAnchorFrom` settings rows. `trialAnchorFrom` (2026-08-11)
  means only learners enrolled on/after that date are anchored, so nobody mid-trial had their
  day number moved. Once every pre-cutoff learner has finished, it can be deleted.
- Both sides resolve through `TrialStartResolver` → `WorkflowDateUtil.nextOccurrence`, the
  same call the DELAY node uses — so the announced date and the charge date cannot drift.
  Strictly-next: enrolling on a Monday anchors to the following Monday.

⚠️ The invite editor **rebuilds `AUTOPAY_SETTING` from the fields it knows**, so saving an
invite from Manage Students → Invite silently drops `TRIAL_STARTS_ON`. Add it to
`AutopaySettingsCard` before relying on it long-term.

## 4. Payments

- **Enrolment:** ₹1 mandate authorisation registers UPI Autopay / card; invoice generated and
  emailed per `INVOICE_SETTING.invoicePdfPlacement` (separate invoice mail, or one
  confirmation mail carrying the PDF).
- **Renewal** (`RenewalPaymentService`): extends `user_plan.end_date`, every ACTIVE
  `ssigm.expiry_date`, reactivates INACTIVE mappings, re-arms `next_charge_at` only when
  autopay is on, and fires PAYMENT_SUCCESS with `renewal: true` + `newEndDateLabel`.
- **Renewal invoicing** — added 2026-08-11. Hooked inside
  `handleRenewalPaymentConfirmation`, so every gateway path gets it (Razorpay/Stripe
  webhooks, eWay poller, sync charge). Runs **after commit** via a transaction
  synchronization: invoice generation is itself `@Transactional`, and sharing the renewal's
  transaction would let a PDF failure roll back the plan extension for a member who has
  already been charged. Idempotency reuses the invoice's `existsByPaymentLogId` guard.
- The renewal branch also now marks its `PaymentLog` PAID/SUCCESS — previously a settled
  renewal still looked unpaid in payment history.
- **Self-service:** `member.suchbliss.com/subscriptions/<username>` — stop the membership
  (access continues to the paid-through date), or pay to continue, optionally re-arming
  autopay. Stopped state is amber and says "Membership stopped", never a green tick.

## 5. WhatsApp templates — all UTILITY

Meta **derives** the category from the copy; you cannot flip it via API or settings.
Enthusiastic, emoji-heavy copy classifies as MARKETING, which is subject to per-user
frequency caps — messages are accepted by the API (`successCount: 1`) and then silently not
delivered. This bit us live: a paid enrolment's welcome never arrived.

Live templates (all APPROVED / UTILITY as of 2026-08-12):

| Purpose | Template | Vars |
|---|---|---|
| Welcome | `suchbliss_trial_confirmed` | name, start date |
| Daily class reminder | `demo_utility` | name, timings, day title, 2 body lines, join link |
| Attendance recap | `suchbliss_weekly_attendance` | name, summary, marks row |
| Day-13 autopay notice | `suchbliss_renewal_notice` | name, charge date, manage link |
| Payment received | `suchbliss_payment_received` | name, amount, valid till |
| T-1 reminder | `suchbliss_trial_t1_reminder` | name, timings |
| Phone-login OTP | `otp_template_suchbliss` | code (AUTHENTICATION, copy-code button) |

Retired MARKETING versions still exist in the account: `register_demo_utility`,
`suchbliss_payment_confirmation`, `suchbliss_trial_day13_autopay_notice`,
`suchbliss_practice_recap`, `demo_attendance_dailypractice`. Nothing points at them.

**Writing for UTILITY:** state the fact, give the date or amount, offer a reply route. No
exclamations, no encouragement, no emoji. Compare `after_register_utility_1` (UTILITY) with
`register_demo_utility` (MARKETING) — same institute, same message, different register.

⚠️ `after_register_utility_1` carries a `Yes, will be there!` quick reply that feeds the
"AI response on Whatsapp" chatbot flow (both created 2026-07-16). The current welcome
(`suchbliss_trial_confirmed`) has **no** button, so that flow now has no entry point from any
live workflow — decide whether to retire it or give it one.

## 6. Phone-OTP login

`member.suchbliss.com` offers WhatsApp OTP sign-in. Chain:

```
PhoneLoginForm → /auth-service/v1/request-generic-whatsapp-otp
   → admin-core getTemplateConfig("OTP_REQUEST", institute, "WHATSAPP")
        → notification_event_config → templates row (name + setting_json)
   → notification-service /internal/v1/send-whatsapp-otp
        → code stored in email_otp; Meta payload built from templates.setting_json.parameters
verify → /verify-generic-whatsapp-otp-login → checks email_otp
```

Tables: `institute_domain_routing.allow_phone_auth` (shows the tab), `notification_event_config`
(binds OTP_REQUEST → template), `templates` (name + parameters), `email_otp` (codes),
`auth_service.users.mobile_number` (login lookup).

For an AUTHENTICATION template with a copy-code button, `parameters` needs **both** body and
button entries — Meta rejects the send otherwise.

## 7. Admin editability

The workflow **Configuration** tab is the product surface for non-technical admins. Simple
view by default, developer view behind a toggle. Editors: settings rows, repeatable object
lists (learner buttons), one-level maps (per-day links), two-level grids (day × slot),
message content with a live template-body preview.

Rules the UI enforces so an admin cannot break a send:
- A bare `templateVars` value like `name` is a **field reference**, not message text (the send
  handler resolves it against the learner record). Those render as auto-filled chips, never
  as editable boxes. Only wording with spaces/punctuation is editable.
- If the template body isn't known locally it says so and offers "Import templates from
  WhatsApp" rather than showing bare `{{1}}` boxes.
- If the template uses a variable the step doesn't supply, it warns and offers one-click add —
  otherwise the send fails at run time with a parameter-count mismatch.

**Not yet editable from the UI:** a workflow's run time (cron). The only surface that edits it
is the visual editor, which clones the workflow and strips routing. Needs
`PUT /v1/workflow/{id}/schedule` + a "When this runs" card.

## 8. Short links (in progress)

`media_service` has a full shortener (`SHORT_LINK_SYSTEM.md`). Per-institute branded domains
resolve from `backend_base_url` (`suchbliss.com` → `https://u.suchbliss.com/s/{code}`).

Done: `u.suchbliss.com` added to the devops ingress (TLS host + `/s` → media-service).
Outstanding: DNS record, the `backend_base_url` row, and a way for a **workflow** to mint a
short link per learner — `ShortLinkIntegrationService` exists in admin_core but no prebuilt
query key exposes it to the engine.

## 9. Scheduler mechanics you MUST know

- **`WorkflowExecutionJob` ticks every 15 minutes** — a schedule fires at the first
  :00/:15/:30/:45 tick after `next_run_at`. Hence 5:20 → 5:30 delivery. Pick cron times on
  tick boundaries when exact timing matters.
- `workflow_schedule.next_run_at` is stored as **UTC wall time** in a `timestamp` column; cron
  recalculation honors the schedule's `timezone`.
- Fire immediately: `POST /v1/workflow/{id}/trigger-now` (accepts a seed context — this is how
  a single learner's message can be replayed). Park: `status='INACTIVE'`.
- Executions are idempotent per (schedule, slot).

## 10. Gotchas (each cost a live debugging session)

1. **`createLiveSession` silently no-ops without `createdByUserId`** — NOT NULL column; the
   handler catches the save error and returns an error map, which ITERATOR counts as SUCCESS.
2. **`createSessionSchedule` returns no `scheduleId`** (only `{"SESSION_SCHEDULE":"SUCCEESS"}`,
   typo included).
3. **`SEND_WHATSAPP` `templateVars` were passed verbatim to Meta** until `6c6bc72ab`.
4. **`SpelEvaluator` lacked a `MapAccessor`** until `4297fd342` — dot-access broke after any
   persisted-DELAY resume.
5. **Day counts in UTC are off by one** at IST early morning — always
   `LocalDate.now(Asia/Kolkata)`.
6. **Meta parameters cannot contain newlines, tabs or 4+ consecutive spaces** — multi-line
   visuals need the layout in the body and one line per variable.
7. **A successful send is not a delivered message.** `successCount: 1` means Meta accepted it.
   Delivery status arrives on webhooks we do **not** persist, so "did it arrive?" is currently
   unanswerable from our data — check WhatsApp Manager. Worth fixing.
8. **An empty audience looks like success.** `iterator_completed: true, skipped_count: 0` over
   an empty list reads identically to a real send. Check `processed_count` / the filtered list.
9. **The recap only covers trial days 1–14** — post-trial members get no attendance message.
10. **Never press Test Run** on the creator workflows — mutating queries execute for real.
11. Participant `source_type` must be uppercase `'USER'`/`'BATCH'`; the creator is **not**
    idempotent (per-slot execution idempotency is the only guard against duplicates).
12. **`learner_button_config` is a list.** The backend once bound it to a single-object DTO,
    so multi-button configs deserialised to null and vanished; the learner app separately
    required a `visible` flag the data never had. Both fixed — but it is a good example of a
    silent failure on both sides of the same field.

## 11. Testing methodology (reusable)

- **Fast-forward drips:** update `workflow_execution_state.resume_at` to `now()` per hop; the
  real resume job does the rest. 14 days in ~30 minutes.
- **Scoped live tests:** `targetUserIds` in the trigger config allowlists one learner; the send
  filter intersects it with the day window. Both must pass — a learner past day 14 receives
  nothing however the allowlist is set.
- **Replaying one message:** `trigger-now` with a seed context matching what the event would
  have carried (used to resend a welcome that Meta dropped).
- **Verification:** `workflow_execution_log.details_json` per node holds the input context and
  the node's output — this is where you see the actual `welcomeList`, `circles`, `successCount`.

## 12. Current state (2026-08-12)

| Item | State |
|---|---|
| Trial pipeline | ACTIVE — creator, reminder v2, recap all firing daily |
| Trial anchoring | LIVE; `TRIAL_STARTS_ON=MONDAY` on all 5 trial invites |
| Payment lifecycle | Renewal invoicing + emails live; day-13 notice at `daysAhead=1`; T-1 Sunday reminder ACTIVE |
| Templates | All member-facing workflows on UTILITY templates |
| Phone-OTP login | Wired and verified end to end |
| Attendance recap | **Allowlisted to one test user** — clear `targetUserIds` to open it up |
| Pay-to-Continue | Workflow ACTIVE, schedule INACTIVE |
| Short links | Ingress done; DNS + `backend_base_url` row + engine support outstanding |
| Learner app | 4 fixes queued for deploy (waiting-room video, mobile Next, phone-login error, subscriptions page) |

## 13. Open items

- Clear `targetUserIds` on `sb_att_trigger` to open the recap to all learners.
- Weekday-based scheduling for the members' (post-trial) sessions, so admins configure a week
  rather than a day.
- Short links end to end: DNS, `backend_base_url` row, prebuilt query key for the engine.
- `TRIAL_STARTS_ON` in `AutopaySettingsCard`, or the invite editor keeps wiping it.
- Persist Meta delivery webhooks so non-delivery is diagnosable from our own data.
- Schedule editing (`PUT /v1/workflow/{id}/schedule`) + "When this runs" card in the config tab.
- Retire the unused MARKETING templates in WhatsApp Manager; decide the AI chatbot flow's fate.
- Reverse-green logo asset; align `institute_theme_code` (`#48604a`) with the learner portal
  theme (`#283618`).

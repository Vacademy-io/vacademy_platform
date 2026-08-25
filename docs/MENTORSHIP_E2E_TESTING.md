# Mentorship — end-to-end test guide

How to exercise the whole feature across the three people involved, and in
particular how to prove the **Google Meet link is minted under the right Google
account** for each of them.

Companion to [`MENTORSHIP_FEATURE.md`](./MENTORSHIP_FEATURE.md), which explains
how the feature is built. This one is only about testing it.

---

## 1. The thing most people get wrong

There are **two different Google connections** in this product, and mentorship
uses whichever one it can find, in this order:

| Priority | Whose Google account | Where it is connected | Stored in |
|---|---|---|---|
| 1 | **The mentor's own** | My Mentorship → *Connect Google* | `mentor.google_account_id` |
| 2 | **The institute default** | Settings → integrations (admin) | institute-level vendor account |
| 3 | *(none)* | — | booking succeeds with **no Meet link** |

The resolution happens in `MeetingBookingService.hostGoogleAccountId()`, and the
**same** account is used for both the Meet link and the calendar event push.

Two consequences worth internalising before testing:

- **A mentor who has not connected Google still gets Meet links** — they are just
  minted on the *institute's* account, so the event lands on the institute
  calendar, not the mentor's.
- **Meet allocation happens after the booking commits and is best-effort.** If
  Google fails, the failure is logged and the booking survives *without a link*.
  This is deliberate — losing a learner's booking because Google hiccuped would be
  worse — but it means "booking confirmed" does not imply "link exists".

---

## 2. Accounts you need

You need **three separate logins**, and for a full test **two distinct Google
accounts**.

| Role | App | Needs a Google account? | Why |
|---|---|---|---|
| **Admin** | `dash.vacademy.io` | Only to set the institute default | Proves the fallback path |
| **Mentor / teacher** | `dash.vacademy.io` → My Mentorship | Yes — their own | Proves the per-mentor path |
| **Learner** | `learner.vacademy.io` | No | Books and joins; never connects Google |

> Use two mentors if you can — **Mentor A connected**, **Mentor B not connected**.
> That is the single fastest way to prove both branches in one pass, because they
> differ only in which calendar the event appears on.

---

## 3. Setup (admin, ~10 minutes)

1. **Institute default Google** — Settings → integrations → connect a Google
   account. This is the fallback for every mentor who has not connected their own.
2. **Add two mentors** — Mentorship → Mentors → **Add mentor**.
   - Mentor A: pick an existing team member (*From your team*).
   - Mentor B: use **Invite by email** with an address you control. They get an
     invitation, land with the `MENTOR` role, and appear in the list immediately.
3. **Enable booking** for both — row menu → *Enable booking*. This provisions the
   booking page; without it the mentor has no link to share.
4. **Assign a learner** to each mentor — row action → *Assign students*.

**Checkpoint:** the Mentors table shows both, each with a capacity meter and
`Active`. Overview shows `2` mentors and the pairings you just made.

---

## 4. Mentor / teacher pass

Log in **as the mentor** (not as admin impersonating them — the screen reads
"who am I", so it must be their own session).

1. Go to **Mentorship → My Mentorship**.
2. **Mentor A: click *Connect Google*.** Complete consent on Mentor A's Google
   account. You come back with the card showing **Connected** and the address.
3. **Mentor B: leave it disconnected.**
4. Both mentors: **Edit availability** → set weekly hours, session length, notice.
5. Both mentors: **Copy link** — that is the learner-facing booking URL.

**Verify the connection actually landed** (the UI badge alone is not proof — it
reflects `google_connected` on the profile, which is derived from the column):

```sql
select display_name, google_account_id is not null as connected
from mentor
where institute_id = '<INSTITUTE_ID>';
```

Mentor A must have `connected = true`; Mentor B `false`. If Mentor A shows false
after consent, the OAuth state row expired (they are valid for **10 minutes**) —
just click *Connect Google* again and finish it promptly.

---

## 5. Learner pass

Log in as the learner on `learner.vacademy.io`.

1. Open the booking link for **Mentor A**, pick a slot, book it.
2. Do the same for **Mentor B**.
3. Check **My Mentors** and the dashboard widget — the next session shows with a
   **Join** button.

---

## 6. The actual Google assertions

This is the part the rest of the setup exists for.

| # | Check | Expected |
|---|---|---|
| 1 | Open **Mentor A's** Google Calendar | The event is there, with a Meet link, **owned by Mentor A** |
| 2 | Open the **institute** Google Calendar | Mentor A's event is *not* there |
| 3 | Open the **institute** Google Calendar again | **Mentor B's** event *is* there (fallback) |
| 4 | Open **Mentor B's** Google Calendar | Mentor B's event is *not* there |
| 5 | Learner clicks **Join** on each | Both open a working Meet room |
| 6 | Admin → Sessions table | Both rows show an enabled join icon |

Confirm at the data layer too — this is unambiguous where a calendar UI is not:

```sql
select m.display_name,
       m.google_account_id,
       bi.meet_link,
       bi.google_calendar_event_id
from booking_instance bi
join mentor m on m.booking_page_id = bi.booking_page_id
where m.institute_id = '<INSTITUTE_ID>'
order by bi.scheduled_start_utc desc;
```

`meet_link` and `google_calendar_event_id` must both be non-null for both
bookings. The difference between the two mentors is *which account minted them*,
which is what checks 1–4 establish.

---

## 7. Failure cases — force them, don't wait for them

| Case | How to force it | Expected behaviour |
|---|---|---|
| **No Google anywhere** | Disconnect the institute account, use Mentor B | Booking still **succeeds**. `meet_link` is null. Learner sees *"Link coming soon"*, mentor sees *"Link pending"*, admin's join icon is disabled with the reason in its tooltip |
| **Google revoked after connecting** | Revoke access in Google account settings, then book | Same as above — allocation is logged and skipped, booking survives |
| **OAuth state expired** | Start *Connect Google*, wait 10+ minutes, finish | Connection does not attach; `google_account_id` stays null. Retry works |
| **Double booking** | Two learners take the same slot simultaneously | Second gets *"This slot is no longer available"* — enforced by `uq_booking_host_slot`, not just a pre-check |
| **Mentor at capacity** | Set `max_mentees`, assign past it | Assignment reports `capacityFull`; the learner is named in the toast, never silently dropped |
| **Session cancelled** | Admin cancels from the Sessions table | Calendar entry and reminders removed; row shows `Cancelled`; the outcome is *not* written to `booking_instance.status` |
| **Mentor removed with a live pairing** | Remove a mentor who has students | Students unassigned, waiting requests released, their account untouched |

The first two are the ones worth doing every release: they are the only paths
where a learner ends up with a session they cannot join, and the only signal is
the wording on those three surfaces.

---

## 8. Automated coverage (what you do **not** need to test by hand)

| Layer | Tests | Covers |
|---|---|---|
| Backend | **121** | assignment + capacity, discovery/requests, feedback, session lifecycle, cancel/reschedule, double-booking, removal, reminder scheduler, notifications |
| Admin FE | **305** | dashboard figures, mentor table, sessions table + filters, mentor detail tabs, add/invite mentor, request queue |
| Learner FE | **163** | directory, requests, ratings, mentor cards, dashboard widget |

Run them:

```bash
mvn -o -pl admin_core_service test -Dtest='Mentor*Test,*Mentorship*Test,*Booking*Test'
cd frontend-admin-dashboard      && npx vitest run --pool=forks --poolOptions.forks.singleFork
cd frontend-learner-dashboard-app && npx vitest run --pool=forks --poolOptions.forks.singleFork
```

None of them touch Google. **Every Google assertion in section 6 is manual by
necessity** — that is the whole reason this document exists.

---

## 9. Quick smoke (15 minutes, one Google account)

When you only need to know the feature is alive:

1. Admin: add a mentor by **invite**, enable booking, assign a learner.
2. Mentor: connect Google, set availability, copy the link.
3. Learner: book a slot, confirm **Join** appears.
4. Mentor's Google Calendar: event present with a Meet link.
5. Mentor: record the outcome. Admin Overview's *awaiting review* count drops.

If step 4 fails, check `mentor.google_account_id` before anything else — it is the
single most common cause, and section 1 explains why the booking still succeeded.

# Mentorship & Booking — Manual E2E Test

A step-by-step manual test of the whole feature. Cast: **1 admin**, **1 team member**
(→ becomes the mentor), **1 enrolled student**. Use **real Google-invitable emails**
for the mentor and student so you can see calendar invites.

> **Deploy note:** the core feature (mentors, assign, book, message, notes/calls,
> Google Calendar, double-book guard) is on `main`. The **Add-mentor Team picker +
> profile photo** and the **dashboard widgets** are on `feat/mentorship-add-mentor-ux`;
> **per-mentor Google** is on `feat/mentorship-per-mentor-google`. Deploy/merge those
> branches to exercise those specific bits.

## 0. One-time setup (admin, ~5 min)
1. Deploy `admin_core` + `auth`; run migrations **V411 + V412** (admin_core) and **V15** (auth).
2. **Show the tabs** (hidden by default): Settings → **Display Settings** → enable **Mentorship**.
   In **Student Display settings**, enable **My Mentors**.
3. **Enable chat:** Settings → **Notification Settings** → turn on **In-App Messages**.
4. **Connect Google:** Settings → **LMS → Content & Delivery → Live Session Settings** →
   the **Google Meet Integration** card → **Connect** (Google consent). Re-authorize an
   already-connected account so it grants the new **Calendar** permission.
   *(Requires `GOOGLE_OAUTH_CLIENT_ID/SECRET`, an env-correct `GOOGLE_OAUTH_REDIRECT_URI`,
   and `OAUTH_TOKEN_ENCRYPTION_KEY` set on the backend.)*

## A. Admin sets up mentorship
5. **Mentorship → Mentors → Add mentor** → search your **team**, pick the member →
   (optional photo/title/bio) → **Add mentor**. *(They get the MENTOR role.)*
6. On the mentor's row → **Enable booking** (chip flips to "Booking on" — creates a default
   Mon–Fri 09:00–17:00 Google-Meet booking page).
7. On the mentor's row → **Assign** → search the student → **Assign**.
   *(Or **Bulk assign** to distribute several students across several mentors round-robin.)*
8. Admin **Dashboard** → the **Mentorship** KPI card appears (Mentors / Mentees / Today / Upcoming).

## B. Mentor's view
9. Log in as the **mentor** → **Mentorship → My Mentorship** → see the assigned student(s).
9a. **(Per-mentor Google, optional)** In the **Connect Google** card, click **Connect** →
    authorize **your own** Google account. You return to Settings with a success toast; back
    on My Mentorship the card shows **Connected · <email>**. From now on this mentor's
    bookings create the Meet + calendar event on **their own** Google calendar. Skip this to
    use the institute's default Google account (Part D still works either way).
10. **Details** on a student → add a **Note**; **Scheduled calls** is empty until they book;
    **Message** opens the DM.

## C. Learner books & messages
11. Log in to the **learner app as the student**.
12. **Dashboard** → the **My Mentors** widget appears (mentor + Book/Message).
13. **My Mentors** tab → the mentor's card → **Book** → pick a slot → confirm.
    *(Authenticated flow — the booking is tied to the student.)*
14. **Message** on the card → in-app DM with the mentor opens.

## D. Verify the payoff
15. **Google Calendar:** within seconds, the connected account's calendar shows the event;
    mentor + student get a **calendar invite with the Meet link**.
    *(DB: `booking_instance.google_calendar_event_id` is set.)*
16. **Mentor:** the booking shows under **My Mentorship → student → Details → Scheduled calls**,
    and in the mentor's **My Schedule** (`/meetings`).
17. **Learner dashboard:** the **My Mentors** widget shows **"Next session"** + a **Join** link.
18. **Admin dashboard:** the Mentorship card's **Today/Upcoming** counts tick up.

## E. Edge tests
19. **Cancel** the booking (invitee manage link, or reschedule) → the **Google Calendar event
    disappears** for both.
20. **Double-book:** two sessions grab the same slot at once → only one wins; the other gets
    *"This slot was just booked."*
21. **Slot conflict:** if the mentor has a **live class** at a time, that time is not offered.

## Troubleshooting
- **No mentor/learner tab?** → still hidden in Display Settings (step 2).
- **Add-mentor shows an all-user search / no dashboard widgets?** → the enhancement branch isn't deployed.
- **No calendar event / invite?** → the Google account hasn't re-authorized for Calendar (step 4).
  *Booking still succeeds regardless.*
- **No Meet link?** → Google account not connected for the institute.
- **Book button greyed out?** → you skipped **Enable booking** (step 6).
- **Widgets not visible?** → they self-hide until there's data (a mentor / an assignment), so do Part A first.

# Website Lead Capture → Audience Lists — Task Backlog

**Status:** designed, NOT built. Captured 2026-07-28 at the user's request
("for the leads/audience feature just collect the tasks we will implement later").

**Goal.** A catalogue/marketing site has several capture points (signup, newsletter,
contact form, brochure download, booking). An admin should be able to declare each
one, point it at an audience list / campaign, and map form fields onto lead fields —
without a developer.

---

## 0. Why this is P0, not a nice-to-have

The two lead-capture components on catalogue pages **silently discard every
submission today**. They fake success with no network call at all:

| Component | File | Current behaviour |
| --- | --- | --- |
| `contactForm` | `frontend-learner-dashboard-app/src/routes/$tagName/-components/JsonRenderer.tsx:622` | `handleSubmit = (e) => { e.preventDefault(); setSubmitted(true); }` |
| `newsletterSignup` | same file, `:1388` | `if (email) setSubmitted(true);` |

Both render a success message. The visitor believes they made contact; nothing is
stored, nothing is notified. **Any institute that shipped one of these has been
losing leads for as long as it has been live.** Task 1 is therefore a data-loss
fix, and should ship even if the rest of this backlog slips.

---

## Locked design decisions

Agreed with the user before deferral — do not re-litigate these:

1. **Named, site-level destinations.** Capture points are declared once per site
   (not per component instance) as named destinations, each bound to a campaign /
   audience list. A page component then just picks a destination by name. This
   keeps the page JSON free of audience IDs and survives page duplication.
2. **One campaign per destination.** Different capture points map to different
   campaigns, so attribution ("where did this lead come from") is intrinsic
   rather than inferred.
3. **Repeat submissions are a success, not an error.** A visitor who submits
   twice sees the success state; the backend upserts. Never surface a duplicate
   error to a visitor.
4. **Email OR phone is sufficient** — either one identifies a lead. This
   **requires a backend change**: email is mandatory server-side today.
5. **Spam defence: honeypot field + minimum time-to-submit.** No CAPTCHA in v1.

---

## Known gaps in the current implementation

Verified in code, not assumed:

- `contactForm` / `newsletterSignup` discard submissions (table above).
- `submit-catalogue` writes into a **single auto-created per-institute audience
  list** — there is no way to route different capture points to different lists.
- `submit-catalogue` keys custom fields **by field NAME, not ID**, so renaming a
  custom field silently breaks historical mapping.
- Email is **mandatory server-side** on the canonical submit endpoints, which
  blocks decision 4 (phone-only leads).
- **No spam defence of any kind** on the open (`/open/v1/...`) endpoints — they
  are unauthenticated by design and currently unprotected.

---

## Tasks

### Phase 1 — stop losing leads (ship independently)

- [ ] **1.1** Wire `contactForm` to the canonical `POST /open/v1/audience/lead/submit(/v2)`.
      Real pending/success/error states; never fake success.
- [ ] **1.2** Wire `newsletterSignup` to the same endpoint.
- [ ] **1.3** Client-side honeypot + min-time-to-submit on both.
- [ ] **1.4** Audit which live institutes have either component on a published
      page, and tell those institutes their historical submissions were lost.

### Phase 2 — configurable destinations (backend)

- [ ] **2.1** Model site-level capture destinations: `{name, campaignId,
      audienceListId, fieldMap, notify}` scoped to the institute/site.
- [ ] **2.2** CRUD + list endpoints for destinations (admin-authenticated).
- [ ] **2.3** Accept a destination name on the open submit endpoint and route the
      lead to that destination's campaign/audience list.
- [ ] **2.4** Relax the email-mandatory rule to **email-or-phone required**
      (decision 4). Check every caller before relaxing — some may rely on it.
- [ ] **2.5** Key custom fields **by ID** with a name fallback for existing rows.
- [ ] **2.6** Idempotent upsert on (institute, email|phone, campaign) so repeat
      submits succeed (decision 3).
- [ ] **2.7** Server-side abuse caps on the open endpoint (per-IP and
      per-institute rate limit), since honeypots only stop naive bots.

### Phase 3 — admin UI

- [ ] **3.1** Settings screen to declare destinations and bind each to a
      campaign / audience list.
- [ ] **3.2** Field-mapping editor: form field → lead field / custom field.
- [ ] **3.3** In the page builder, `contactForm` / `newsletterSignup` property
      panels get a **destination picker** (plus a warning when unset — that is
      the state that loses leads).
- [ ] **3.4** Per-destination submission counter so an admin can confirm capture
      is working without opening the CRM.

### Phase 4 — follow-through

- [ ] **4.1** Notification on new submission (email / WhatsApp) per destination.
- [ ] **4.2** UTM + referrer capture through to the lead record for attribution.
- [ ] **4.3** Extend the same destination model to the booking and
      brochure-download capture points.

---

## Sequencing note

Phase 1 depends on nothing and fixes active data loss — do it first. Phase 2.4
(email-or-phone) is the only change with real blast radius, because existing
callers may assume email is always present; audit before relaxing.

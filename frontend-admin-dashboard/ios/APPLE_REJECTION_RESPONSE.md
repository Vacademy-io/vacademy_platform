# Vacademy Admin — Apple Rejection Resolution

Submission ID: `de8c7097-685a-43b8-b17d-2df1288afddc`
Version reviewed: **1.0 (2)** · Review device: iPad Air 11" (M3), iPadOS 26.5.2

Four issues were raised. Three are fixed in code (this build, **1.0 (3)**); one (3.2)
needs a written reply in the App Store Connect Resolution Center. Details below.

---

## Issue 1 — Guideline 3.2 (Business): "app looks like it's for a specific business"

**Nothing to fix in code.** Apple's automated triage flagged an "admin/console" app as
possibly an internal tool for one company. It isn't — Vacademy is public multi-tenant SaaS.
Paste the reply below into the Resolution Center, answering their 5 questions in order.

### ▶ Paste this into App Store Connect → Resolution Center

> Thank you for the review. Vacademy is a **public, multi-tenant SaaS platform** (an
> online-academy / learning-management builder) — it is **not** the internal tool of any
> single company. It is the equivalent of admin/console apps such as Shopify, Teachable,
> Kajabi, Thinkific, or WordPress, which are available to any business or individual on the
> App Store. Answering your questions directly:
>
> **1. Is the app restricted to users who are part of a single company or organization?**
> No. It is open to the general public. Any educator, coaching institute, school, tutor, or
> content creator — anywhere in the world, with no affiliation to us — can sign up and run
> their own independent academy. There is no single owning company or closed user group.
>
> **2. Is the app designed for a limited/specific group of companies? Can any organization
> become a client?**
> It is not limited to any list of companies. **Any** organization or individual can
> self-register and immediately become a client, with no invitation, sales contact, or
> pre-approval. The institutes already using Vacademy are independent and unrelated to each
> other (different subjects, countries, and business owners) — they are our customers, the
> same way merchants are Shopify's customers.
>
> **3. Which features are for the general public?**
> All of them. After a public self-service sign-up, any user can create courses, add and
> manage their own learners, run live classes, build assessments, and view analytics for the
> academy **they** own. Nothing requires membership in a specific organization — the general
> public can discover, download, register, and use the app without invitation or affiliation.
>
> **4. How do users obtain an account?**
> Self-service registration inside the app (and at vacademy.io) using email/password or
> Google Sign-In. Accounts are created instantly by the user; we do not manually provision
> or gate them.
>
> **5. Is there any paid content in the app, and who pays for it?**
> The app is **free to download, register, and use** its core features. There is **no digital
> content or credit purchase inside the iOS app** — we have removed the in-app credit top-up
> in this build. Any optional platform subscription an institute chooses (the B2B software fee
> to use Vacademy at scale) is arranged outside the app through our website/sales, not sold as
> consumer digital content in the app.
>
> Because any member of the public can independently sign up and operate their own academy,
> we believe public App Store distribution is the correct choice, and we respectfully ask you
> to reconsider under Guideline 3.2. We're happy to provide a demo account or a screen
> recording of the public sign-up flow if useful.

*(Optional: also add a reviewer demo admin account under App Store Connect → App Review
Information → Sign-In / Notes, plus one line: "Public sign-up: open the app → Create account.")*

---

## Issue 2 — Guideline 3.1.1 (In-App Purchase): credit top-up not via IAP

**Fixed in code.** The AI-credit "Top up" button and its purchase modal are now hidden on
native iOS, so the app no longer sells digital content outside In-App Purchase.

- `src/components/common/ai-credits/AiCreditsPanel.tsx` — `hideTopUp` is now forced true on
  iOS via `isIOS()` (`hideTopUp = hideTopUpProp || isIOS()`); this hides both the footer
  "Top up" button and the `<TopUpModal>` entirely.
- Confirmed repo-wide that `TopUpModal` has no other entry point, and no other
  recharge/buy-credit/plan-purchase CTA is reachable in the admin app.
- Credit **balance** still displays (allowed — showing a balance is not a purchase).

---

## Issue 3 — Guideline 2.1(a): "error message when we attempted to top up the credits"

**Fixed by the same change.** The buggy top-up flow the reviewer hit is no longer present on
iOS (the entry point is removed per Issue 2), so the error can no longer occur.

---

## Issue 4 — Guideline 2.1(a): crash on "Take Photo"

**Fixed in code.** iOS terminates any app that touches the camera/photo library/mic without a
usage-description string in `Info.plist`. Those keys were missing. Added to
`ios/App/App/Info.plist`:

- `NSCameraUsageDescription`
- `NSPhotoLibraryUsageDescription`
- `NSPhotoLibraryAddUsageDescription`
- `NSMicrophoneUsageDescription`

Selecting "Take Photo" now shows the standard iOS permission prompt instead of crashing.

---

## Resubmission steps (do these on the Mac)

1. **Build is already synced** — `pnpm run cap:sync:vacademy-admin` ran the web build
   (flavor `vacademy-admin`) and copied it into the iOS project. Version is **1.0 (3)**.
2. Open Xcode: `pnpm run cap:open:vacademy-admin:ios`
3. Select **Any iOS Device (arm64)** as the destination (not a simulator).
4. **Product → Archive.** When the Organizer opens, **Distribute App → App Store Connect →
   Upload.**
5. In **App Store Connect → Apps → Vacademy Admin → version 1.0** (still shown as
   *Rejected*): under **Build**, remove build (2) if attached and **select the new build (3)**
   once it finishes processing (~5–15 min).
6. Go to **Resolution Center**, paste the 3.2 reply above, and note that Issues 2/3/4 are
   fixed in build 3.
7. Click **Add for Review / Submit** on version 1.0.

> Reviewed on an **iPad** — verify on an iPad (or iPad simulator) before archiving:
> the top-up button is gone and "Take Photo" shows a permission prompt (no crash).

# Vacademy iOS — Reader-App Compliance Implementation

**Date:** 2026-06-21
**Scope:** `frontend-learner-dashboard-app` only (no backend, no DB migration)
**Status:** Implemented & verified (tsc + design-lint clean), uncommitted in working tree.

This document explains **what was changed and why** to get the learner iOS app past Apple
App Review. For the remaining **manual** steps (Xcode / App Store Connect), see
[`VACADEMY_IOS_COMPLIANCE_CHECKLIST.md`](./VACADEMY_IOS_COMPLIANCE_CHECKLIST.md).

---

## The problem

The iOS app kept getting rejected for two reasons:

| # | Apple Guideline | Why it was rejected |
|---|---|---|
| 1 | **3.1.1 — In-App Purchase** | Courses (digital content) were sold inside the app via external payment gateways (Stripe/Razorpay). Apple requires digital purchases to use Apple IAP, or not be sold in the app at all. |
| 2 | **4.8 — Sign in with Apple** | The app offered Google/GitHub login without also offering Sign in with Apple. |

Two secondary risks were fixed in the same pass: **5.1.1(v)** (in-app account deletion) and
**5.1.2** (analytics tracking without an ATT prompt).

---

## The strategy: run iOS as a "reader app"

Apple's "reader app" model: **don't sell anything inside the iOS app.** Users purchase on the
**web**; the iOS app only unlocks content they already own. This avoids Apple's 15–30% IAP cut
and is how most edtech apps comply.

Concretely:
- **iOS app** → all pricing, buying, and Google/GitHub login are **hidden**.
- **Web + Android + desktop** → **completely unaffected** — full pricing, checkout, and social
  login. This is critical: revenue still flows through the web, which is the whole point of the
  reader-app model.

### Why a pure runtime check (and not a setting/toggle)

An earlier attempt put this behind a per-platform admin toggle so it could be flipped back on
after approval. **That is dangerous** — re-enabling external payment / non-Apple social login
after review is a **Guideline 2.3.1 violation** (hidden/post-review behavior change) and gets the
**entire developer account terminated**, not just the app rejected.

So the gate is a **pure runtime platform check with nothing to toggle**:

```ts
// src/utils/ios-iap-compliance.ts
export const isIOSNative = () => Capacitor.getPlatform() === "ios";
export const shouldHidePaidPurchaseUI = () => isIOSNative();
```

No institute setting, no admin tab, no remote flag, no localStorage cache. To legitimately sell
or show social login on iOS later, implement **StoreKit IAP** / **Sign in with Apple** — don't
flip a switch.

---

## What changed in code

### Keystone
- **`src/utils/ios-iap-compliance.ts`** — the single source of truth. Exports `isIOSNative()`,
  `shouldHidePaidPurchaseUI()`, `useHidePaidPurchaseUI()`.

### Payment / commerce hidden on iOS (Guideline 3.1.1)
- **`components/common/price-with-mrp.tsx`** — `PriceWithMrp` + `OfferBadge` return `null`. This
  is the global choke point that kills **every** price / MRP / "% off" in the app.
- **`routes/__root.tsx`** — `beforeLoad` blocks marketplace/payment routes
  (`/courses`, `/product-pages`, `/admission/payment`, `/pay`, `/payment-result`) before the
  public-route bypass.
- **`routes/$tagName/index.tsx`**, **`routes/$tagName/$courseId/index.tsx`**,
  **`routes/learner-invitation-response/index.tsx`** — `beforeLoad` redirect to `/dashboard`.
- **`routes/dashboard/-components/MyOrdersWidget.tsx`**, **`MyMembershipWidget.tsx`**,
  **`MyBooksWidget.tsx`** — early `return null`.
- **`routes/dashboard/index.tsx`** — "Explore Memberships/Books" commerce section hidden.
- **`routes/study-library/courses/-component/CourseCatalougePage.tsx`** — "All Courses" (browse)
  tab dropped; only In-Progress / Completed remain.
- **`.../course-details/-components/course-enrollment.tsx`**, **`course-sidebar.tsx`** — Enroll/pay
  CTAs hidden.
- **`.../payment-dialogs/EnrollmentPaymentDialog.tsx`** — paid branches hidden (FREE path kept).
- **`components/common/donation/DonationDialog.tsx`** — returns `null`.
- **`components/common/enroll-by-invite/-components/enrollment-policy-dialog.tsx`**,
  **`payment-pending-step.tsx`**, **`enroll-form.tsx`** — upgrade/complete-payment CTAs and
  external-gateway redirects gated.
- **`components/common/user-profile/user-page.tsx`** — "Membership Status" / Access Days card
  hidden.

### Social login hidden on iOS (Guideline 4.8)
- **`.../auth/login/forms/page/login-form.tsx`**,
  **`.../auth/login/components/modular/ModularDynamicLoginContainer.tsx`**,
  **`.../auth/signup/components/ModularDynamicSignupContainer.tsx`** — Google/GitHub buttons +
  divider wrapped in `!isIOSNative()`. Email + phone/OTP remain the iOS login methods.

### Account deletion (Guideline 5.1.1(v))
- **`hooks/use-student-permissions.ts`** — forces `canDeleteProfile = true` on iOS so the
  Delete Account flow is always reachable (one change covers the route guard + all 3 menus).

### Analytics (Guideline 5.1.2)
- **`lib/analytics.ts`** — Amplitude disabled on native iOS (autocapture = tracking, and there's
  no ATT prompt).

### Native / iOS project files
- **`ios/App/App/Info.plist`** — camera/mic usage strings rewritten to learning-app wording;
  added `ITSAppUsesNonExemptEncryption = false`. (Plus two stale brand plists touched.)
- **`ios/App/App/PrivacyInfo.xcprivacy`** — new privacy manifest (must be wired into Xcode
  targets — see checklist #2).

---

## Verification

```bash
cd frontend-learner-dashboard-app
node --max-old-space-size=8192 node_modules/typescript/bin/tsc --noEmit   # exit 0, no errors
node ../scripts/design-lint.mjs <changed .tsx files>                       # design-lint: clean ✓
```

Both pass.

---

## How to ship

> ⚠️ Info.plist + `PrivacyInfo.xcprivacy` are **native** changes — **OTA cannot deliver them.**
> A fresh binary submitted to App Review is required.

1. `cd frontend-learner-dashboard-app && npm run build && npx cap copy ios`
   (`npx cap sync ios` if pods changed).
2. Complete the **manual** items in
   [`VACADEMY_IOS_COMPLIANCE_CHECKLIST.md`](./VACADEMY_IOS_COMPLIANCE_CHECKLIST.md) —
   especially **#1 a demo account** in App Store Connect (the app is a login wall; missing
   credentials is the most common rejection).
3. Archive in Xcode → submit to App Review.
4. (Optional) Publish the learner **OTA** (`scripts/publish-ota.sh`, bump `package.json` version
   first) so existing installs pick up the JS-level gating too.

No backend deploy and no DB migration are required.

---

## Future: bringing commerce / social login back to iOS (the legitimate way)

- **Sell on iOS** → implement **StoreKit In-App Purchase** (Apple takes 15–30%): StoreKit
  products, server-side receipt validation, IAP-product → course mapping.
- **Google/GitHub on iOS** → add **Sign in with Apple** alongside them (capability +
  `@capacitor-community/apple-sign-in` + backend Apple-token exchange), then remove the
  `!isIOSNative()` gates in the three login files.

Either path is a normal feature submitted through a normal review — **never** a post-approval
remote flip.

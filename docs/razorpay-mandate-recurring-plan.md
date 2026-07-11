# Recurring Payments via UPI / Card Mandate (Razorpay first)

**Status:** Proposed | **Date:** 2026-07-08
**Scope:** admin_core_service — add true UPI Autopay / card e-mandate recurring payments, per-plan
autopay + free-trial settings on invite links, and an auto-charge scheduler with grace-period dunning.
Razorpay first; other providers follow the same abstraction.

## Context

We want learners on **paid subscription plans** to be auto-charged on renewal without re-entering
card/UPI details — i.e. true **UPI Autopay / card e-mandate**. The mandate's max
debit amount (`max_amount`) is **derived from the payment plan amount** (the recurring charge), not a
separate institute-level limit. Paid plans attached to an invite link need
per-plan settings for **autopay** and a **free-trial** (e.g. 14 days: give access now, take *no*
money, set the plan's next expiry to `today + trialDays`, and take the **first** real debit on that
trial-end date). When a plan's `end_date` reaches "today", a scheduler must debit the renewal via
the stored mandate; on failure it retries over a grace window before expiring access.

### What already exists (verified in code)
- **Provider strategy**: `PaymentServiceFactory` / `PaymentServiceStrategy` with Razorpay, Stripe,
  PhonePe, Cashfree, eWay managers. Institute creds in `institute_payment_gateway_mapping.payment_gateway_specific_data` (JSON).
- **Per-user token store**: `user_institute_payment_gateway_mapping` (`payment_gateway_customer_id`,
  `payment_gateway_customer_data` JSON).
- **Token capture**: `RazorpayWebHookService` (lines ~662–727) already pulls `token_id` from the
  `payment.captured` webhook and saves it into the user mapping JSON.
- **Renewal webhook routing**: webhook detects `payment_type=RENEWAL` (line ~254) →
  `handleRenewalPayment` → `RenewalPaymentService.handleRenewalPaymentConfirmation` (extends `end_date`).
- **Renewal eligibility gate**: `PaymentRenewalCheckService.shouldAttemptPayment` (SUBSCRIPTION type +
  `enableAutoRenewal` policy flag + non-MANUAL vendor).
- **Enrollment policy**: `onExpiry.enableAutoRenewal` already in `EnrollmentPolicySettingsDTO`.
- **Reminder scheduler**: `PackageSessionScheduler.emitMembershipExpiryReminders` (daily 09:00) — fires
  a `MEMBERSHIP_EXPIRY` workflow reminder 7 days out. **Reminder only; it never charges.**

### The real gaps (this is the actual work)
1. **No mandate is registered.** `RazorpayPaymentManager.createRazorpayOrder` sets only amount/currency/
   receipt/notes — no `customer_id`, no `token: {max_amount, frequency, expire_at}`, no `recurring`
   flag. So today's captured `token_id` is a saved-card token, **not** an authenticated UPI-Autopay /
   card e-mandate. Registering the mandate (with a limit) is the core new work.
2. **No charge is ever initiated.** There is no `createRecurring` / MRN charge call anywhere;
   `RenewalPaymentService` only *reacts* to a webhook. Nothing debits on the due date.
3. **No trial** concept anywhere.
4. **No mandate `max_amount`** is set (it must be derived from the payment plan amount).
5. **No per-plan autopay/trial settings** on the invite.
6. **`RenewalPaymentService.calculateNewEndDate` is hardcoded to 30 days** (TODO) — must derive from
   `payment_plan.validity_in_days`; notification bodies are stubbed TODOs.

### Design decisions (confirmed with user)
- **App-driven e-mandate/token model** (not Razorpay Subscriptions API) — we register the mandate and
  our scheduler triggers each charge. Keeps control of date/trial/dunning and unifies across providers.
- **Trial**: register mandate at signup (₹0/auth), take no real payment, `end_date = today + trialDays`,
  first real debit on trial-end date.
- **Mandate `max_amount`**: derived from the payment plan amount (the recurring charge). For fixed-price
  plans `max_amount = plan recurring amount`; a small buffer multiple may be applied so price changes /
  taxes don't exceed the mandate. No separate institute-level limit config.
- **Storage**: no new mandate table — mandate details live in the existing
  `user_institute_payment_gateway_mapping.payment_gateway_customer_data` JSON, keyed per `userPlanId`
  (one mandate per paid plan). Only a small `user_plan` migration for scheduler state.
- **Failed renewal**: retry across a short grace window (≈3 attempts / 3–5 days) with notifications,
  then expire access.

---

## Subscription lifecycle (autopay is the *mechanism*, not a separate flow)

"Autopay" is not a different feature from subscription renewal — it is how the renewal payment is
collected (auto-debit a saved mandate/token) instead of the learner manually paying a link. The lifecycle
is identical either way; only the payment trigger differs.

| Event | Access | Plan state |
|---|---|---|
| Renewal charge **succeeds** (auto or manual) | continues | `end_date` / `next_charge_at` extended by `validity_in_days` |
| Charge **fails** on due date | **unchanged — kept until `end_date`** | enter grace window; retry (autopay) or await manual pay |
| Mandate **cancelled/revoked mid-cycle** | **unchanged — kept until `end_date`** | mandate marked `REVOKED`; no auto-charge at expiry → falls into grace→revoke (or manual-pay prompt) |
| Payment **received during grace** | continues | plan extended |
| Grace window **elapses unpaid** | **revoked** | plan `EXPIRED` + `StudentSessionInstituteGroupMapping` deactivated |

Key rule: **a failed or cancelled mandate never cuts access early.** The learner always keeps what they
already paid for through `end_date`; only *after* expiry + grace with no payment is access revoked. This
is why the mandate lives independently of the plan's active window — cancelling autopay ≠ cancelling the
current subscription.

Mandate-cancellation is captured from provider webhooks (Razorpay `subscription/token` cancelled events,
Stripe `payment_method.detached` / mandate updates, etc.): set the mandate JSON `status=REVOKED` and clear
`auto_renewal_enabled` so the scheduler stops trying — **without** modifying `end_date` or access.

## Implementation

Phased; each phase is independently shippable. **Razorpay is Phase 1–5; other providers are Phase 6.**
All schema changes go through **Flyway migrations** (never ddl-auto). Latest admin_core migration is
`V364`; new files continue from `V365`.

### Phase 0 — Data model & config

**No new mandate table.** Mandate details reuse the existing per-user gateway mapping JSON (where the
token is already captured). Only a small `user_plan` migration is added for scheduler state.

**Migration** (`admin_core_service/src/main/resources/db/migration/`):
- `V365__user_plan_autopay_columns.sql` — add to `user_plan`:
  `auto_renewal_enabled boolean default false` (denormalised so the due-query is cheap),
  `next_charge_at timestamp` (usually = `end_date`; explicit so trial and renewal are handled uniformly),
  `is_trial boolean default false`,
  `renewal_attempt_count int default 0`,
  `last_renewal_attempt_at timestamp`.
  `max_amount` is **not** a column — it's computed from the payment plan amount at registration and
  stored in the mandate JSON (below).

**Mandate storage — existing table, no new entity.** Store the mandate in
`user_institute_payment_gateway_mapping.payment_gateway_customer_data` (JSON), **keyed by `userPlanId`**
so a learner can hold one mandate per paid plan in the same institute:
```
payment_gateway_customer_data = {
  "customerId": "cus_...",
  "mandates": { "<userPlanId>": { "tokenId": "token_...", "maxAmount": 4999,
                                  "currency": "INR", "frequency": "as_presented",
                                  "status": "ACTIVE", "vendor": "RAZORPAY" } }
}
```
Add helper methods on the existing `UserInstitutePaymentGatewayMappingService`:
`upsertMandate(userId, instituteGatewayMappingId, userPlanId, mandateJson)` and
`getMandate(userId, institute, userPlanId)`.

**Entities/repos**:
- Extend `UserPlan` entity + a mapper for the new columns.
- Add `UserPlanRepository.findDueForRenewal(now)` (status ACTIVE + `auto_renewal_enabled=true` +
  `next_charge_at <= now`).

### Phase 1 — Mandate registration on first payment (Razorpay)

Extend the **strategy interface** `PaymentServiceStrategy` with mandate-aware methods (default no-op so
other managers still compile):
- `PaymentResponseDTO initiateMandatePayment(user, request, gatewayData)` — first payment that also
  registers the mandate.
- `Map<String,Object> chargeRecurring(mandateJson, PaymentInitiationRequestDTO request, gatewayData)` —
  off-session debit; `mandateJson` = the per-`userPlanId` mandate entry (tokenId, customerId, maxAmount).

**`RazorpayPaymentManager`** (`features/payments/manager/RazorpayPaymentManager.java`):
- New `createRazorpayMandateOrder(...)`: like `createRazorpayOrder` but adds `customer_id` (create/find
  via existing `createCustomer`/`findCustomerByEmail`), and a `token` block:
  `{max_amount: <derived from payment plan amount, in paise>, expire_at, frequency: "as_presented"|"monthly"}`
  plus `payment_capture=1`. The checkout is invoked by the frontend with `recurring: 1` + `customer_id`.
- New `chargeRecurring(...)`: create a fresh order for the renewal amount, then
  `razorpayClient.payments.createRecurring(req)` with `customer_id`, `token`, `order_id`,
  `email`, `contact`, `recurring: 1`, `notes.payment_type=RENEWAL`, `notes.orderId=<new paymentLog id>`.
  Returns provider payment id/status. (Actual capture confirmation still arrives via webhook.)
- **Amount vs limit guard**: reject `chargeRecurring` if `request.amount > mandate.maxAmount`.

**Webhook** (`RazorpayWebHookService`): the existing token-capture block (~662) is extended — on the
first `payment.captured` (or `token.confirmed`) for a mandate order, `upsertMandate(...)` into the
mapping JSON keyed by `userPlanId` (status `ACTIVE`, `maxAmount`, `frequency`, `customerId`, `tokenId`)
instead of just writing the bare token. Existing bare-token write stays for non-mandate saved cards.

### Phase 2 — Per-plan settings on the invite

Reuse the existing JSON-envelope pattern (`enroll_invite.setting_json`). Add a typed
`RecurringPaymentSettingDTO` read/written alongside the enrollment policy:
- `autopayEnabled` (bool), `trialDays` (int, 0 = none), `mandateFrequency`, `gracePeriodDays`,
  `maxRenewalAttempts`, optional `mandateBufferMultiplier` (default 1 → `max_amount = plan amount`).
- Surface in the enroll-invite create/update DTOs + `LearnerEnrollInviteService` so the admin dashboard
  can configure it per paid plan. `max_amount` itself is **not** an admin field — it is computed from the
  linked `payment_plan` amount at mandate-registration time.

### Phase 3 — Trial handling in enrollment

In the paid-enrollment path (`SchoolEnrollService.handleOnlinePayment` / `PaymentService.handlePayment`):
- If `trialDays > 0`: still run **mandate registration** (Phase 1) so autopay is authorized, but set the
  first payment amount to the mandate auth amount (₹0 / provider min), do **not** create a paid
  `PaymentLog` for the plan price. On successful mandate confirmation set
  `user_plan`: `status=ACTIVE`, `is_trial=true`, `start_date=now`,
  `end_date = now + trialDays`, `next_charge_at = end_date`, `auto_renewal_enabled=true`.
- If `trialDays == 0`: current behaviour (charge full price now) **plus** mandate registration when
  `autopayEnabled`, with `next_charge_at = now + validity_in_days`.

### Phase 4 — Auto-charge (reuse existing scheduler) + dunning

There is no existing job that *charges* — the current pieces are reminder-only
(`emitMembershipExpiryReminders`) and a webhook *reactor* (`RenewalPaymentService`, which only processes a
charge that already happened but is never initiated). The single missing piece is initiating the charge on
the due date. **Do not add a new scheduler class** — add a sibling `@Scheduled` method
`emitRenewalCharges()` to the existing **`PackageSessionScheduler`** (it already runs daily and scans
`user_plan`), running a few hours after the reminder method. Per due plan (`findDueForRenewal(now)`):
1. `PaymentRenewalCheckService.shouldAttemptPayment` gate (already exists).
2. Load the mandate JSON (`getMandate(userId, institute, userPlanId)`); compute renewal amount from
   `payment_plan` amount / plan snapshot.
3. Create a `RENEWAL` `PaymentLog`, call `strategy.chargeRecurring(...)`.
4. Increment `renewal_attempt_count`, set `last_renewal_attempt_at`; **do not** move `end_date` here —
   that happens on the webhook (Phase 5).
5. **Dunning**: if a prior attempt is still unconfirmed/failed and `attempt < maxRenewalAttempts`, the
   next daily run re-attempts (spacing via `next_charge_at += 1 day` on failure). When
   `renewal_attempt_count >= maxRenewalAttempts` and still unpaid past the grace window → set
   `user_plan.status=EXPIRED`, mark the mandate JSON `status=FAILED`, deactivate
   `StudentSessionInstituteGroupMapping`, send failure notification.
   Idempotency: reuse the `workflow_execution`/PaymentLog dedup style already used by the reminder job so
   two replicas don't double-charge (unique key per `userPlanId + billing cycle date`).

### Phase 4b — Confirmation model differs by provider (sync vs webhook)

`chargeRecurring` returns a definitive status where the provider gives one synchronously; otherwise the
result is finalized by webhook. The scheduler must handle both:
- **eWay** — **no webhook** (`EwayPoolingService` polls). `chargeToken` (TransactionType `Recurring`)
  returns the transaction result **inline**. So for eWay the scheduler applies the `end_date` /
  `next_charge_at` extension **directly from the `chargeRecurring` response** (success → extend;
  decline → dunning). Do **not** wait for a webhook.
- **Razorpay / PhonePe / Cashfree** — charge is acknowledged, then confirmed **asynchronously** via the
  existing `payment_type=RENEWAL` webhook → `RenewalPaymentService` (Phase 5) extends the plan.
- **Stripe** — off-session PaymentIntent returns a status inline *and* fires a webhook; treat the webhook
  as the source of truth, use the inline status only to short-circuit obvious declines.

So `RenewalPaymentService.handleSuccessfulRenewal` must be callable from **both** the webhook path and the
scheduler (for eWay), sharing the same end-date/next-charge extension logic.

### Phase 5a — Onboard existing autopay-enabled eWay customers (one-time backfill)

Existing eWay customers already hold a saved `TokenCustomerID` (in `payment_gateway_customer_id`) and
**enabled autopay at enrollment**, so they can be renewed on the saved token with no re-auth and no
mandate registration. They are **not** auto-charged by default (new columns default off) — a deliberate
backfill opts them in:
- One-time data migration: for eligible ACTIVE eWay plans set `auto_renewal_enabled = true` and
  `next_charge_at = end_date`.
- eWay `chargeRecurring` reads the existing `payment_gateway_customer_id` (TokenCustomerID) directly — no
  need to synthesize a `mandates.<userPlanId>` JSON entry for legacy eWay tokens.
- Add a **no-CVN** token-charge path (`chargeToken` currently takes a CVN, unavailable for unattended
  renewals; eWay allows stored-card `Recurring` charges without CVN).
- At expiry the scheduler charges the token and extends the plan from the **inline** response (Phase 4b).

### Phase 5 — Fix renewal-confirmation side (existing stubs)

`RenewalPaymentService`:
- `calculateNewEndDate`: replace the hardcoded 30 days with `payment_plan.validity_in_days` (fall back to
  the plan snapshot on `user_plan.plan_json`); advance from the prior `end_date` (or `next_charge_at`) so
  cycles don't drift.
- On success: clear `renewal_attempt_count`, set `is_trial=false`, set
  `next_charge_at = new end_date`, extend mappings (already done).
- Wire the notification TODOs to the existing enrollment-policy notification services
  (`INotificationService` / `EmailNotificationService`) and the `BillingContactRecipientResolver`
  already referenced in the TODO comments.

### Phase 6 — Other providers (future-proofing verified)

The two new interface methods are enough for **every** provider — no shared-path rework later. Per-provider
work is purely additive: (a) implement the two methods in that one manager, (b) add any provider-specific
ids to that provider's **own** sub-DTO (`StripeRequestDTO`, `CashfreeRequestDTO`, …) and to the free-form
mandate JSON. The shared enrollment/trial/scheduler/dunning path never changes. `max_amount` is always
app-enforced, so providers with no native limit still work.

Provider readiness (from a code audit of each manager) — do them easiest-first:

| Provider | Native recurring product | Manager today | Effort | Notes |
|---|---|---|---|---|
| **Razorpay** | Recurring token / UPI Autopay e-mandate | order + customer + token capture | Phase 1–5 | first target |
| **eWay** | Card-on-file `TokenCustomer` | **already** has `createCustomer` (TokenCustomerID), `chargeToken`, `TransactionType="Recurring"` | **Low** | `chargeRecurring` ≈ existing `chargeToken`; card only, no UPI |
| **Stripe** | SetupIntent + off-session PaymentIntent | **already** has `createSetupIntent` (`usage=off_session`), `attachAndSetDefaultPaymentMethod` | **Low** | mandate JSON = `{customerId, paymentMethodId}`; trial = zero-amount SetupIntent |
| **PhonePe** | Autopay mandate | payment only (v1/v2); customer stubbed | **Medium** | mandate *registration* is a separate call; mandate id captured on webhook (same pattern as Razorpay token capture) |
| **Cashfree** | Subscriptions / UPI Autopay eNACH | hosted-checkout order only; customer stubbed | **Medium** | must use Subscriptions API, not one-time order; add `subscriptionId` to `CashfreeRequestDTO` |
| **PayPal** | Billing Agreements / Subscriptions | fully stubbed | **Deferred** | whole provider unimplemented; do when PayPal is first needed |

Key design note that keeps all of them on one interface: for UPI-mandate providers (Razorpay, PhonePe,
Cashfree) the mandate is **confirmed asynchronously via webhook** — exactly like today's Razorpay
token-capture. So `initiateMandatePayment` starts the checkout/registration and the webhook populates the
mandate JSON; `chargeRecurring` runs later off the stored mandate. The **trial** flow reuses this directly:
a trial signup is just `initiateMandatePayment` at a zero/auth amount (Stripe SetupIntent, Razorpay
`max_amount` token, etc.), so no separate "registration-only" method is needed.

Managers without mandate support keep the interface's default no-op and simply don't offer autopay, so
partially-migrated state is always safe.

---

## Files to create / modify

**Create**
- `db/migration/V365__user_plan_autopay_columns.sql` (user_plan scheduler-state columns only)
- `features/.../dto/RecurringPaymentSettingDTO.java`

**Modify**
- `features/enrollment_policy/scheduler/PackageSessionScheduler.java` (add `emitRenewalCharges()` sibling method)
- `features/payments/manager/PaymentServiceStrategy.java` (+ default methods), `RazorpayPaymentManager.java`
- `features/payments/service/RazorpayWebHookService.java` (token block → mandate upsert in mapping JSON)
- `features/user_subscription/service/UserInstitutePaymentGatewayMappingService.java` (upsert/get mandate JSON, keyed by userPlanId)
- `features/enrollment_policy/service/RenewalPaymentService.java` (real end-date + notifications),
  `PaymentRenewalCheckService.java` (reuse as-is)
- `features/user_subscription/entity/UserPlan.java` + `repository/UserPlanRepository.java`
- `features/admission/service/SchoolEnrollService.java` / `features/payments/service/PaymentService.java` (trial + mandate on enroll)
- Enroll-invite create/update DTOs + `LearnerEnrollInviteService` (per-plan recurring settings)

## Verification
- **Local build**: `mvn -q -pl admin_core_service -am compile` (PowerShell; quote `-Dsentry.skip=true` if needed).
- **Razorpay test mode**: configure a test institute mapping; run enroll with (a) `trialDays=14` and
  (b) `trialDays=0, autopayEnabled=true`. Confirm: mandate registered (Razorpay dashboard shows an
  authenticated token with the max_amount), the mapping JSON has a `mandates.<userPlanId>` entry,
  `user_plan` has correct `end_date`/`next_charge_at`/`is_trial`, and no paid PaymentLog for the trial case.
- **Charge path**: force a plan's `next_charge_at` to now (read-only DB is prod; use a test env for
  writes), run `RenewalChargeScheduler`, confirm a `RENEWAL` PaymentLog + Razorpay recurring charge, then
  fire the `payment.captured` webhook and confirm `end_date` advances by `validity_in_days` and mappings extend.
- **Dunning**: simulate a failed recurring charge (amount over `max_amount`, or Razorpay test failure),
  confirm retries increment `renewal_attempt_count`, notifications fire, and the plan expires only after
  `maxRenewalAttempts`.
- **Limit guard**: attempt `chargeRecurring` above `max_amount` → rejected before hitting Razorpay.

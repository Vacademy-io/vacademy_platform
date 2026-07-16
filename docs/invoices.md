# Payment & Invoice System

This document describes every payment and invoice flow end-to-end: data model, state machine, API surface, backend service wiring, frontend screens, and the ledger that ties them together. Read this before building anything that touches money.

Related documents:
- [`docs/payment-system.md`](./payment-system.md) — gateway adapter layer (Razorpay, Cashfree, PhonePe, Stripe, eWay)
- [`docs/invoice-template-system.md`](./invoice-template-system.md) — HTML template engine, placeholder resolution, PDF generation

---

## Table of Contents

1. [Overview](#overview)
2. [Data Model](#data-model)
3. [Invoice Sources and Lifecycle](#invoice-sources-and-lifecycle)
4. [User Account Ledger](#user-account-ledger)
5. [CPO / Fee Installment Flow](#cpo--fee-installment-flow)
6. [Admin Manual Invoice Flow](#admin-manual-invoice-flow)
7. [Gateway Payment Flow](#gateway-payment-flow)
8. [Offline / Manual Payment Recording](#offline--manual-payment-recording)
9. [Sub-Org Payment Flow](#sub-org-payment-flow)
10. [Invoice Rejection and Voiding](#invoice-rejection-and-voiding)
11. [Account Summary Calculation](#account-summary-calculation)
12. [Email and Notifications](#email-and-notifications)
13. [API Reference](#api-reference)
14. [Frontend Screens](#frontend-screens)
15. [Extending the System](#extending-the-system)

---

## Overview

Vacademy has three distinct payment paths that all converge on the same `invoice` table and `user_account_ledger`:

| Path | Who triggers it | Invoice source | Payment recording |
|---|---|---|---|
| **CPO installment** | Enrollment to a fee-plan course | `STUDENT_FEE_PAYMENT` | `FeeLedgerAllocationService` allocates per-installment |
| **Admin invoice** | Admin creates invoice manually for a learner or org | `ADMIN_MANUAL` | Gateway webhook or mark-paid-manual |
| **User-plan gateway** | Learner self-enrolls via payment option | `USER_PLAN` | Gateway webhook only |

All three paths write to `user_account_ledger` so the Account Summary card shows a unified balance/overdue view regardless of which path was used.

All backend logic lives in **`admin_core_service`**. There is no invoice or payment logic in `notification_service` or `common_service`.

---

## Data Model

### `invoice` table

```
id              UUID PK
invoice_number  VARCHAR(100) UNIQUE NOT NULL   e.g. INV-20250715-0042
user_id         VARCHAR NOT NULL               billed user
institute_id    VARCHAR NOT NULL
invoice_date    TIMESTAMP NOT NULL
due_date        TIMESTAMP NOT NULL
subtotal        DECIMAL(10,2)
discount_amount DECIMAL(10,2)
tax_amount      DECIMAL(10,2)
total_amount    DECIMAL(10,2) NOT NULL
currency        VARCHAR(10) NOT NULL           ISO 4217, e.g. INR
status          VARCHAR(50) NOT NULL           see status state machine below
pdf_file_id     VARCHAR(255)                  media-service file reference
invoice_data_json TEXT                         snapshot of InvoiceData at creation time
                                               + audit fields (rejectedBy, rejectedAt, etc.)
tax_included    BOOLEAN
source          VARCHAR(50)                   USER_PLAN | STUDENT_FEE_PAYMENT | ADMIN_MANUAL
source_id       VARCHAR(255)                  PK of the originating entity
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

**Relations:**
- `invoice` → `invoice_line_item` (one-to-many): each line carries `item_type`, `description`, `quantity`, `unit_price`, `amount`
- `invoice` → `invoice_payment_log_mapping` (one-to-many): links to one or more `payment_log` rows (multi-package orders can share a single invoice across packages)

**`item_type` values:** `PLAN`, `FEE_INSTALLMENT`, `DISCOUNT`, `COUPON_DISCOUNT`, `REFERRAL_DISCOUNT`, `TAX`, `SERVICE`

### `student_fee_payment` table (CPO installments)

Separate from invoices. One row per CPO installment per user. When an installment is unpaid, `InvoiceService.getInvoicesByUserId` synthesises a virtual invoice row so the admin side-view shows a unified list without requiring a real `invoice` row per installment.

### `payment_log` table

Tracks every gateway and manual transaction. Key fields: `vendor` (RAZORPAY / CASHFREE / PHONEPE / STRIPE / EWAY / MANUAL), `status` (PENDING → PAID / FAILED), `payment_amount`, `currency`, `user_plan_id`, `order_id`, `gateway_order_id`.

---

## Invoice Sources and Lifecycle

### Status state machine

```
GENERATED ─┐
SENT       ├─→ PENDING_PAYMENT ─→ PAID      (terminal — money received)
VIEWED     ┘                   ↘ REJECTED   (terminal — voided before payment)
```

- `GENERATED` / `SENT` / `VIEWED` are informational pre-payment states used by the email reminder and read-receipt flows.
- Only `PENDING_PAYMENT` invoices can be rejected. An already-`PAID` invoice must be refunded through a separate credit flow; `rejectInvoice` guards this.
- `REJECTED` invoices are kept for audit. The admin can "Duplicate" to issue a corrected invoice.

### Source types

| `source` | Created by | Has gateway payment link | Can be mark-paid-manual |
|---|---|---|---|
| `USER_PLAN` | Gateway webhook after successful enrollment payment | No — payment already happened | No |
| `STUDENT_FEE_PAYMENT` | `StudentFeePaymentGenerationService` at enrollment | Via CPO payment option | Yes (via CpoSideViewService) |
| `ADMIN_MANUAL` | Admin via Create Invoice UI | Yes — learner-facing pay link | Yes — "Mark Paid" button |

---

## User Account Ledger

### `user_account_ledger` table

Every money event writes one ledger row. The summary API (`/v1/user-account/{userId}/summary`) reads from this table.

```
id            UUID PK
user_id       VARCHAR NOT NULL
institute_id  VARCHAR NOT NULL
event_type    VARCHAR(50) NOT NULL
amount        DECIMAL(15,2) NOT NULL
currency      VARCHAR(10) NOT NULL
due_date      DATE              populated on DEBIT rows only
source_type   VARCHAR(50)       USER_PLAN | STUDENT_FEE_PAYMENT | ADMIN_INVOICE
source_id     VARCHAR           PK of the originating entity
invoice_id    VARCHAR           optional link to invoice row
reference_id  VARCHAR           payment_log.id or adjustment_history.id on CREDIT rows
remarks       TEXT
created_at    TIMESTAMP
```

### Event types

| `event_type` | When posted | Who posts it |
|---|---|---|
| `DEBIT_ACCRUAL` | When a payment obligation is created | `InvoiceService.createAdminInvoices`, `UserPlanService` (enrollment), `StudentFeePaymentGenerationService` |
| `CREDIT_PAYMENT` | When payment is confirmed (gateway or manual) | `InvoiceService.markInvoicePaidManually`, gateway webhook handlers, `CpoSideViewService.recordOfflinePayment` |
| `CREDIT_ADJUSTMENT` | When an invoice is rejected/voided | `InvoiceService.rejectInvoice` |
| `CREDIT_WAIVER` | When a full fee waiver is granted | Manual/admin adjustment flows |
| `DEBIT_PENALTY` | When a late fee is added | Future penalty flow |

### Balance formula

```
total_accrued = SUM(DEBIT_ACCRUAL + DEBIT_PENALTY)
total_paid    = SUM(CREDIT_PAYMENT + CREDIT_WAIVER + CREDIT_ADJUSTMENT)
balance       = MAX(0, total_accrued - total_paid)
overdue       = SUM(DEBIT rows where due_date < today AND no credit row for same sourceType+sourceId)
```

**Important:** `getSummary` also supplements the ledger totals with admin invoices that pre-date the ledger integration (admin invoices that have no `DEBIT_ACCRUAL` entry). This is done via two supplemental `NOT EXISTS` queries on the `invoice` table (`InvoiceRepository.sumUnledgeredAdminInvoiceAccruals` / `sumUnledgeredAdminInvoicePayments`). New invoices raised after the ledger integration already have `DEBIT_ACCRUAL` entries and are NOT double-counted.

---

## CPO / Fee Installment Flow

CPO = Complex Payment Option. Used when a course has a structured installment fee plan.

### Enrollment → installment generation

```
Learner enrolls → UserPlanService.saveUserPlan()
                → StudentFeePaymentGenerationService.generateFeeBills()
                   For each AftInstallment in the CPO template:
                     INSERT student_fee_payment (one row per installment)
                     UserAccountLedgerService.recordDebitAccrual(
                       source_type='STUDENT_FEE_PAYMENT', source_id=sfp.id,
                       due_date=installment.dueDate)
```

### Offline payment recording

```
Admin clicks "Record Offline Payment" →
  POST /v1/fee-management/user-plan/{userPlanId}/record-offline-payment
  → CpoSideViewService.recordOfflinePayment():
      1. Create PaymentLog (vendor=MANUAL, status=PAID)
      2. UserAccountLedgerService.recordCreditPayment(source_type='USER_PLAN')
      3. FeeLedgerAllocationService.allocatePaymentForNewLog()
           → fills installments oldest-first (FIFO bucket fill)
           → marks each fully-covered installment as PAID
      4. Activate UserPlan if it was PENDING_FOR_PAYMENT
      5. Auto-settle pending ADMIN_MANUAL invoices for same user+institute
           → InvoiceRepository.findPendingAdminManualInvoices()
           → InvoiceService.markInvoicePaidManually() for each, oldest-first
      6. If req.generateInvoice=true → InvoiceService.generateInvoice()
```

### Installment editing

Admins can modify individual installments:
- `PUT /v1/fee-management/installments/{sfpId}` — change due date, amount, per-installment discount
- `PUT /v1/fee-management/user-plan/{userPlanId}/cpo-discount` — set or remove CPO-level discount

Sub-org admins **cannot** record offline payments or edit installments (financial authority belongs to the parent institute only).

---

## Admin Manual Invoice Flow

### Creation

```
Admin fills Create Invoice form → POST /admin-core-service/v1/invoices/admin/create
  Body: { user_ids, institute_id, line_items, currency, due_date, overrides?, tax_enabled? }

InvoiceService.createAdminInvoices():
  For each userId:
    1. Resolve template → substitute placeholders → render HTML
    2. Generate PDF via openhtmltopdf → upload to S3
    3. INSERT invoice (status=PENDING_PAYMENT, source=ADMIN_MANUAL)
    4. INSERT invoice_line_item rows
    5. UserAccountLedgerService.recordDebitAccrual(source_type='ADMIN_INVOICE')
    6. Build payment link: {learnerPortalUrl}/pay/invoice/{invoiceId}
    7. Return AdminInvoicePaymentLinkResponseDTO (link + pdf_url)
```

### Preview (non-persisting)

Before creating, the admin can preview:
```
POST /admin-core-service/v1/invoices/admin/preview
  → Returns: { html, resolved_values[] }
  resolved_values = ordered list of { key, label, group, value, editable, input_type }
  Used to show a live preview and an editable override panel side-by-side.
```

### Payment by learner (gateway)

```
Learner opens /pay/invoice/{invoiceId} (no auth required)
  → GET /admin-core-service/open/v1/invoices/{invoiceId}  (public endpoint)
  → Renders invoice card with line items, totals, due date

Click "Pay Now"
  → POST /admin-core-service/open/v1/invoices/{invoiceId}/initiate-payment?instituteId=
  → InvoiceService.initiatePaymentForAdminInvoice()
       → PaymentService.initiatePayment() with ADMIN_INVOICE order details
       → Returns { razorpayKeyId, razorpayOrderId } or { payment_link } depending on gateway

If Razorpay:
  → Open RazorpayCheckoutForm (embedded JS SDK)
  → On handler callback → navigate to /payment-result?orderId=...&source=invoice&instituteId=...

If Cashfree / PhonePe:
  → window.location.href = payment_link (hosted page redirect)
  → Learner returns to /payment-result after gateway redirect
```

### Mark paid manually

```
Admin clicks "Mark Paid" on an ADMIN_MANUAL invoice →
  POST /admin-core-service/v1/invoices/{invoiceId}/mark-paid-manual
  Body: { transaction_id?, notes? }

InvoiceService.markInvoicePaidManually():
  1. Create PaymentLog (vendor=MANUAL)
  2. INSERT invoice_payment_log_mapping
  3. invoice.status = PAID
  4. UserAccountLedgerService.recordCreditPayment(source_type='ADMIN_INVOICE')
  5. Send confirmation email (best-effort)
```

---

## Gateway Payment Flow

### Supported gateways

| Gateway | Order initiation | Webhook path | Active config |
|---|---|---|---|
| Razorpay | SDK embedded on page | `/payments/webhook/callback/razorpay` | `X-Razorpay-Signature` header |
| Cashfree | Hosted page redirect | `/payments/webhook/callback/cashfree` | `x-webhook-signature` header + `instituteId` param |
| PhonePe | Hosted page redirect | `/payments/webhook/callback/phonepe` | `Authorization` header + `instituteId` param |
| Stripe | SDK / hosted | `/payments/webhook/callback/stripe` | `Stripe-Signature` header |
| eWay | SDK | separate controller | Vet Education Australia |

### Webhook → invoice generation

```
Gateway fires webhook →
  WebHookController.handleRazorpayWebhook() (or gateway-specific handler)
  → Verify signature
  → Update PaymentLog.status = PAID
  → InvoiceService.generateInvoice(userPlan, paymentLog, instituteId)
       → If invoice already exists for this paymentLog → skip (idempotent, returns null bytes)
       → Build InvoiceData from UserPlan + PaymentPlan + PaymentLog
       → Render HTML template → generate PDF → upload S3
       → INSERT invoice (source=USER_PLAN, status=PAID)
       → INSERT invoice_line_item rows
       → INSERT invoice_payment_log_mapping
       → UserAccountLedgerService.recordCreditPayment(source_type='USER_PLAN')
       → Email PDF to learner
```

**Note on multi-package orders:** When a learner buys multiple courses in one checkout, they share a single order ID with an `MP-` prefix. `generateInvoice` detects this, groups all paid `PaymentLog` rows for that order, and generates a single consolidated invoice with one line item per package. Each gateway webhook may fire independently for each package — the `NOT EXISTS` guard prevents duplicate invoices.

### `payment-result` page (learner dashboard)

After any gateway payment, the learner lands on `/payment-result?orderId=...&source=...&vendor=...`:
- Polls `GET_CASHFREE_PAYMENT_STATUS` or `GET_PHONEPE_PAYMENT_STATUS` until status = PAID/FAILED
- `source=invoice` skips polling and shows the success screen immediately (invoice payments confirm via webhook asynchronously)
- On PAID: calls `loginEnrolledUser` + `performFullAuthCycle` to refresh the learner session, then redirects to `/study-library/courses`
- `source=invoice` also skips the redirect — shows "Your invoice has been paid. A confirmation email will be sent to you shortly."

---

## Offline / Manual Payment Recording

Two distinct paths depending on what is being paid:

### CPO installments (structured fee plan)
```
POST /v1/fee-management/user-plan/{userPlanId}/record-offline-payment
Body: { amount, payment_date, reference?, generate_invoice? }
→ CpoSideViewService.recordOfflinePayment()  (FIFO allocation, auto-settles admin invoices)
```

### Individual admin invoice
```
POST /admin-core-service/v1/invoices/{invoiceId}/mark-paid-manual
Body: { transaction_id?, notes? }
→ InvoiceService.markInvoicePaidManually()  (marks that specific invoice paid)
```

The global "Record Offline Payment" button in the admin UI always uses the **CPO path**. It is a flexible-amount input that bucket-fills installments oldest-first. After filling installments, it auto-settles any pending `ADMIN_MANUAL` invoices for the same user (also oldest-first). This means one offline payment can close out both pending installments AND pending admin invoices in a single operation.

The per-row "Mark Paid" button in the invoices list uses the **admin invoice path** and marks only that one invoice.

---

## Sub-Org Payment Flow

Sub-orgs are organisations (schools, clinics, etc.) that subscribe to the parent Vacademy institute. Their payment to the parent institute is tracked separately from their learners' payments.

### Data fetch
```
GET /admin-core-service/institute/v1/sub-org/finance-detail?subOrgId=...
  → SubOrgFinanceDetail:
      admin_payment: { user_id, type(CPO|FLAT), user_plan_id, installments[] }
      learners: []
      totals: {}
```

### Payment recording for sub-org admin
Same as CPO offline payment — the sub-org admin's payment is modelled as a `UserPlan` with installments. The parent institute admin uses the "Record Offline Payment" dialog which calls:
```
POST /v1/fee-management/user-plan/{userPlanId}/record-offline-payment
```

Sub-org admins **cannot** use this endpoint — it checks the caller's role and blocks non-parent-admin callers.

### Sub-org admin invoices
The parent institute can raise `ADMIN_MANUAL` invoices against the sub-org's admin user (e.g. for annual subscription, setup fees). These appear in the **Invoices tab** of the sub-org analytics panel and are billed to `adminUserId` (the sub-org admin's user ID in the parent institute).

### Account Summary in sub-org panel
The Account Summary card in the sub-org analytics panel (`sub-org-analytics-panel.tsx`) shows the same 4-tile ledger view as the student side-view. Data source preference:
1. **Backend ledger** (`/v1/user-account/{userId}/summary`) — used when `total_accrued > 0 || total_paid > 0`
2. **Client-side fallback** — if the ledger has no data (pre-integration invoices), derives totals from the fetched invoice list, excluding `REJECTED` invoices from the accrual sum

---

## Invoice Rejection and Voiding

```
POST /admin-core-service/v1/invoices/{invoiceId}/reject?instituteId=
Body: { reason? }

InvoiceService.rejectInvoice():
  Guard: must be PENDING_PAYMENT (cannot reject a paid invoice — that's a refund)
  1. invoice.status = REJECTED
  2. Merge { rejectedBy, rejectedAt, rejectReason? } into invoice_data_json
  3. invoice = save
  4. UserAccountLedgerService.recordCreditAdjustment(
       source_type='ADMIN_INVOICE', source_id=invoiceId,
       amount=invoice.totalAmount,
       remarks='Invoice rejected: {reason}')
     ← This reverses the DEBIT_ACCRUAL that was posted at invoice creation
```

After rejection:
- The payment link (`/pay/invoice/{invoiceId}`) returns a "Invoice Not Found / Already settled" error
- The invoice row is kept with `status=REJECTED` for audit
- The ledger shows a matching `CREDIT_ADJUSTMENT` so the balance returns to pre-invoice state
- Admin can "Duplicate" from the invoice row to open the Create Invoice dialog pre-filled with the rejected invoice's line items and notes

---

## Account Summary Calculation

`GET /admin-core-service/v1/user-account/{userId}/summary?instituteId=`

```java
UserAccountLedgerService.getSummary(userId, instituteId):
  totalAccrued = ledger.sumDebits(userId, instituteId)       // DEBIT_ACCRUAL + DEBIT_PENALTY
  totalPaid    = ledger.sumCredits(userId, instituteId)      // CREDIT_PAYMENT + CREDIT_WAIVER + CREDIT_ADJUSTMENT
  overdue      = ledger.sumOverdue(userId, instituteId)      // past-due DEBIT rows with no credit for same source

  // Supplement: admin invoices with no ledger entry (pre-date integration)
  totalAccrued += invoiceRepo.sumUnledgeredAdminInvoiceAccruals(userId, instituteId)
  totalPaid    += invoiceRepo.sumUnledgeredAdminInvoicePayments(userId, instituteId)

  balance = MAX(0, totalAccrued - totalPaid)
```

The two supplemental queries use `NOT EXISTS (SELECT 1 FROM user_account_ledger WHERE source_type='ADMIN_INVOICE' AND source_id=invoice.id AND event_type='DEBIT_ACCRUAL')` to avoid double-counting invoices that are already tracked.

---

## Email and Notifications

Email sending is handled by `admin_core_service` via HTTP calls to `notification_service`. Invoices trigger email in these cases:

| Trigger | Template | Recipients |
|---|---|---|
| Admin invoice created | `ADMIN_INVOICE_CREATED` | Learner (billed user) |
| Gateway payment confirmed | `INVOICE_PDF` or `PAYMENT_CONFIRMATION` | Learner — controlled by `INVOICE_SETTING.invoicePdfPlacement` |
| Manual offline payment recorded | `PAYMENT_CONFIRMATION` | Learner |
| Invoice reminder sent | `PAYMENT_REMINDER` | Learner |
| CPO installment reminder | `INSTALLMENT_DUE_REMINDER` workflow event | Learner |

**`invoicePdfPlacement` setting** (`INVOICE_SETTING` in institute settings):
- `INVOICE_EMAIL` (default): PDF is attached to the invoice-creation email
- `PAYMENT_CONFIRMATION_EMAIL`: PDF is attached to the payment-confirmation email instead (collapses the two emails into one)

---

## API Reference

### Authenticated admin endpoints

```
Base: /admin-core-service/v1/invoices

GET    /{invoiceId}                              Fetch invoice by ID
GET    /user/{userId}?instituteId=               All invoices for a user (+ synthetic SFP rows)
GET    /institute/{instituteId}?page&size&...    Paginated institute invoice list
GET    /{invoiceId}/download                     Pre-signed PDF URL (302 redirect)
POST   /admin/create                             Create invoice(s) for one or multiple users
POST   /admin/preview                            Non-persisting render preview + placeholders
POST   /{invoiceId}/initiate-payment             Start gateway payment for admin invoice
POST   /{invoiceId}/reject                       Void a PENDING_PAYMENT invoice
POST   /{invoiceId}/mark-paid-manual             Record offline/manual payment
POST   /{invoiceId}/send-reminder                Re-send payment-due reminder email
```

```
Base: /admin-core-service/v1/user-account

GET    /{userId}/summary?instituteId=            Balance, overdue, accrued, paid totals
GET    /{userId}/ledger?instituteId=&page=&size= Paginated ledger entries (newest first)
```

```
Base: /admin-core-service/v1/fee-management (approx. — check actual controller mappings)

GET    /user/{userId}/cpo-user-plans             All CPO UserPlans for a user
GET    /user-plan/{userPlanId}/installments      Installment list for one CPO plan
PUT    /installments/{sfpId}                     Modify one installment (date/amount/discount)
PUT    /user-plan/{userPlanId}/cpo-discount      Set/remove CPO-level discount
POST   /user-plan/{userPlanId}/record-offline-payment   FIFO bucket-fill offline payment
```

### Unauthenticated public endpoints

```
Base: /admin-core-service/open/v1/invoices

GET    /{invoiceId}                              Fetch invoice for learner payment page (no auth)
POST   /{invoiceId}/initiate-payment             Initiate gateway payment (no auth)
GET    /by-email?email=&instituteId=             List invoices by learner email (WordPress shortcode)
```

### Webhook endpoints

```
POST   /admin-core-service/payments/webhook/callback/razorpay   (X-Razorpay-Signature)
POST   /admin-core-service/payments/webhook/callback/cashfree   (x-webhook-signature + instituteId)
POST   /admin-core-service/payments/webhook/callback/phonepe    (Authorization + instituteId)
POST   /admin-core-service/payments/webhook/callback/stripe     (Stripe-Signature)
POST   /admin-core-service/payments/webhook/reprocess/{id}      Replay a FAILED webhook
```

---

## Frontend Screens

### Admin dashboard

#### Student side-view → Payment History tab

`manage-students/students-list/.../student-payment-history/student-payment-history.tsx`

Sections (top to bottom):

1. **Account Summary** — 4-tile grid: Total Accrued / Total Paid / Due / Past Due
2. **Fee Plan Summary** — one card per CPO UserPlan with progress bar
3. **Installments editor** — per-installment date/amount/discount editing
4. **Invoices list** — all invoices (real + synthetic SFP rows), 10/page
   - Row actions: Download PDF | Copy Payment Link | Mark Paid (ADMIN_MANUAL pending only)
   - Header action: Create Invoice (opens Create Invoice dialog)
5. **Transaction History** — paginated ledger rows from `/v1/user-account/{userId}/ledger`

#### Sub-org analytics panel

`manage-suborg-teams/-components/sub-org-analytics-panel.tsx`

Tabs: Admin | Courses | Learners | **Invoices** | Team

- **Account Summary card** (above tabs): same 4-tile grid
- **Transaction History card**: same ledger view
- **Admin tab**: CPO installment editor + Record Offline Payment button
- **Invoices tab**: full invoice list with per-row actions: Download | Copy Link | Send Reminder | Reject | Duplicate | Mark Paid

`restrictedView` prop: sub-org admins see only the Admin tab (no Invoices, no Learners, no Team).

#### Create Invoice dialog

Wizard: Select learners → Add line items → Review & Preview → Create

- Preview step calls `POST /admin/preview` for a live template render
- The "Review" panel shows editable placeholders (institute name, address, PAN, notes, etc.)
- Per-invoice tax override: toggle tax on/off, set custom rate

### Learner dashboard

#### Invoice payment page

Route: `/pay/invoice/$invoiceId` (no auth required, shareable link)

```
Load → GET /open/v1/invoices/{invoiceId}  (institute branding separately)
     → Render: institute logo + invoice table (line items, totals, due date chip)

Pay Now → POST /open/v1/invoices/{invoiceId}/initiate-payment

Razorpay → embedded Razorpay SDK → on handler:
  window.location.href = /payment-result?orderId=...&source=invoice&instituteId=...

Cashfree / PhonePe → window.location.href = payment_link (hosted redirect)
```

#### Payment result page

Route: `/payment-result`

- `source=invoice`: shows success screen immediately (no status polling — invoice confirmation is async via webhook)
- `source` absent: polls payment status every 12s; on PAID, runs full auth cycle and redirects to `/study-library/courses`
- `vendor=PHONEPE`: recovers `orderId`/`instituteId` from `localStorage.phonepe_pending_order` (PhonePe can drop query params on return redirect)

---

## Extending the System

### Adding a new invoice source type

1. Add the new `source` value to the `Invoice` entity and any switch/if blocks in `InvoiceService`
2. Call `UserAccountLedgerService.recordDebitAccrual(...)` when the obligation is created, with `source_type` matching a string you'll use consistently
3. Call `recordCreditPayment(...)` when payment is confirmed
4. If the source can be rejected/voided, call `recordCreditAdjustment(...)` in the void handler
5. Add a badge colour for the new source in the frontend `InvoicesList` component

### Adding a new payment gateway

1. Implement `PaymentServiceStrategy` interface in `features/payments/manager/`
2. Register in `PaymentServiceFactory`
3. Add a webhook endpoint in `WebHookController`
4. On confirmed payment: update `PaymentLog.status = PAID`, then call `InvoiceService.generateInvoice`
5. See [`docs/payment-system.md`](./payment-system.md) for the full adapter contract

### Adding a new line item type

Add the value to the `item_type` enum/constants. The invoice template renders all line items generically — no template change needed unless you want custom formatting for the new type.

### Fixing a wrong total in the Account Summary

The summary is computed in `UserAccountLedgerService.getSummary`. The ledger is append-only — to correct a wrong amount, post a compensating `CREDIT_ADJUSTMENT` (to reduce accrued) or `DEBIT_ACCRUAL` (to increase accrued). Never delete ledger rows.

### Diagnosing a 403 on `/v1/user-account/**`

The `UserAccountController` mapping must include the `/admin-core-service` prefix (nginx passes the full path — no rewrite). If you see 403 on these endpoints, check `@RequestMapping` on `UserAccountController` — it should be `/admin-core-service/v1/user-account`, not `/v1/user-account`.

### Invoice PDF not regenerating

`resolveOrRegeneratePdfUrl(invoiceId)` is the canonical path. It checks `pdf_file_id` first. If the PDF is missing (file deleted from S3, or generation failed at creation time), call `POST /admin-core-service/v1/invoices/{id}/download` — the controller calls `resolveOrRegeneratePdfUrl` and 302-redirects to the new URL after regeneration.

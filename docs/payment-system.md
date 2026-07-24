# Payment System Documentation

This document covers every payment-related entity in `admin_core_service`, how they are created, how they get assigned to users, and how discounts/concessions work.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Part A -- Subscription / Plan Entities](#part-a----subscription--plan-entities)
   - [PaymentOption](#1-paymentoption)
   - [PaymentPlan](#2-paymentplan)
   - [UserPlan](#3-userplan)
   - [PaymentLog](#4-paymentlog)
   - [PaymentLogLineItem](#5-paymentloglineitem)
3. [Part B -- Fee Management Entities (New)](#part-b----fee-management-entities-new)
   - [ComplexPaymentOption (CPO)](#6-complexpaymentoption-cpo)
   - [FeeType](#7-feetype)
   - [AssignedFeeValue](#8-assignedfeevalue)
   - [AftInstallment](#9-aftinstallment)
   - [StudentFeePayment](#10-studentfeepayment)
   - [StudentFeeAllocationLedger](#11-studentfeeallocationledger)
   - [StudentFeeAdjustmentHistory](#12-studentfeeadjustmenthistory)
   - [InstituteFeeTypePriority](#13-institutefeetypepriority)
4. [Part C -- Discount & Coupon Entities](#part-c----discount--coupon-entities)
   - [CouponCode](#14-couponcode)
   - [AppliedCouponDiscount](#15-appliedcoupondiscount)
   - [ReferralOption](#16-referraloption)
   - [ReferralMapping](#17-referralmapping)
   - [ReferralBenefitLogs](#18-referralbenefitlogs)
5. [Part D -- Invoice Entities](#part-d----invoice-entities)
   - [Invoice](#19-invoice)
   - [InvoiceLineItem](#20-invoicelineitem)
   - [InvoicePaymentLogMapping](#21-invoicepaymentlogmapping)
6. [Entity Relationship Diagram](#entity-relationship-diagram)
7. [Flows](#flows)
   - [How a PaymentOption + Plans Get Created](#flow-1-how-a-paymentoption--plans-get-created)
   - [How a User Gets Assigned a Plan (UserPlan creation)](#flow-2-how-a-user-gets-assigned-a-plan-userplan-creation)
   - [How a CPO Gets Created](#flow-3-how-a-cpo-gets-created)
   - [How Fee Bills Get Generated for a Student](#flow-4-how-fee-bills-get-generated-for-a-student)
   - [How Payments Get Allocated to Fee Bills](#flow-5-how-payments-get-allocated-to-fee-bills)
   - [How to Apply a Special Discount to a User](#flow-6-how-to-apply-a-special-discount-to-a-user)
8. [API Reference](#api-reference)
9. [Statuses & Enums](#statuses--enums)

---

## System Overview

The payment system has two parallel tracks:

| Track | Purpose | Key Entities |
|-------|---------|--------------|
| **Subscription / Plan** | Online course purchases, one-time payments, donations, free access | PaymentOption -> PaymentPlan -> UserPlan -> PaymentLog |
| **Fee Management** | School/institute fee structures with installments, concessions, penalties | CPO -> FeeType -> AssignedFeeValue -> AftInstallment -> StudentFeePayment |
| **Live Session Fees** | Paid live classes (public guests + private learners) | PaymentOption(LIVE_SESSION) -> SessionGuestRegistration -> Invoice(LIVE_SESSION) -> PaymentLog |

Both tracks converge at `PaymentLog` (the actual money transaction) and `Invoice` (the generated receipt).

```
                    SUBSCRIPTION TRACK                          FEE MANAGEMENT TRACK
                    ==================                          ====================
                    PaymentOption                               ComplexPaymentOption (CPO)
                        |                                           |
                    PaymentPlan                                 FeeType
                        |                                           |
                    UserPlan  <-------- enrollment -------->    AssignedFeeValue
                        |                                           |
                    PaymentLog  <------- money flows ------->   AftInstallment
                        |                                           |
                    Invoice                                     StudentFeePayment
                                                                    |
                                                                StudentFeeAllocationLedger
```

---

## Part A -- Subscription / Plan Entities

### 1. PaymentOption

**Table:** `payment_option`  
**File:** `features/user_subscription/entity/PaymentOption.java`

A **PaymentOption** represents a purchasable offering (e.g. "Annual Subscription", "One-Time Course Access"). It is the top-level container that holds one or more pricing tiers (PaymentPlans).

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | String | Display name (e.g. "Gold Plan") |
| `status` | String | ACTIVE, DELETED |
| `source` | String | Where this option lives: `INSTITUTE`, `PACKAGE_SESSION`, or `LIVE_SESSION` (paid live class fee, source_id = live_session.id) |
| `source_id` | String | ID of the source entity |
| `tag` | String | DEFAULT, etc. |
| `type` | String | SUBSCRIPTION, ONE_TIME, FREE, DONATION |
| `require_approval` | boolean | Whether enrollment needs admin approval (default: true) |
| `unit` | String | Subscription unit -- day, month, year |
| `payment_option_metadata_json` | TEXT | Flexible JSON for extra config |

**Relationships:**
- One-to-Many with `PaymentPlan` (only ACTIVE plans are loaded via `@Where`)

---

### 2. PaymentPlan

**Table:** `payment_plan`  
**File:** `features/user_subscription/entity/PaymentPlan.java`

A **PaymentPlan** is a specific pricing tier within a PaymentOption. For example, a "Gold Plan" PaymentOption might have a "Monthly" plan at $9.99 and a "Yearly" plan at $99.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | String | Plan name (e.g. "Monthly", "Yearly") |
| `status` | String | ACTIVE, DELETED |
| `validity_in_days` | Integer | How many days the plan lasts |
| `actual_price` | double | The real price the user pays |
| `elevated_price` | double | Strike-through / original price (for showing discount) |
| `currency` | String | INR, USD, etc. |
| `description` | TEXT | Rich text description |
| `tag` | String | Grouping tag |
| `feature_json` | TEXT | JSON listing features included |
| `member_count` | Integer | For group plans -- how many seats |
| `payment_option_id` | FK | Parent PaymentOption |

**Relationships:**
- Many-to-One with `PaymentOption`

---

### 3. UserPlan

**Table:** `user_plan`  
**File:** `features/user_subscription/entity/UserPlan.java`

A **UserPlan** represents a student/user's enrollment in a specific payment plan. This is the central entity that ties a user to what they purchased.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | String | **Always required** -- the individual user (never null, even for SUB_ORG) |
| `plan_id` | FK | Reference to PaymentPlan |
| `plan_json` | TEXT | Snapshot of the plan at enrollment time |
| `payment_option_id` | FK | Reference to PaymentOption |
| `payment_option_json` | TEXT | Snapshot of the option at enrollment time |
| `applied_coupon_discount_id` | FK | Discount applied at enrollment |
| `applied_coupon_discount_json` | TEXT | Snapshot of discount |
| `enroll_invite_id` | FK | The enrollment invite used |
| `status` | String | ACTIVE, PENDING, PENDING_FOR_PAYMENT, PAYMENT_FAILED, CANCELED, EXPIRED, TERMINATED |
| `source` | String | `USER` (direct purchase) or `SUB_ORG` (organization enrollment) |
| `sub_org_id` | String | Sub-organization ID (only when source=SUB_ORG) |
| `json_payment_details` | TEXT | Flexible JSON for payment metadata |
| `start_date` | Date | Plan start |
| `end_date` | Date | Plan expiry |

**Relationships:**
- Many-to-One with `PaymentPlan`, `PaymentOption`, `AppliedCouponDiscount`, `EnrollInvite`
- One-to-Many with `PaymentLog`

---

### 4. PaymentLog

**Table:** `payment_log`  
**File:** `features/user_subscription/entity/PaymentLog.java`

A **PaymentLog** records an actual payment transaction. One UserPlan can have multiple PaymentLogs (e.g. failed attempt then success, or recurring payments).

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | String | Who paid |
| `status` | String | INITIATED, ACTIVE, SUCCESS, FAILED |
| `payment_status` | String | Vendor-specific payment status |
| `vendor` | String | razorpay, stripe, cashfree, phonepe, eway, paypal |
| `vendor_id` | String | Transaction ID from the payment gateway |
| `date` | Date | When payment happened |
| `currency` | String | INR, USD, etc. |
| `payment_amount` | Double | Amount paid |
| `unallocated_amount` | Double | Overpayment not yet allocated to fee bills |
| `payment_specific_data` | TEXT | Full JSON response from the gateway |
| `tracking_id` | String | External tracking reference |
| `tracking_source` | String | Source of tracking ID |
| `order_status` | String | Order-level status |
| `user_plan_id` | FK | Parent UserPlan |

**Relationships:**
- Many-to-One with `UserPlan`

---

### 5. PaymentLogLineItem

**Table:** `payment_log_line_item`  
**File:** `features/user_subscription/entity/PaymentLogLineItem.java`

Breaks down a payment into line items (e.g. the base amount, discount amount, tax).

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `type` | String | e.g. DISCOUNT |
| `amount` | Double | Line item amount |
| `source` | String | coupon, referral, etc. |
| `source_id` | String | ID of the source entity |
| `payment_log_id` | FK | Parent PaymentLog |

---

## Part B -- Fee Management Entities (New)

These entities support complex school/institute fee structures with multiple fee types, installment schedules, and payment allocation.

### 6. ComplexPaymentOption (CPO)

**Table:** `complex_payment_option`  
**File:** `features/fee_management/entity/ComplexPaymentOption.java`

A **CPO** is a fee template/structure for an institute. It groups multiple fee types (tuition, lab, transport, etc.) into a single billable package. Think of it as a "fee plan" that gets assigned to a class/batch.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | String | e.g. "Class 10 - 2025-26 Fee Structure" |
| `institute_id` | String | Which institute owns this CPO |
| `default_payment_option_id` | String | Default PaymentOption for gateway payments |
| `status` | String | ACTIVE, PENDING_APPROVAL, DELETED |
| `created_by` | String | User who created it |
| `approved_by` | String | User who approved it (if approval was needed) |
| `metadata_json` | TEXT | Flexible JSON |

**Approval flow:** ADMINs create CPOs in ACTIVE status directly. Non-admins create CPOs in PENDING_APPROVAL -- an admin must call the approve endpoint to activate.

---

### 7. FeeType

**Table:** `fee_type`  
**File:** `features/fee_management/entity/FeeType.java`

A **FeeType** represents a category of fee within a CPO (e.g. Tuition Fee, Lab Fee, Transport Fee).

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | String | e.g. "Tuition Fee" |
| `code` | String | Short code, e.g. "TUITION" |
| `description` | TEXT | Detailed description |
| `cpo_id` | String | Parent CPO |
| `status` | String | ACTIVE, DELETED |
| `is_skippable` | Boolean | Can a student opt out of this fee? (default: false) |

---

### 8. AssignedFeeValue

**Table:** `assigned_fee_value`  
**File:** `features/fee_management/entity/AssignedFeeValue.java`

**AssignedFeeValue** defines the monetary amount and payment terms for a FeeType. Each FeeType has one AssignedFeeValue.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `fee_type_id` | String | Parent FeeType |
| `amount` | BigDecimal | The final fee amount (after any template-level discount) |
| `original_amount` | BigDecimal | Original amount before discount |
| `discount_type` | String | PERCENTAGE, FLAT, or null |
| `discount_value` | BigDecimal | Discount amount or percentage |
| `no_of_installments` | Integer | Number of installments |
| `has_installment` | Boolean | Whether installment payment is enabled |
| `is_refundable` | Boolean | Whether this fee is refundable |
| `has_penalty` | Boolean | Whether late payment incurs penalty |
| `penalty_percentage` | BigDecimal | Penalty % for late payment |
| `status` | String | ACTIVE, DELETED |

---

### 9. AftInstallment

**Table:** `aft_installments`  
**File:** `features/fee_management/entity/AftInstallment.java`

**AftInstallment** defines individual installment due dates and amounts within an AssignedFeeValue.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `assigned_fee_value_id` | String | Parent AssignedFeeValue |
| `installment_number` | Integer | Sequence number (1, 2, 3...) |
| `amount` | BigDecimal | Amount due for this installment |
| `due_date` | LocalDate | When this installment is due |
| `start_date` | LocalDate | Period start |
| `end_date` | LocalDate | Period end |
| `status` | String | PENDING, DELETED |

---

### 10. StudentFeePayment

**Table:** `student_fee_payment`  
**File:** `features/fee_management/entity/StudentFeePayment.java`

A **StudentFeePayment** is the actual fee bill for a student. One row is created per installment per fee type. This is the row that tracks how much a student owes and has paid.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | String | The student |
| `user_plan_id` | String | The student's UserPlan |
| `cpo_id` | String | The CPO this bill was generated from |
| `asv_id` | String | AssignedFeeValue reference |
| `i_id` | String | AftInstallment reference |
| `fee_type_id` | String | FeeType reference |
| `amount_expected` | BigDecimal | Total amount due |
| `amount_paid` | BigDecimal | Amount paid so far (default: 0) |
| `due_date` | Date | When payment is due |
| `status` | String | PENDING, PARTIAL_PAID, PAID, WAIVED, OVERDUE |
| `is_skippable` | Boolean | Inherited from FeeType |
| `institute_id` | String | For workflow triggers (fee reminders) |
| `current_adjustment_history_id` | String | Latest adjustment event |
| `package_session_ids` | String | Comma-separated package session IDs |

**Relationships:**
- Many-to-One with `ComplexPaymentOption`

---

### 11. StudentFeeAllocationLedger

**Table:** `student_fee_allocation_ledger`  
**File:** `features/fee_management/entity/StudentFeeAllocationLedger.java`

The **ledger** tracks how payment money gets allocated to specific fee bills. When a student pays, the system distributes the payment across their pending bills and records each allocation here.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | String | The student |
| `payment_log_id` | String | Which PaymentLog the money came from |
| `student_fee_payment_id` | String | Which fee bill it was applied to |
| `amount_allocated` | BigDecimal | How much was allocated |
| `transaction_type` | String | PAYMENT, OVERPAYMENT, REFUND, ROLLOVER |
| `remarks` | String | e.g. "Auto-allocated [ALL_DUES, priority-based]" |

---

### 12. StudentFeeAdjustmentHistory

**Table:** `student_fee_adjustment_history`  
**File:** `features/fee_management/entity/StudentFeeAdjustmentHistory.java`

Tracks fee adjustments like concessions (fee reduction) and penalties (fee increase). Forms a linked list via `previous_event_id` for full audit trail.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `student_fee_payment_id` | String | Which fee bill was adjusted |
| `institute_id` | String | Institute |
| `event_type` | String | What triggered the adjustment |
| `adjustment_type` | String | CONCESSION or PENALTY |
| `amount` | BigDecimal | Adjustment amount |
| `reason` | String | Free text reason |
| `resulting_status` | String | Bill status after adjustment |
| `actor_user_id` | String | Who made the adjustment |
| `actor_role` | String | Their role |
| `previous_event_id` | String | Previous adjustment in the chain (audit trail) |
| `metadata` | JSONB | Flexible JSON metadata |

---

### 13. InstituteFeeTypePriority

**Table:** `institute_fee_type_priority`  
**File:** `features/fee_management/entity/InstituteFeeTypePriority.java`

Configures which fee types get paid first when allocating a student's payment. Lower `priority_order` = paid first.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `institute_id` | String | Institute |
| `scope` | String | OVERDUE_ONLY, UPCOMING_ONLY, ALL_DUES |
| `fee_type_id` | String | Which fee type |
| `priority_order` | Integer | Lower = higher priority |

**Unique constraint:** (institute_id, scope, fee_type_id)

---

## Part C -- Discount & Coupon Entities

### 14. CouponCode

**Table:** `coupon_code`  
**File:** `features/user_subscription/entity/CouponCode.java`

A **CouponCode** is the actual code string that users enter to get a discount.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `code` | String | Unique coupon string shown to users |
| `status` | String | ACTIVE, EXPIRED, REDEEMED |
| `source_type` | String | ADMIN, SYSTEM |
| `source_id` | String | Who/what created it |
| `is_email_restricted` | boolean | If true, only allowed emails can use it |
| `allowed_email_ids` | String (JSON) | JSON array of allowed email addresses |
| `tag` | String | Grouping tag |
| `generation_date` | Date | When the code was generated |
| `short_url` | String | Shareable short link |
| `redeem_start_date` | Date | Earliest redemption date |
| `redeem_end_date` | Date | Latest redemption date |
| `usage_limit` | Long | Max times this code can be used |
| `can_be_added` | boolean | Whether it can still be applied |

---

### 15. AppliedCouponDiscount

**Table:** `applied_coupon_discount`  
**File:** `features/user_subscription/entity/AppliedCouponDiscount.java`

**AppliedCouponDiscount** defines the discount rules attached to a coupon code. When a user applies a coupon, this entity determines how much they save.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | String | Display name |
| `discount_type` | String | percentage, amount, media |
| `media_ids` | TEXT | JSON of media IDs (for media-type discounts) |
| `status` | String | ACTIVE, EXPIRED |
| `validity_in_days` | Integer | How long the discount is valid |
| `discount_source` | String | referral, coupon_code |
| `currency` | String | Currency for amount-type discounts |
| `max_discount_point` | Double | Maximum discount cap |
| `discount_point` | Double | The discount value (% or amount) |
| `max_applicable_times` | Integer | Max times this discount can be applied |
| `redeem_start_date` | Date | Valid from |
| `redeem_end_date` | Date | Valid until |
| `coupon_code_id` | FK | Parent CouponCode |

---

### 16. ReferralOption

**Table:** `referral_option`  
**File:** `features/user_subscription/entity/ReferralOption.java`

Configures referral programs -- what discount the referrer and referee get.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | String | Program name |
| `source` | String | campaign, user_referral |
| `source_id` | String | Related entity ID |
| `status` | String | ACTIVE, INACTIVE, EXPIRED |
| `referrer_discount_json` | TEXT | JSON discount config for the referrer |
| `referee_discount_json` | TEXT | JSON discount config for the referee |
| `referrer_vesting_days` | Integer | Days before referrer benefit activates |
| `allow_combine_offers` | boolean | Can this be combined with other discounts? |
| `setting_json` | TEXT | Additional settings |

---

### 17. ReferralMapping

Tracks who referred whom and which referral code was used.

### 18. ReferralBenefitLogs

Logs individual referral benefit applications (DISCOUNT, CREDIT) with status (APPLIED, PENDING, EXPIRED).

---

## Part D -- Invoice Entities

### 19. Invoice

**Table:** `invoice`  
**File:** `features/invoice/entity/Invoice.java`

Generated invoice after a successful payment.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `invoice_number` | String | Unique invoice number |
| `user_id` | String | Customer |
| `institute_id` | String | Seller institute |
| `invoice_date` | Date | Invoice date |
| `due_date` | Date | Payment due date |
| `subtotal`, `discount_amount`, `tax_amount`, `total_amount` | BigDecimal | Monetary fields |
| `currency` | String | Currency |
| `status` | String | GENERATED, SENT, VIEWED |
| `pdf_file_id` | String | S3 file reference for the PDF |
| `invoice_data_json` | TEXT | Full invoice data as JSON |
| `tax_included` | Boolean | Whether tax is included in prices |
| `source` | String | What raised it: `USER_PLAN`, `STUDENT_FEE_PAYMENT`, `ADMIN_MANUAL`, `LIVE_SESSION` |
| `source_id` | String | ID of the source entity (for LIVE_SESSION: the session_guest_registrations id) |

### 20. InvoiceLineItem

Individual line items in an invoice (PLAN, DISCOUNT, TAX, COUPON, REFERRAL).

### 21. InvoicePaymentLogMapping

Links invoices to payment logs. Supports multi-package enrollments where one invoice covers multiple payments.

---

## Entity Relationship Diagram

```
SUBSCRIPTION TRACK
==================

PaymentOption (1) ----< PaymentPlan (N)
                              |
                              | (FK: plan_id)
                              v
                         UserPlan (N)
                          |   |   |
          (FK)            |   |   |         (FK)
  AppliedCouponDiscount --+   |   +-- EnrollInvite
          |                   |
          v                   v
     CouponCode          PaymentLog (N)
                              |
                              v
                     PaymentLogLineItem (N)


FEE MANAGEMENT TRACK
=====================

ComplexPaymentOption (CPO)
        |
        | (FK: cpo_id)
        v
    FeeType (N)
        |
        | (FK: fee_type_id)
        v
    AssignedFeeValue (1 per FeeType)
        |
        | (FK: assigned_fee_value_id)
        v
    AftInstallment (N)
        |
        | (generates)
        v
    StudentFeePayment (1 per installment per student)
        |          |
        |          +-----> StudentFeeAdjustmentHistory (audit chain)
        v
    StudentFeeAllocationLedger ----> PaymentLog (money source)


INVOICE
=======

Invoice (1) ----< InvoiceLineItem (N)
    |
    +----------< InvoicePaymentLogMapping (N) -----> PaymentLog
```

---

## Flows

### Flow 1: How a PaymentOption + Plans Get Created

**API:** `POST /admin-core-service/v1/payment-option`  
**Service:** `PaymentOptionService.savePaymentOption()`

1. Admin sends a `PaymentOptionDTO` with nested `PaymentPlanDTO[]`
2. A `PaymentOption` entity is created (name, type, source, etc.)
3. Each `PaymentPlanDTO` is saved as a `PaymentPlan` linked to the option
4. The option can be tagged as DEFAULT for a source via `make-default-payment-option`

```json
{
  "name": "Annual Subscription",
  "type": "SUBSCRIPTION",
  "source": "PACKAGE_SESSION",
  "sourceId": "<package-session-id>",
  "unit": "year",
  "requireApproval": false,
  "paymentPlans": [
    {
      "name": "Monthly",
      "actualPrice": 999,
      "elevatedPrice": 1499,
      "validityInDays": 30,
      "currency": "INR"
    },
    {
      "name": "Yearly",
      "actualPrice": 9999,
      "elevatedPrice": 14999,
      "validityInDays": 365,
      "currency": "INR"
    }
  ]
}
```

---

### Flow 2: How a User Gets Assigned a Plan (UserPlan creation)

**Service:** `UserPlanService.createUserPlan()`

1. User selects a `PaymentPlan` and initiates enrollment
2. A `UserPlan` is created with:
   - `user_id` = the student
   - `plan_id` = selected PaymentPlan
   - `payment_option_id` = parent PaymentOption
   - `status` = PENDING_FOR_PAYMENT (or ACTIVE if free/admin-assigned)
   - Snapshots of plan and option are stored in `plan_json` and `payment_option_json`
3. If a coupon was applied, `applied_coupon_discount_id` is set
4. A `PaymentLog` is created with status=INITIATED
5. User is redirected to payment gateway (Razorpay/Stripe/Cashfree/PhonePe/PayPal/Eway)
6. On successful payment callback:
   - `PaymentLog.status` -> SUCCESS
   - `UserPlan.status` -> ACTIVE
   - Invoice is generated
7. For **SUB_ORG** enrollments: `source` = "SUB_ORG", `sub_org_id` is set, but `user_id` still tracks the individual learner

**For fee-managed enrollments**, after UserPlan creation:
- `StudentFeePaymentGenerationService.generateFeeBills()` is called to create fee bills from the CPO template

---

### Flow 3: How a CPO Gets Created

**API:** `POST /admin-core-service/v1/fee-management/cpo`  
**Service:** `FeeManagementService.createCpo()`

1. Admin sends a `ComplexPaymentOptionDTO` with nested fee types, values, and installments
2. System creates the full hierarchy in one transaction:

```
Step 1: Save ComplexPaymentOption
Step 2: For each FeeType in request:
   -> Save FeeType (linked to CPO)
   -> Save AssignedFeeValue (linked to FeeType) 
   -> For each installment:
      -> Save AftInstallment (linked to AssignedFeeValue)
Step 3: Link CPO to package sessions (via bridge table)
```

3. **Approval:** ADMINs get ACTIVE status immediately. Non-admins get PENDING_APPROVAL and need admin approval via `POST /fee-management/cpo/{cpoId}/approve`

**Example request:**
```json
{
  "name": "Class 10 Fee Structure 2025-26",
  "instituteId": "<institute-id>",
  "feeTypes": [
    {
      "name": "Tuition Fee",
      "code": "TUITION",
      "assignedFeeValue": {
        "amount": 50000,
        "originalAmount": 50000,
        "hasInstallment": true,
        "noOfInstallments": 4,
        "hasPenalty": true,
        "penaltyPercentage": 2.0,
        "installments": [
          { "installmentNumber": 1, "amount": 12500, "dueDate": "2025-07-01" },
          { "installmentNumber": 2, "amount": 12500, "dueDate": "2025-10-01" },
          { "installmentNumber": 3, "amount": 12500, "dueDate": "2026-01-01" },
          { "installmentNumber": 4, "amount": 12500, "dueDate": "2026-04-01" }
        ]
      }
    },
    {
      "name": "Lab Fee",
      "code": "LAB",
      "assignedFeeValue": {
        "amount": 5000,
        "originalAmount": 5000,
        "hasInstallment": false,
        "isRefundable": true
      }
    }
  ],
  "packageSessionLinks": [
    { "packageSessionId": "<class-10-session-id>" }
  ]
}
```

---

### Flow 4: How Fee Bills Get Generated for a Student

**Service:** `StudentFeePaymentGenerationService.generateFeeBills()`

When a student enrolls in a class that has a CPO assigned:

```
Input: userPlanId, cpoId, userId, instituteId

1. Fetch all FeeTypes for the CPO
2. For each FeeType:
   a. Fetch AssignedFeeValues
   b. For each AssignedFeeValue:
      - Fetch AftInstallments (ordered by installment number)
      - If installments exist:
          Create one StudentFeePayment per installment
          (amount = installment amount, dueDate = installment dueDate)
      - If no installments:
          Create one StudentFeePayment for the full amount
          (amount = AssignedFeeValue.amount, no dueDate)
3. All bills start with status=PENDING, amountPaid=0
```

**Example output for the CPO above:**

| StudentFeePayment | FeeType | Amount | Due Date | Status |
|---|---|---|---|---|
| sfp-1 | Tuition | 12,500 | 2025-07-01 | PENDING |
| sfp-2 | Tuition | 12,500 | 2025-10-01 | PENDING |
| sfp-3 | Tuition | 12,500 | 2026-01-01 | PENDING |
| sfp-4 | Tuition | 12,500 | 2026-04-01 | PENDING |
| sfp-5 | Lab | 5,000 | (none) | PENDING |

---

### Flow 5: How Payments Get Allocated to Fee Bills

**Service:** `FeeAllocationEngine.allocate()`

When a student makes a payment:

```
1. PaymentLog is created (amount = what they paid)
2. Fetch all unpaid StudentFeePayments for the student
3. Determine allocation scope: OVERDUE_ONLY, UPCOMING_ONLY, or ALL_DUES
4. Sort bills:
   a. If InstituteFeeTypePriority is configured:
      -> Sort by priority_order ASC, then due_date ASC
   b. Otherwise (FIFO fallback):
      -> Sort by due_date ASC, then higher amount first
   c. Overdue bills always come before upcoming bills
5. For each bill in order:
   a. Compute amount_due = amount_expected + adjustments - amount_paid
   b. Allocate min(remaining_payment, amount_due)
   c. Update StudentFeePayment.amount_paid
   d. Set status to PAID or PARTIAL_PAID
   e. Create a StudentFeeAllocationLedger entry
6. Any leftover goes to PaymentLog.unallocated_amount
```

---

### Flow 6: How to Apply a Special Discount to a User

There are **three ways** to give a user a discount:

#### Method 1: Coupon Code Discount (Subscription Track)

Best for: one-off discounts for specific users at enrollment time.

1. **Create an AppliedCouponDiscount** with the discount rules:
   - `discountType`: "percentage" or "amount"
   - `discountPoint`: the value (e.g. 20 for 20%, or 500 for flat $500)
   - `maxDiscountPoint`: cap for percentage discounts
2. **Create a CouponCode** linked to the discount:
   - Set `isEmailRestricted = true` and `allowedEmailIds` to the user's email for user-specific coupons
   - Set `usageLimit = 1` for one-time use
3. User applies the coupon at checkout -> discount is applied to the PaymentPlan price
4. The `UserPlan` records the `applied_coupon_discount_id`

**API:** Use `CouponCodeController` endpoints.

#### Method 2: Fee Concession (Fee Management Track)

Best for: reducing a specific fee bill for a student (e.g. scholarship, hardship waiver).

1. Create a `StudentFeeAdjustmentHistory` entry:
   - `adjustmentType` = "CONCESSION"
   - `amount` = how much to reduce
   - `reason` = "Scholarship" / "Merit discount" / etc.
   - `actorUserId` = the admin making the adjustment
2. The `AdjustmentResolver` recalculates `amount_due` for the bill:
   - `amount_due = amount_expected - concessions + penalties - amount_paid`
3. If concession covers the full remaining amount, status becomes WAIVED
4. A full audit trail is maintained via `previous_event_id`

**API:** Use `FeeTrackingAdminController` endpoints.

#### Method 3: Referral Discount

Best for: viral growth -- existing users refer new users, both get benefits.

1. Configure a `ReferralOption` with discount rules for referrer and referee
2. Referrer shares their code
3. New user signs up with the referral code
4. `ReferralMapping` links the two users
5. `ReferralBenefitLogs` tracks benefit application
6. Benefits can have vesting periods (`referrerVestingDays`)

---

### Flow 7: How a Paid Live Session Gets Charged (V397)

Live classes reuse the legacy rails end-to-end — **no parallel payment system**. Both
convergence points from the System Overview apply: money lands in `PaymentLog`, the
receipt is an `Invoice`.

**Fee configuration (admin wizard Step 2):**
`Step2Service` -> `LiveSessionPaymentService.upsertPaymentConfig()` upserts a standard
`PaymentOption` with `source = LIVE_SESSION`, `source_id = <live_session.id>`,
`type = ONE_TIME`, holding exactly one `PaymentPlan` (price + currency). Disabling the
toggle soft-deletes the option — the session becomes free again and all legacy
behaviour is untouched.

**Purchase flow:**

```
1. Registrant submits the public form (or an authenticated learner hits the paywall)
   -> POST /admin-core-service/live-session/register-and-pay        (open, guests)
   -> POST /admin-core-service/live-sessions/v1/payment/register-and-pay (JWT, learners)
2. Backend guarantees an auth user for the payer (create-or-get via auth_service)
   -- invoices require user_id, and the invoice email goes to that user
3. SessionGuestRegistration row = the "bill" (live-session analogue of
   StudentFeePayment): payment_status PENDING, payment_amount/currency snapshot,
   plus FKs invoice_id + payment_log_id into the legacy tables
4. InvoiceService.createLiveSessionInvoice() raises a standard Invoice:
   source = LIVE_SESSION, source_id = registration id, one LIVE_SESSION line item,
   institute tax settings (INVOICE_SETTING), standard invoice numbering, PDF,
   ledger debit accrual (source type LIVE_SESSION)
5. Payer settles it on the existing open /pay/invoice/{invoiceId} page ->
   initiatePaymentForAdminInvoice(): PaymentLog created (user_id set,
   user_plan_id = null -- the same sanctioned null-UserPlan track that donations and
   admin invoices use), InvoicePaymentLogMapping links log -> invoice, institute's
   default gateway charges via the normal PaymentServiceFactory strategies
6. Gateway webhook marks the log PAID -> PaymentLogService.handlePostPaymentLogic
   -> markAdminInvoicePaidByPaymentLog(): invoice -> PAID, ledger credit,
   invoice email (force-sent for LIVE_SESSION regardless of the institute's
   sendInvoiceEmail opt-in), and the registration flips to payment_status = PAID
   (unlockLiveSessionRegistrationIfNeeded — same hook fires for offline
   "mark paid manually" settlements)
7. Join gating: LiveSessionJoinAuthorizer + the open guest endpoints refuse
   non-host joins on a paid session until a PAID registration exists
```

**Why no UserPlan:** `applyOperationsOnFirstPayment()` activates package-session
enrollment (SSIGM), which does not exist for a live class, and the UserPlan webhook
branch would generate a second USER_PLAN-source invoice. Live sessions therefore use
the established `user_plan = null` PaymentLog track (donations / admin invoices).

---

## API Reference

### Payment Option APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/payment-option` | Create payment option with plans |
| POST | `/v1/payment-option/get-payment-options` | List with filters |
| POST | `/v1/payment-option/make-default-payment-option` | Set default option |
| DELETE | `/v1/payment-option` | Soft delete |
| PUT | `/v1/payment-option` | Edit option + plans |
| GET | `/v1/payment-option/default-payment-option` | Get default |

### UserPlan APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/user-plan/{id}/with-payment-logs` | Plan + payment history |
| POST | `/v1/user-plan/all` | List with pagination + filters |
| POST | `/v1/user-plan/payment-logs` | Get payment logs |
| PUT | `/v1/user-plan/status` | Bulk status update |
| PUT | `/v1/user-plan/{id}/cancel` | Cancel enrollment |
| POST | `/v1/user-plan/membership-details` | Membership info |

### Fee Management APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/fee-management/cpo` | Create CPO with full hierarchy |
| GET | `/v1/fee-management/cpo/{instituteId}` | List CPOs |
| GET | `/v1/fee-management/cpo/{cpoId}/full` | Full CPO with installments |
| PUT | `/v1/fee-management/cpo/{cpoId}` | Update CPO metadata |
| PUT | `/v1/fee-management/fee-type/{feeTypeId}` | Update fee type + commercials |
| PUT | `/v1/fee-management/cpo/{cpoId}/soft-delete` | Soft delete |
| POST | `/v1/fee-management/cpo/{cpoId}/approve` | Approve pending CPO |
| GET | `/v1/fee-management/package-session/{id}/cpo-options` | CPOs for a class |

### Invoice APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/invoices/{id}` | Get invoice |
| GET | `/v1/invoices/user/{userId}` | User's invoices |
| GET | `/v1/invoices/{id}/download` | Download PDF |
| GET | `/v1/invoices/institute/{id}` | Institute invoices (paginated) |

All endpoints are prefixed with `/admin-core-service`.

---

## Statuses & Enums

### UserPlan Statuses
| Status | Meaning |
|--------|---------|
| `ACTIVE` | Plan is live and usable |
| `PENDING` | Awaiting admin approval |
| `PENDING_FOR_PAYMENT` | Awaiting payment |
| `PAYMENT_FAILED` | Payment attempt failed |
| `CANCELED` | User/admin canceled |
| `EXPIRED` | Past validity period |
| `TERMINATED` | Force-ended by admin |

### PaymentLog Statuses
| Status | Meaning |
|--------|---------|
| `INITIATED` | Payment started but not completed |
| `ACTIVE` | In progress |
| `SUCCESS` | Payment received |
| `FAILED` | Payment failed |

### StudentFeePayment Statuses
| Status | Meaning |
|--------|---------|
| `PENDING` | Not yet paid |
| `PARTIAL_PAID` | Some amount paid |
| `PAID` | Fully paid |
| `WAIVED` | Concession covers full amount |
| `OVERDUE` | Past due date and unpaid |

### CPO Statuses
| Status | Meaning |
|--------|---------|
| `ACTIVE` | Ready for use |
| `PENDING_APPROVAL` | Needs admin approval |
| `DELETED` | Soft deleted |

### PaymentOption Types
`SUBSCRIPTION`, `ONE_TIME`, `FREE`, `DONATION`

### Allocation Scopes
`OVERDUE_ONLY`, `UPCOMING_ONLY`, `ALL_DUES`

### Adjustment Types
`CONCESSION` (reduces amount), `PENALTY` (increases amount)

### Allocation Types (Ledger)
`PAYMENT`, `OVERPAYMENT`, `REFUND`, `ROLLOVER`

### Payment Gateways
`razorpay`, `stripe`, `cashfree`, `phonepe`, `eway`, `paypal`

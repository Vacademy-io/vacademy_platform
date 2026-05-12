# CPO ↔ PaymentOption Unification — Context

## The problem we set out to solve

Two parallel payment systems existed in `admin_core_service`:

- **PaymentOption** with types `FREE / ONE_TIME / SUBSCRIPTION / DONATION`. Used by the regular learner-enrollment flow through `PaymentOptionOperationFactory` → strategy → `PaymentService.handlePayment()`.
- **ComplexPaymentOption (CPO)** — a tree of `fee_type → assigned_fee_value → aft_installments`. Used only by the school admission flow via `SchoolEnrollService` → `StudentFeePaymentGenerationService.generateFeeBills()`.

Each had its own entry point, user linkage, webhook branch, and DTOs. Every new capability had to be built twice.

## The unified model

CPO is now the **fifth PaymentOption type**: `PaymentOptionType.CPO`. The legacy CPO tables (`complex_payment_option`, `fee_type`, `assigned_fee_value`, `aft_installments`, `student_fee_payment`) are unchanged. CPO admin APIs (`/v1/fee-management/cpo/*`) are unchanged.

```
              ┌─────────────────────────────────────────────┐
              │           complex_payment_option            │  (legacy CPO root)
              └─────────────────────────────────────────────┘
                          ▲                ▲
                          │ FK             │ id
                          │                │
   ┌──────────────────────┴──────┐   ┌─────┴──────────┐
   │  payment_option (mirror)    │   │   fee_type     │ → assigned_fee_value → aft_installments
   │  type='CPO'                 │   └────────────────┘
   │  source='INSTITUTE'         │
   │  source_id=cpo.institute_id │
   │  complex_payment_option_id  │  ◄── NEW FK column (V232)
   └─────────────────────────────┘
                  │ 1:1
                  ▼
   ┌─────────────────────────────┐
   │  payment_plan (synthetic)   │  ← actual_price = SUM(installments) = total contract value
   │  tag='DEFAULT'              │     validity_in_days derived from installment date range
   │  payment_option_id          │
   └─────────────────────────────┘
```

### Mirror PaymentOption

Every CPO has a single "mirror" row in `payment_option` with:

- `type = 'CPO'`
- `source = 'INSTITUTE'`, `source_id = cpo.institute_id` — preserves institute-filter contract; existing `getPaymentOptions(source=INSTITUTE, sourceId=...)` listings unchanged
- `complex_payment_option_id` → points back at the CPO (new column on `payment_option`)
- `name`, `status` synced from the CPO

The mirror is what every learner-facing flow consumes. Bridge tables (`package_session_learner_invitation_to_payment_option.payment_option_id`) point at it like any other PaymentOption.

### Synthetic PaymentPlan

Every CPO mirror has exactly **one** synthetic `payment_plan` row with:

- `actual_price` = **total contract value** = sum of all `aft_installments.amount` (₹30,000 if 3 × ₹10,000)
- `validity_in_days` = `MAX(end_date) - MIN(start_date)` across installments, or `null` if dates are missing
- `tag = 'DEFAULT'`, `currency = 'INR'`, `status = 'ACTIVE'`

The synthetic plan exists so every existing reader of `userPlan.paymentPlan` (the strategies, the v2 multi-package summer, analytics, renewal checks) keeps working without null guards. **It carries the total**, not the first installment.

## How a mirror + synthetic plan is created

Two paths, both go through the same helpers:

### 1. Admin creates a CPO

`POST /v1/fee-management/cpo` → `FeeManagementService.createCpo()` (unchanged DTOs, unchanged response). After persisting the CPO + fee_types + assigned_fee_values + installments, it calls:

```java
paymentOptionService.findOrCreateMirrorForCpo(savedCpo);
```

That helper:
1. Looks for an existing `payment_option` row with `complex_payment_option_id = cpo.id`. If found, syncs `name`/`status`/synthetic plan and returns.
2. Otherwise, inserts a fresh mirror with the fields above, then calls `upsertSyntheticPaymentPlan(cpo, mirror)` which:
   - Walks `fee_type → assigned_fee_value → aft_installments` to compute the total and validity
   - Either creates a new `payment_plan` row or updates the existing one (one per mirror)

The same sync is invoked on `updateCpo`, `updateFeeType`, `approveCpo`, `softDeleteCpoById` — anywhere CPO state changes, the mirror + synthetic plan re-syncs.

### 2. Migration V232 (one-time backfill)

For CPOs that already existed before the deploy:

```sql
-- step 1: add the FK column on payment_option
ALTER TABLE payment_option ADD COLUMN complex_payment_option_id VARCHAR(255);
ALTER TABLE payment_option ADD CONSTRAINT fk_payment_option_cpo FOREIGN KEY (complex_payment_option_id) REFERENCES complex_payment_option(id);

-- step 2: one mirror PaymentOption per existing CPO
INSERT INTO payment_option (id, name, status, source, source_id, type, ..., complex_payment_option_id, ...)
SELECT gen_random_uuid(), cpo.name, ..., 'INSTITUTE', cpo.institute_id, 'CPO', ..., cpo.id, ...
FROM complex_payment_option cpo
WHERE NOT EXISTS (SELECT 1 FROM payment_option po WHERE po.complex_payment_option_id = cpo.id);

-- step 3: one synthetic payment_plan per mirror
INSERT INTO payment_plan (..., actual_price, validity_in_days, payment_option_id, ...)
SELECT ...,
       COALESCE(SUM(afi.amount), MAX(afv.amount), 0),
       NULLIF(DATEDIFF(MAX(afi.end_date), MIN(afi.start_date)), 0),
       po.id, ...
FROM payment_option po
LEFT JOIN fee_type ft ON ft.cpo_id = po.complex_payment_option_id
LEFT JOIN assigned_fee_value afv ON afv.fee_type_id = ft.id
LEFT JOIN aft_installments afi ON afi.assigned_fee_value_id = afv.id
WHERE po.type = 'CPO'
GROUP BY po.id;

-- step 4: repoint old bridge rows that carried cpo_id directly to the mirror
UPDATE package_session_learner_invitation_to_payment_option bridge
SET payment_option_id = po.id
FROM payment_option po
WHERE po.complex_payment_option_id = bridge.cpo_id;

-- step 5: drop bridge.cpo_id (column is redundant; new code derives CPO via the mirror)
ALTER TABLE package_session_learner_invitation_to_payment_option DROP COLUMN cpo_id;
```

### V233 hotfix

Migration V232 drops `bridge.cpo_id`, which is destructive. If the migration runs **before** the matching JAR (old code still has `@Column(name="cpo_id")` on the bridge entity), every transaction that touches the bridge — course creation, Razorpay webhook, school enrollment — aborts with `column "cpo_id" does not exist`. **V233** re-adds the column as a nullable, unused placeholder so old code's queries succeed. The new code never references it; the column can be dropped again in a later cleanup migration once every environment is on the new JAR.

## The runtime flow for a CPO-backed enrollment

1. Admin attaches the CPO to an `EnrollInvite` via `PUT /v1/enroll-invite/{id}/assign-cpo`. This sets `bridge.payment_option_id` to the CPO mirror.
2. Learner enrolls (via `POST /v1/learner/enroll` or `POST /v2/learner/enroll`) with `payment_option_id` = mirror's id.
3. `PaymentOptionOperationFactory.getStrategy(CPO)` returns the new `ComplexPaymentOptionOperation`.
4. Strategy validates the CPO via the shared `CpoValidationService`, creates a `UserPlan` with the mirror + synthetic plan, calls **`StudentFeePaymentGenerationService.generateFeeBills` (unchanged)** to create one `student_fee_payment` row per installment.
5. Strategy resolves the amount to charge:
   - If `extraData.OVERRIDE_TOTAL_AMOUNT` is present (v2 multi-package summer) → use it
   - Else if `paymentInitiationRequest.amount` is set by the caller (learner-specified partial amount) → use it, validating `[1, fullOutstanding]`
   - Else default to the next unpaid installment amount via `CpoDuesCalculator.computeNextInstallmentAmount(userPlanId)`
6. Strategy calls `PaymentService.handlePayment(...)` with `paymentType=SCHOOL` so the existing Razorpay `handleSchoolPayment` webhook branch handles allocation + UserPlan activation + receipts. No webhook changes.
7. On webhook PAID, `FeeLedgerAllocationService` FIFO-allocates the payment across the unpaid `student_fee_payment` rows; `invoiceService.generateInvoice` produces a real `Invoice` row.

## Why the synthetic plan carries the total (not the first installment)

- `MultiPackageLearnerEnrollService` iterates `paymentPlans[0].actualPrice` to compute the multi-package total. If the plan held only ₹7,500, multi-package summing would be wrong.
- `UserPlan.endDate` is derived from `paymentPlan.validityInDays`. Validity needs to be the full contract duration.
- Analytics / dashboards / "what's the course fee?" displays read `actualPrice`. The full contract value is the right answer.

What the learner sees on enrollment is the **first unpaid installment** (₹7,500), computed at runtime by `CpoDuesCalculator` and overridden onto `paymentInitiationRequest.amount`. The synthetic plan stays as the source of truth for total/validity; the strategy resolves "what to charge now" separately.

## Key entities at a glance

| Table | Purpose | Touched by V232? |
|---|---|---|
| `complex_payment_option` | CPO root | no schema change |
| `fee_type` / `assigned_fee_value` / `aft_installments` | CPO template tree | no schema change |
| `student_fee_payment` | Per-learner installment bills (`cpo_id` column on this table is unchanged) | no schema change |
| `payment_option` | Adds `complex_payment_option_id` FK; one new row per CPO (mirror) | column added + rows inserted |
| `payment_plan` | One synthetic plan per mirror | rows inserted |
| `package_session_learner_invitation_to_payment_option` | Bridge — its `payment_option_id` now points at the CPO mirror for CPO-attached invites; the old `cpo_id` column was dropped (V232) and re-added as unused by V233 for rolling-deploy safety | column dropped+re-added, data repointed |
| `user_plan` | UserPlan for a CPO enrollment now carries the mirror PaymentOption + synthetic PaymentPlan (was null `paymentPlan` for school CPO before) | no schema change |

## Where new code lives

| File | Purpose |
|---|---|
| `features/user_subscription/enums/PaymentOptionType.java` | Adds `CPO` enum value |
| `features/user_subscription/entity/PaymentOption.java` | Adds `complexPaymentOptionId` field |
| `features/user_subscription/service/PaymentOptionService.java` | Adds `findOrCreateMirrorForCpo` / `syncMirrorForCpo` / `findByComplexPaymentOptionId` + default `excludeTypes=['CPO']` on the generic listing |
| `features/user_subscription/repository/PaymentOptionRepository.java` | Adds `excludeTypes`/`hasTypes` filter to native + JPQL queries; adds `findByComplexPaymentOptionId` |
| `features/fee_management/service/CpoValidationService.java` (NEW) | Shared CPO/package-session validation |
| `features/fee_management/service/CpoDuesCalculator.java` (NEW) | "Amount due now" / next-installment / full-outstanding helpers |
| `features/learner_payment_option_operation/service/ComplexPaymentOptionOperation.java` (NEW) | Fifth strategy implementing `PaymentOptionOperationStrategy` |
| `features/learner_payment_option_operation/service/PaymentOptionOperationFactory.java` | Wires the new strategy into the type-to-strategy map |
| `features/fee_management/service/FeeManagementService.java` | Calls mirror-sync after every CPO create/update/approve/soft-delete |
| `features/enroll_invite/service/PackageSessionEnrollInviteToPaymentOptionService.java` | `assignCpoToPackageSession` now stamps the CPO mirror on `bridge.payment_option_id` |
| `features/enroll_invite/entity/PackageSessionLearnerInvitationToPaymentOption.java` | `cpoId` field removed; convenience getter derives CPO id via `paymentOption.complexPaymentOptionId` |
| `features/admission/service/SchoolEnrollService.java` | Uses the mirror PaymentOption + synthetic PaymentPlan + shared `CpoValidationService`; external API unchanged |
| `features/learner/service/LearnerEnrollRequestService.java` | `createUserPlan` puts CPO into `PENDING_FOR_PAYMENT` when online payment is required |
| `features/fee_management/controller/FeeTrackingLearnerController.java` + `LearnerInstallmentPaymentService.java` (NEW) | New `POST /learner/v1/fee/pay-installments` for self-serve installment payments |
| `features/invoice/service/InvoiceService.java` | `getInvoicesByUserId` union-merges unpaid `student_fee_payment` rows so the Payment History tab shows pending dues alongside paid invoices |
| `db/migration/V232__Unify_CPO_into_payment_option.sql` | The migration |
| `db/migration/V233__Restore_bridge_cpo_id_for_rollout_compat.sql` | Safety net for migration-vs-code deploy ordering |

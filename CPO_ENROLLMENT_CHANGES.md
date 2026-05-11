# CPO in Course-Enrollment — Change Log & Next Steps

> Companion to [CPO_PAYMENT_OPTION_CONTEXT.md](CPO_PAYMENT_OPTION_CONTEXT.md). That file
> explains the unified CPO ↔ PaymentOption model; this one tracks the work added on top
> of it to expose CPO during admin-driven enrollment (bulk + single-student).

---

## What changed

### Backend — `admin_core_service`

**Payment-option payload surface**
- [PaymentOption.java](admin_core_service/src/main/java/vacademy/io/admin_core_service/features/user_subscription/entity/PaymentOption.java) — removed the `@ManyToOne` mapping to `ComplexPaymentOption`. The dual mapping (scalar + relation on the same column) was making `complexPaymentOptionId` come back `null` on the enroll-invite payload path. Only the scalar remains.
- [EnrollInviteService.java](admin_core_service/src/main/java/vacademy/io/admin_core_service/features/enroll_invite/service/EnrollInviteService.java#L516-L522) — invite payload now emits `unit` and `complexPaymentOptionId` so the frontend can detect CPO and fetch full installment details.

**Per-assignment DTOs**
- [AssignmentItemDTO.java](admin_core_service/src/main/java/vacademy/io/admin_core_service/features/learner_management/dto/AssignmentItemDTO.java) — new `cpoPaymentAmount` and `cpoPaymentMode` (`"SKIP"` | `"OFFLINE"`). Amount range: `[1, totalCpoContractValue]`.
- [BulkAssignResultItemDTO.java](admin_core_service/src/main/java/vacademy/io/admin_core_service/features/learner_management/dto/BulkAssignResultItemDTO.java) — new `paymentOptionType`, `cpoTotalAmount`, `cpoInstallmentCount`, `cpoInitialPaymentAmount`, `cpoInitialPaymentMode` for preview + result display.

**Bulk-assign engine** ([BulkAssignmentService.java](admin_core_service/src/main/java/vacademy/io/admin_core_service/features/learner_management/service/BulkAssignmentService.java))
- Threads the `AssignmentItemDTO` into `handleNewEnrollment` and `handleReEnroll`.
- `summarizeCpoFromTemplate(cpoId)` — walks `fee_type → assigned_fee_value → aft_installments` to compute total + count for the result row (falls back to single-bill CPO when no installments).
- `applyCpoEnrollmentSideEffects(...)`:
  1. Always calls `StudentFeePaymentGenerationService.generateFeeBills(...)` so the learner's installment rows exist (the self-serve `pay-installments` flow needs them).
  2. If `cpoPaymentMode == "OFFLINE"` and `cpoPaymentAmount > 0`:
     - validates against `CpoDuesCalculator.computeFullOutstandingForUserPlan`
     - creates a `MANUAL` / `PAID` / `SUCCESS` PaymentLog via `paymentLogService`
     - FIFO-allocates via `FeeLedgerAllocationService.allocatePaymentForNewLog`
     - optionally generates an `Invoice` when `generateInvoiceOnManualEnroll == true`
- The existing generic "create PaymentLog if globalPaymentDate / transactionId set" branch is **skipped for CPO** — that path uses `paymentPlan.actualPrice` (full contract value), which would be wrong for a partial collection.

### Frontend — `frontend-admin-dashboard`

**Types** — [bulk-assign-types.ts](frontend-admin-dashboard/src/routes/manage-students/students-list/-types/bulk-assign-types.ts) mirrors backend DTOs; also adds `complex_payment_option_id` on `PaymentOption` and `cpoPaymentMode` / `cpoPaymentAmount` on `SelectedPackageSession`.

**Shared hook** — [useResolvedInviteDetails.ts](frontend-admin-dashboard/src/routes/manage-students/students-list/-hooks/useResolvedInviteDetails.ts) takes `(instituteId, packageSessionId, enrollInviteId | null)` and returns the effective `PaymentOption` + `complexPaymentOptionId`. In Auto mode (no invite picked), it fetches the package session's invites and picks the DEFAULT-tagged ACTIVE one — matching the backend `DefaultInviteResolver`, so the panel previews what will actually be enrolled against.

**Reusable installment panel** — [CpoInstallmentPanel.tsx](frontend-admin-dashboard/src/routes/manage-students/students-list/-components/enroll-bulk/components/CpoInstallmentPanel.tsx):
- Loads CPO via `useCPOFullDetails(cpoId)`, flattens `fee_types → afv → installments`.
- Highlights next-due, strikes through PAID rows.
- Radio: "Skip — enroll only" vs "Record offline payment". OFFLINE shows an amount input prefilled to next-due, clamped to `[1, totalAmount]`.

**Bulk flow**
- [Step3EnrollConfig.tsx](frontend-admin-dashboard/src/routes/manage-students/students-list/-components/enroll-bulk/bulk-assign-dialog/steps/Step3EnrollConfig.tsx) — extracts `CourseConfigRow`, renders the panel when type=CPO.
- [BulkAssignDialog.tsx](frontend-admin-dashboard/src/routes/manage-students/students-list/-components/enroll-bulk/bulk-assign-dialog/BulkAssignDialog.tsx#L114-L126) — forwards `cpo_payment_mode` / `cpo_payment_amount` on each assignment.
- [Step4Preview.tsx](frontend-admin-dashboard/src/routes/manage-students/students-list/-components/enroll-bulk/bulk-assign-dialog/steps/Step4Preview.tsx) — CPO summary in the result table.

**Single-student flow** (Students → side view → Assign to course)
- [invite-picker-row.tsx](frontend-admin-dashboard/src/routes/manage-students/students-list/-components/students-list/student-side-view/student-courses/invite-picker-row.tsx) — `cpoPayment` on `PackageSessionConfig`, uses the hook (works in Auto mode too), renders the panel inline, resets state on invite change.
- [assign-course-dialog.tsx](frontend-admin-dashboard/src/routes/manage-students/students-list/-components/students-list/student-side-view/student-courses/assign-course-dialog.tsx) — folds CPO fields into the API request; confirmation shows the CPO summary.

---

## What to pick next

### 1. Wire CPO installment payments into the learner profile Payment Log API

**Problem.** When a learner pays a CPO installment (or an admin records an offline collection), we currently write to:
- [`payment_log`](admin_core_service/src/main/java/vacademy/io/admin_core_service/features/user_subscription/entity/PaymentLog.java) — the canonical payment event (linked to `user_plan_id`).
- [`student_fee_payment`](admin_core_service/src/main/java/vacademy/io/admin_core_service/features/fee_management/entity/StudentFeePayment.java) — the per-installment bill (linked to `user_id` + `user_plan_id`, **no FK to `payment_log`**).
- [`student_fee_allocation_ledger`](admin_core_service/src/main/java/vacademy/io/admin_core_service/features/fee_management/entity/StudentFeeAllocationLedger.java) — written by [`FeeLedgerAllocationService.allocatePaymentForNewLog`](admin_core_service/src/main/java/vacademy/io/admin_core_service/features/fee_management/service/FeeLedgerAllocationService.java#L175). This is the **bridge table** — it already carries both `payment_log_id` and `student_fee_payment_id`.

The learner profile's payment-log surface (today only the single-log fetch at [`OpenPaymentLogController.java:18`](admin_core_service/src/main/java/vacademy/io/admin_core_service/features/user_subscription/controller/OpenPaymentLogController.java) and the institute-scoped list in `PaymentLogService.getPaymentLogsForInstitute`) doesn't expose these installment events with their CPO context. From the learner's "Payment History" view, a CPO learner sees an opaque `PaymentLog` row with no idea which installments it cleared.

**The bridge already exists.** `student_fee_allocation_ledger.payment_log_id` ↔ `payment_log.id`, and `student_fee_allocation_ledger.student_fee_payment_id` ↔ `student_fee_payment.id`. We just need to read through it.

**Suggested approach.**
1. Add (or repurpose) a learner-scoped endpoint — `GET /v1/learner/payment-history` or similar — that returns `PaymentLog` rows for `(userId, instituteId)`.
2. For each `PaymentLog`, join via `StudentFeeAllocationLedger` to surface the `StudentFeePayment` rows it allocated against — fee type, installment number, due date, amount allocated. This mirrors the pattern in [`InvoiceService.getInvoicesByUserId`](admin_core_service/src/main/java/vacademy/io/admin_core_service/features/invoice/service/InvoiceService.java#L1860) (line 1864 → `buildPendingSfpInvoiceDTOs`, line 1884 queries `findByUserIdAndStatusNot(userId, "PAID")`), which union-merges unpaid SFPs into the invoice history.
3. Also surface **unpaid** `StudentFeePayment` rows alongside the paid logs so the learner sees their full dues timeline (same union pattern).
4. Make sure both write paths — `ComplexPaymentOptionOperation` (learner-driven Razorpay) and `BulkAssignmentService.applyCpoEnrollmentSideEffects` (admin offline collection) — produce ledger rows that this API can read. The admin path already does (it calls `allocatePaymentForNewLog`); double-check the learner path generates the same shape.

**Open question for the API design.** Should the response shape be:
- (a) a flat list of `PaymentLog` rows with a nested `allocations: [{ studentFeePaymentId, feeType, installmentNumber, amount }]`, or
- (b) a flat list of installment events (one row per `student_fee_allocation_ledger` row)?

(a) preserves the payment-log grouping (one Razorpay charge that cleared 2 installments shows as one row); (b) is easier to render as a timeline. Pick based on how the learner profile UI wants to display it.

### 2. Revert localhost URLs in `frontend-admin-dashboard/src/constants/urls.ts`

Four entries currently point at `http://localhost:8072` instead of `${BASE_URL}`:
- `GET_INVITE_LINKS`
- `GET_SINGLE_INVITE_DETAILS`
- `BULK_ASSIGN_LEARNERS`
- `GET_CPO_FULL_DETAILS`

These are dev overrides. They will break in any deployed environment — revert before merging.

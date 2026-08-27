# HR & Payroll — Backend Review & Gap-Closure Plan

> **STATUS 2026-08-27 — Wave 1 BUILT (not committed/deployed).** Phase A (security) + B1 (payroll crash/state-machine) implemented and compiling:
> HR_ADMIN/HR_MANAGER roles seeded (auth_service V17) + `HrAccessGuard` on all 17 HR controllers per the access matrix; every by-ID load institute-scoped; all body-instituteId spoof vectors closed; self-service employeeIds bound to the JWT; AES-256-GCM at-rest encryption for bank account/PAN/UAN/statutory_info (`HR_FIELD_ENCRYPTION_KEY` env, `ENCv1:` prefix, legacy plaintext reads through; V200 widens columns); `@Auditable` on sensitive mutations; `@Version` on the 5 financial entities; TDS NOT-NULL crash fixed via get-or-create system component; silent catches → `hr_payroll_entry_error` table; run processing row-locked; new PUT `/runs/{id}/reject` (PROCESSED→DRAFT with full reversal); cancel reverses loans/reimbursements and no longer blocks the month (partial unique + `run_type`); mark-paid sets entry PAID; totals recompute on hold/release; loan mutations deferred to post-calculation; tax computations upsert (V200 unique). Also fixed in passing: overlapping shift-mapping 500, holiday bulk duplicate 500, leave approval balance re-validation + not-self rule, template cross-tenant component refs.
> **Deploy prereqs:** set `HR_FIELD_ENCRYPTION_KEY` (openssl rand -base64 32) in admin_core; assign HR_ADMIN/HR_MANAGER roles to HR users via the existing add-user-roles flow. Remaining waves below unchanged.

Date: 2026-08-27. Scope: the 8 `hr_*` packages in admin_core_service (203 files, ~12.4k lines, migrations V128–V149) built from `docs/erp/plan.md`, reviewed by four parallel deep audits (employee/attendance/leave, salary/payroll/payslip, tax engine, cross-cutting security/integration).

Product decisions locked for this plan:
- **Geographies:** India (fully real) + Gulf (UAE/Saudi: WPS, EOSB gratuity, GOSI/GPSSA).
- **Payouts:** bank-file export now, payout-provider abstraction so RazorpayX/Cashfree can plug in later.
- **Connected v1:** LMS (teacher work → pay), Finance (payroll cost vs fee revenue + journal export), CRM (incentives as variable pay), existing workflow engine + notification_service.
- **ERP next:** Accounting/GL + HR-suite deepening — architect for both now.

---

## 1. Verdict

The **skeleton is real and worth keeping**: all 34 planned tables exist with correct constraints, all planned entities/CRUD/endpoints exist, and three pieces of logic are genuinely careful — attendance/leave-overlap proration in payroll, loan EMI amortization with reprocess-reversal, and leave application validation (balance, overlap, holiday exclusion).

But the system is **not shippable and not yet "advanced"**:

1. **Security is absent, systemically (P0).** The plan's HR_ADMIN/HR_MANAGER roles exist nowhere in the codebase — not in auth_service, not seeded, not checked. Every one of the 17 HR controllers validates only "caller belongs to the instituteId query param". Consequences: a **student** of an institute can process payroll, approve their own leave, read every employee's salary structure and payslip, and download the bank-export CSV with plaintext account numbers. Every by-ID endpoint has **cross-tenant IDOR** (validate against institute A, pass institute B's resource id — the same pattern as the prior report-endpoints incident), and several writes trust `dto.instituteId` from the body while validating the query param (attendance config, approval chains, payroll runs, salary templates — cross-tenant *write*). No self-service binding: any user can check in / apply leave as any employeeId (acknowledged by a TODO in the code). Bank accounts, PAN, UAN, statutory JSON stored plaintext.

2. **The India tax engine mis-deducts real money (P0).** FY 2024-25 slabs (one year stale), the 25% slab missing entirely, **no §87A rebate** (a ₹10L employee is charged ~₹44k that should be ₹0), new-regime slabs combined with old-regime deductions (a legally nonexistent hybrid), regime selection ignored, HRA exemption is whatever number the employee types (uncapped, unverified — can zero out tax), no surcharge. EPF/ESI/PT code exists but `getStatutoryDeductions()`/`getEmployerContributions()` are **never called** — statutory deductions don't happen. Rates are hardcoded in Java; the `tax_rules` JSONB design is decorative; no effective-dating.

3. **Payroll processing crashes silently for tax-configured institutes (P0).** The TDS entry component is created with a null `component_id` against a NOT NULL column; the failure is swallowed by empty catch blocks (per-employee and tax-block), so entries silently vanish mid-run. Also: a **CANCELLED run permanently blocks that month** (unique constraint + no re-create), and cancelling leaks state — loan balances stay debited and pending reimbursements are eaten forever. No PROCESSED→DRAFT path, so a wrong run can never be recalculated.

4. **A long tail of stored-but-never-read features.** The TIME_TRACKING/DAY_LEVEL mode switch (the plan's central attendance decision), YEARLY/QUARTERLY accrual (leave module unusable for yearly-quota institutes), pro-rata, comp-off expiry, auto-checkout, shift grace/thresholds, `weekend_days` in leave counting (hardcoded Sat/Sun), optional-holiday quotas, formula components, loan start month, `payment_ref`, document verification. The approval engine is a status counter wired to nothing — no approver resolution, any non-requester can approve all levels, and none of leave/loan/reimbursement/salary-revision use it (each has its own single-approver field; salary revisions are born self-approved).

5. **Integrations are 0%.** No notification calls (payslip `email_status` stuck at NOT_SENT), no media_service (payslips are **raw HTML stored in a DB column** with a fake UUID file id — no PDF, no download endpoint, despite OpenHtmlToPdf being in pom.xml and used by two other features; bank "XLSX" is CSV bytes in a `.xlsx` filename — POI is in pom.xml, never imported), **zero `@Scheduled` jobs** (accrual, comp-off expiry, auto-checkout, probation-end, auto-approve are all inert), zero `@Auditable` usage (the platform's audit pattern is used in 23 other files; salary and bank-detail changes leave no trail), zero `@Version` locking (leave balance and run transitions race).

6. **Correctness bugs beyond tax:** UTC/IST — check-ins before 05:30 IST land on the previous date and there is no per-institute timezone anywhere; leave-balance approval doesn't re-validate balance (concurrent approvals go negative); accrual re-invocation double-accrues for mid-year joiners; mid-month joiners get a **full month's salary** (no DOJ proration), NOTICE_PERIOD employees get **no salary** (excluded from runs); salary structure selection ignores effective dates; annual tax projection = LOP-distorted month × 12 with no YTD catch-up; run totals ≠ bank total after a hold; PERCENTAGE_OF_GROSS ordering bug; no CTC tie-out (no balancing component); IP restriction compares client-supplied IP and CIDR entries never match (enabling it blocks everyone); approved leave never writes ON_LEAVE attendance so summaries are wrong; N+1s everywhere (attendance summary ≈ 5 queries/employee; payroll ≈ 13–16/employee, row-by-row saves, one giant transaction).

7. **Duplication with the platform:** `hr_employee_profile` is a third parallel "person who works here" beside `staff` and `faculty` with no bridge; `hr_approval` rebuilds a weak subset of the existing workflow engine (which has triggers, SpEL, idempotency, schedulers); HR holidays are invisible to session scheduling; live-session teaching activity doesn't feed HR attendance; payroll produces no finance-side entry.

Zero tests exist for any hr_* package.

---

## 2. Gap-Closure Plan

Phases A–C are pre-deploy blockers. D before the first Indian customer runs a real payroll year. E gates the first Gulf customer. F is the "connected ERP" differentiator and can proceed in parallel after A+B.

### Phase A — Make it safe (blocker)
1. **Roles.** Add HR_ADMIN, HR_MANAGER to the role system (auth_service + seeding); implement the plan-G access matrix via a small `HrAccessGuard` used by every controller: admin ops require HR_ADMIN/ADMIN, team ops require HR_MANAGER + reporting-line check, self-service resolves `employeeId` **from the JWT user id** (never from the body).
2. **Tenant ownership.** Repo convention: every by-ID load becomes `findByIdAndInstituteId(...)` (or post-load `entity.instituteId == validatedInstituteId` check) across all ~20 services; delete every `dto.getInstituteId()` write-path read — the validated query-param/path institute is the only source of truth.
3. **Data protection.** AES converter (JPA `AttributeConverter`) for `account_number`, `pan_number`, `uan_number`, `statutory_info`; privileged unmask path for payroll/bank-export only; mask `statutory_info` in DTOs (currently unmasked); fix the round-trip bug where a masked PAN (`****1234`) gets persisted on update.
4. **Audit + locking.** `@Auditable` (existing platform aspect) on salary assignment/revision, bank-detail change, payroll process/approve/mark-paid, hold/release (hold history table — release currently wipes the reason); `@Version` on PayrollRun, PayrollEntry, LeaveBalance, EmployeeLoan, EmployeeSalaryStructure.

### Phase B — Make it correct (blocker)
1. **Payroll engine fixes.**
   - Seed system `SalaryComponent`s (TDS, PF, ESI, PT, OT, arrears) per institute → fixes the NOT NULL crash and makes overtime/reimbursements/statutory visible on payslips as components.
   - Replace empty catches with a `hr_payroll_entry_error` table + per-run error report; fail loudly on tax-engine errors instead of silent zero tax.
   - State machine: add PROCESSED→DRAFT (reject/recalculate); allow a new run after CANCELLED (drop the hard unique, add `run_type` + `supersedes_run_id`, unique on *active* runs only); cancel performs full cleanup (loan reversal, reimbursement unlink, tax-computation delete); recompute run totals after hold/release; entry-level PAID + `payment_ref` set by mark-paid; block hold/release on PAID runs; `SELECT … FOR UPDATE` on run during process.
   - Proration: DOJ/exit-date proration; include NOTICE_PERIOD in runs; pick salary structure by effective date vs the run period; split-period blending for mid-month revisions with **arrears** generation (arrears engine replaces the hardcoded zero).
   - CTC tie-out: a balancing component (Special Allowance = CTC − Σ others) + validation that template resolves to 100% of CTC; fix PERCENTAGE_OF_GROSS ordering; implement FORMULA via the workflow engine's SpEL evaluator.
   - Performance: hoist per-institute lookups, batch attendance/leave prefetch per run, `saveAll` + JDBC batching, chunked commits (per-employee or per-100), async processing with a progress endpoint for large institutes; add missing indexes (`hr_loan_repayment(payroll_entry_id)`, `hr_reimbursement(payroll_entry_id)`, `hr_attendance_record(institute_id, attendance_date)`, `hr_leave_application(applied_to)`, `hr_employee_salary_structure(employee_id, status)`).
2. **India tax engine rebuild (data-driven).**
   - Move slabs/rates/caps into `tax_rules` JSONB with `effective_from`/`financial_year` (add the column, drop in-place upsert) — FY changes become data, not deploys. Seed FY 2025-26: new regime 0-4/4-8/8-12/12-16/16-20/20-24/>24 (5/10/15/20/25/30%), §87A rebate to ₹12L, SD ₹75k; old regime slabs + §87A to ₹5L + SD ₹50k; surcharge tiers + marginal relief; 4% cess.
   - Honor the employee's declared regime; enforce regime-legal deductions only (80C/80D/80CCD/80E/HRA under OLD only); compute HRA exemption properly (min of actual HRA component, rent−10% basic, 50/40% basic) from the declared rent — never trust a self-declared exemption amount; only VERIFIED declarations reduce TDS after the institute's proof-cutoff date.
   - Wire `getStatutoryDeductions`/`getEmployerContributions` into the run as components; EPF on the **actual BASIC component** (not gross×0.5) with EPS 8.33/3.67 split and ₹15k ceiling; ESI with Apr–Sep/Oct–Mar contribution-period stickiness; PT as a per-state slab table (config-driven, Maharashtra Feb ₹300 etc.); add LWF (state-wise).
   - TDS = true-up: YTD actual income + projected remaining months → (annual tax − TDS already deducted) ÷ months remaining; fix `TaxComputation` to hold real cumulative values, delete on reprocess, unique (employee, fy, month).
   - Fix `TaxConfigurationRepository` Optional-vs-multiple-rows bug; honor `financial_year_start_month`.
3. **Attendance/leave correctness.**
   - Per-institute **timezone** (new column on AttendanceConfig or institute settings); all `LocalDate.now()`/day-bucketing through it (JVM stays UTC per platform rule).
   - Implement the mode switch (DAY_LEVEL institutes skip check-in machinery; summaries branch on mode); leave day-counting uses configured `weekend_days`; fix half-day-on-holiday ordering bug; approved leave writes ON_LEAVE attendance records; auto-absent job marks missing days (kills the "no records = full pay" cliff by making records exist).
   - Accrual: implement YEARLY/QUARTERLY; replace the broken idempotency heuristic with an **accrual-ledger table** (one row per employee/type/period, unique) — also gives pro-rata for mid-year joiners; re-validate balance at approval under lock; LOP/unpaid leave as a first-class output consumed by payroll.
   - Comp-off as consumable units: expiry job, attendance-verified eligibility (worked a holiday/weekend per records), server-set earned days.
   - Server-derived IP (X-Forwarded-For) + real CIDR matching; shift assignment closes prior mappings (fixes the NonUniqueResult 500 on second assignment); regularization validates out>in and re-derives status.

### Phase C — Make it complete (blocker for launch quality)
1. **Payslip pipeline:** OpenHtmlToPdf (InvoiceService pattern) → media_service S3 upload → real `file_id` → download endpoint → notification_service email with payslip attached (flip `email_status`); HTML-escape all interpolated fields; payslip regeneration versioning.
2. **Bank export:** real XLSX via POI; bank-specific formats (HDFC/ICICI/SBI/NEFT text); exclude-and-flag entries with missing bank details; persist the file to S3 with a download endpoint; join real employee names/emails.
3. **Schedulers:** leave accrual (monthly), comp-off expiry, auto-checkout, auto-absent, probation-end notification, document-expiry alerts — all as `@Scheduled` jobs following the platform's existing scheduler patterns.
4. **Attendance/payroll month-lock:** processing a run locks that month's attendance/leave for the institute; regularization/bulk-mark/cancel-leave refuse locked months (or generate arrears via Phase B's engine).
5. **Approvals — ride the existing workflow engine** (per product decision). Retire hr_approval's parallel engine: HR entities emit workflow triggers; approver resolution (REPORTING_MANAGER/DEPARTMENT_HEAD/HR_ADMIN) implemented once as workflow actions; leave/regularization/reimbursement/loan/salary-revision approval all route through it; approval outcome calls back into the HR service to mutate entity status; auto-approve/escalation via workflow scheduling. Salary revisions require a second approver (no more born-approved).
6. **F&F settlement + off-cycle:** exit flow computes final settlement (pro-rated salary, leave encashment payout, notice recovery, gratuity if eligible) as an off-cycle run (`run_type=FNF/OFF_CYCLE/BONUS`).
7. **Variable pay input API:** per-run per-employee component adjustments (the entity that CRM incentives and manual bonuses both feed).
8. **Tests:** engine-level unit tests (PayrollCalculationService, tax regimes vs hand-computed scenarios), concurrency tests on balance/run transitions, and the plan-J integration flow.

### Phase D — India compliance pack
Form 16 Part B generation (needs `computation_details` actually populated + PAN/TAN on institute tax config); Form 24Q quarterly data + challan tracking; **PF ECR file** (needs UAN + EPS split from Phase B); ESI return file (IP numbers); PT returns per state; gratuity provision accrual (4.81% of basic) + Payment of Gratuity eligibility; statutory bonus (Payment of Bonus Act) computation.

### Phase E — Gulf readiness
1. **Currency (prerequisite, do in Phase B migrations):** `currency` column on salary structure, payroll run/entry, payslip, bank export, loans, reimbursements; institute default currency; all DTOs carry it. No FX in v1 — one currency per institute.
2. **UAE engine:** no income tax; **EOSB gratuity accrual** (21/30 days per year rules) as an employer-cost component + provision report; **WPS SIF file** export (agent/employer IDs on institute config, per-employee routing via IBAN — fields already exist); unpaid-leave day reporting per WPS.
3. **Saudi engine:** GOSI contributions (nationals vs expats), Mudad/WPS equivalent, EOSB per Saudi labor law.
4. Weekend/holiday configurability already covered in Phase B (Sun–Thu, Fri–Sat institutes); FY start month honored.

### Phase F — Connected ERP (the differentiator)
1. **One person, one record:** bridge `hr_employee_profile` ↔ `staff`/`faculty` on (user_id, institute_id) — creating faculty offers HR profile creation and vice versa; org chart and payroll see teaching staff.
2. **LMS → pay:** live-session participation (existing live_session_logs + provider sync) feeds hr_attendance as `source=SYSTEM` for teaching staff; per-session/per-hour pay components computed from sessions taught (rate on designation or employee), entering payroll as variable pay via C7.
3. **CRM → incentives:** commission structures (per enrollment/lead conversion, from existing lead/enquiry data) computed monthly into the variable-pay API; incentive statement on the payslip.
4. **Finance/GL (architect now for the Accounting module):** `erp_journal_entry` + `erp_journal_line` tables with (source_module, source_id) refs and a component→GL-account mapping on SalaryComponent; payroll approval posts a journal (salary expense / statutory payable / net payable); department cost vs fee revenue report joins existing fee_management income; export journals to Zoho Books/Tally (CSV first, API later). Fees and future accounting post into the same journal layer — this table pair is the seed of the GL module.
5. **Notifications everywhere:** leave/approval/payslip/payroll events through notification_service (email/WhatsApp templates), driven by workflow triggers from C5.

### Phase G — Payout provider abstraction (design now, ship later)
`PayoutProvider` interface (initiate, status, reconcile) mirroring the existing PaymentServiceFactory pattern; v1 implementation = `BankFileProvider` (generates the file, admin marks paid, UTR bulk-import endpoint fills `payment_ref` per entry); later `RazorpayXProvider`/`CashfreeProvider` slot in without touching the run flow. Reconciliation report: run totals vs UTR-confirmed totals.

---

## 3. Suggested execution order

| Wave | Content | Gate |
|---|---|---|
| 1 | Phase A (security) + B1 state-machine/crash fixes | nothing deploys before this |
| 2 | B2 tax rebuild + B3 attendance/leave correctness + E1 currency columns | first pilot institute (India) |
| 3 | Phase C (payslips, bank files, schedulers, workflow approvals, F&F, variable pay, tests) | GA for India ex-compliance |
| 4 | Phase D (statutory filings) ∥ F1–F2 (person unification, LMS→pay) | first full Indian FY / teacher-payroll pitch |
| 5 | Phase E (Gulf) ∥ F3–F5 (CRM incentives, GL journal, notifications) | first Gulf customer / accounting module kickoff |
| 6 | Phase G payout API | when manual bank upload becomes the complaint |

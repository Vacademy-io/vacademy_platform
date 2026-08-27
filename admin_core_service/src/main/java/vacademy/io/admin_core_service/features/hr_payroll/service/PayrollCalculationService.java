package vacademy.io.admin_core_service.features.hr_payroll.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.hr_attendance.entity.AttendanceRecord;
import vacademy.io.admin_core_service.features.hr_attendance.entity.Holiday;
import vacademy.io.admin_core_service.features.hr_attendance.repository.AttendanceRecordRepository;
import vacademy.io.admin_core_service.features.hr_attendance.repository.HolidayRepository;
import vacademy.io.admin_core_service.features.hr_employee.entity.EmployeeBankDetail;
import vacademy.io.admin_core_service.features.hr_employee.entity.EmployeeProfile;
import vacademy.io.admin_core_service.features.hr_employee.repository.EmployeeBankDetailRepository;
import vacademy.io.admin_core_service.features.hr_employee.repository.EmployeeProfileRepository;
import vacademy.io.admin_core_service.features.hr_leave.entity.LeaveApplication;
import vacademy.io.admin_core_service.features.hr_leave.repository.LeaveApplicationRepository;
import vacademy.io.admin_core_service.features.hr_payroll.entity.*;
import vacademy.io.admin_core_service.features.hr_payroll.enums.PayrollEntryStatus;
import vacademy.io.admin_core_service.features.hr_payroll.enums.PayrollStatus;
import vacademy.io.admin_core_service.features.hr_payroll.repository.*;
import vacademy.io.admin_core_service.features.hr_salary.entity.EmployeeSalaryComponent;
import vacademy.io.admin_core_service.features.hr_salary.entity.EmployeeSalaryStructure;
import vacademy.io.admin_core_service.features.hr_salary.entity.SalaryComponent;
import vacademy.io.admin_core_service.features.hr_salary.enums.ComponentType;
import vacademy.io.admin_core_service.features.hr_salary.repository.EmployeeSalaryStructureRepository;
import vacademy.io.admin_core_service.features.hr_salary.repository.SalaryComponentRepository;
import vacademy.io.admin_core_service.features.hr_tax.entity.TaxComputation;
import vacademy.io.admin_core_service.features.hr_tax.entity.TaxConfiguration;
import vacademy.io.admin_core_service.features.hr_tax.entity.TaxDeclaration;
import vacademy.io.admin_core_service.features.hr_tax.repository.TaxComputationRepository;
import vacademy.io.admin_core_service.features.hr_tax.repository.TaxConfigurationRepository;
import vacademy.io.admin_core_service.features.hr_tax.repository.TaxDeclarationRepository;
import vacademy.io.admin_core_service.features.hr_tax.service.engine.TaxRegimeEngine;
import vacademy.io.admin_core_service.features.hr_tax.service.engine.TaxRegimeFactory;
import vacademy.io.common.exceptions.VacademyException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class PayrollCalculationService {

    private static final Logger log = LoggerFactory.getLogger(PayrollCalculationService.class);

    /** System salary component for TDS, get-or-created per institute (component_id is NOT NULL). */
    private static final String TDS_COMPONENT_CODE = "TDS";

    @Autowired
    private PayrollRunRepository payrollRunRepository;

    @Autowired
    private PayrollEntryRepository payrollEntryRepository;

    @Autowired
    private PayrollEntryComponentRepository payrollEntryComponentRepository;

    @Autowired
    private PayrollEntryErrorRepository payrollEntryErrorRepository;

    @Autowired
    private EmployeeProfileRepository employeeProfileRepository;

    @Autowired
    private EmployeeSalaryStructureRepository salaryStructureRepository;

    @Autowired
    private SalaryComponentRepository salaryComponentRepository;

    @Autowired
    private AttendanceRecordRepository attendanceRecordRepository;

    @Autowired
    private HolidayRepository holidayRepository;

    @Autowired
    private LeaveApplicationRepository leaveApplicationRepository;

    @Autowired
    private ReimbursementRepository reimbursementRepository;

    @Autowired
    private EmployeeLoanRepository employeeLoanRepository;

    @Autowired
    private LoanRepaymentRepository loanRepaymentRepository;

    @Autowired
    private EmployeeBankDetailRepository bankDetailRepository;

    @Autowired
    private TaxRegimeFactory taxRegimeFactory;

    @Autowired
    private TaxConfigurationRepository taxConfigurationRepository;

    @Autowired
    private TaxDeclarationRepository taxDeclarationRepository;

    @Autowired
    private TaxComputationRepository taxComputationRepository;

    /**
     * Everything one employee's calculation produced, held in memory until the
     * calculation SUCCEEDED — nothing (loan balances included) is mutated
     * before persistence, so a failed employee leaves no partial state behind.
     */
    private static class EntryBundle {
        PayrollEntry entry;
        List<PayrollEntryComponent> components = new ArrayList<>();
        List<LoanRepayment> repayments = new ArrayList<>();
        Map<EmployeeLoan, BigDecimal> loanNewBalances = new LinkedHashMap<>();
        List<Reimbursement> reimbursements = new ArrayList<>();
        TaxComputation taxComputation;
    }

    /**
     * Processes a payroll run. The run is row-locked for the duration so two
     * concurrent calls serialize; a failure rolls the whole transaction back,
     * leaving the run in DRAFT exactly as before the call. Per-employee
     * failures do NOT fail the run — they are recorded as
     * {@link PayrollEntryError} rows and surfaced in the response message.
     */
    @Transactional
    public String processPayroll(String payrollRunId, String instituteId, String processedByUserId) {
        PayrollRun run = payrollRunRepository.findByIdAndInstituteIdForUpdate(payrollRunId, instituteId)
                .orElseThrow(() -> new VacademyException("Payroll run not found"));

        if (!PayrollStatus.DRAFT.name().equals(run.getStatus())) {
            throw new VacademyException("Payroll run must be in DRAFT status to process. Current status: " + run.getStatus());
        }

        run.setStatus(PayrollStatus.PROCESSING.name());
        run.setProcessedBy(processedByUserId);
        payrollRunRepository.save(run);

        // Re-processing after reject/failure: reverse loan/reimbursement side
        // effects and delete prior entries, components, tax computations, errors.
        reverseAndDeleteEntries(payrollRunId);

        List<String> activeStatuses = Arrays.asList("ACTIVE", "PROBATION", "NOTICE_PERIOD");
        List<EmployeeProfile> employees = employeeProfileRepository.findActiveEmployees(
                run.getInstituteId(), activeStatuses);

        if (employees.isEmpty()) {
            throw new VacademyException("No active employees found for the institute");
        }

        YearMonth yearMonth = YearMonth.of(run.getYear(), run.getMonth());
        LocalDate monthStart = yearMonth.atDay(1);
        LocalDate monthEnd = yearMonth.atEndOfMonth();

        // Hoisted per-run context (was fetched per-employee before).
        TaxContext taxContext = resolveTaxContext(run);
        Set<LocalDate> weekdayHolidayDates = resolveWeekdayHolidays(run.getInstituteId(), monthStart, monthEnd);

        BigDecimal totalGross = BigDecimal.ZERO;
        BigDecimal totalDeductions = BigDecimal.ZERO;
        BigDecimal totalNetPay = BigDecimal.ZERO;
        BigDecimal totalEmployerCost = BigDecimal.ZERO;
        int processedCount = 0;
        List<PayrollEntryError> errors = new ArrayList<>();

        for (EmployeeProfile employee : employees) {
            try {
                EntryBundle bundle = calculateEmployeePayroll(
                        run, employee, monthStart, monthEnd, yearMonth, weekdayHolidayDates, taxContext);
                if (bundle == null) {
                    continue; // no salary structure — deliberately skipped, not an error
                }
                persistBundle(bundle);
                PayrollEntry entry = bundle.entry;
                totalGross = totalGross.add(entry.getGrossSalary());
                totalDeductions = totalDeductions.add(
                        entry.getTotalDeductions() != null ? entry.getTotalDeductions() : BigDecimal.ZERO);
                totalNetPay = totalNetPay.add(entry.getNetPay());
                totalEmployerCost = totalEmployerCost.add(
                        entry.getTotalEmployerContributions() != null
                                ? entry.getGrossSalary().add(entry.getTotalEmployerContributions())
                                : entry.getGrossSalary());
                processedCount++;
            } catch (Exception e) {
                log.error("Payroll {}: entry calculation failed for employee {} ({})",
                        payrollRunId, employee.getId(), employee.getEmployeeCode(), e);
                PayrollEntryError error = new PayrollEntryError();
                error.setPayrollRunId(payrollRunId);
                error.setEmployeeId(employee.getId());
                error.setErrorStage("CALCULATION");
                error.setErrorMessage(e.getMessage());
                errors.add(error);
            }
        }

        if (!errors.isEmpty()) {
            payrollEntryErrorRepository.saveAll(errors);
        }

        run.setTotalEmployees(processedCount);
        run.setTotalGross(totalGross);
        run.setTotalDeductions(totalDeductions);
        run.setTotalNetPay(totalNetPay);
        run.setTotalEmployerCost(totalEmployerCost);
        run.setStatus(PayrollStatus.PROCESSED.name());
        run.setProcessedAt(LocalDateTime.now());
        payrollRunRepository.save(run);

        if (!errors.isEmpty()) {
            return run.getId() + " (processed " + processedCount + " employees, "
                    + errors.size() + " failed — see run errors)";
        }
        return run.getId();
    }

    /**
     * Reverses all financial side effects of a run's entries and deletes them:
     * loan balances restored (CLOSED loans reopened), reimbursements unlinked,
     * loan repayments / entry components / tax computations / error rows
     * deleted. Used before reprocessing, on reject (PROCESSED -> DRAFT), and on
     * cancel — so a cancelled run no longer eats EMIs and reimbursements.
     */
    @Transactional
    public void reverseAndDeleteEntries(String payrollRunId) {
        List<PayrollEntry> existingEntries = payrollEntryRepository
                .findByPayrollRunIdOrderByEmployeeEmployeeCodeAsc(payrollRunId);

        PayrollRun run = payrollRunRepository.findById(payrollRunId).orElse(null);

        for (PayrollEntry entry : existingEntries) {
            String entryId = entry.getId();

            List<Reimbursement> linkedReimbursements = reimbursementRepository.findByPayrollEntryId(entryId);
            for (Reimbursement reimb : linkedReimbursements) {
                reimb.setPayrollEntry(null);
                reimbursementRepository.save(reimb);
            }

            List<LoanRepayment> linkedRepayments = loanRepaymentRepository.findByPayrollEntryId(entryId);
            for (LoanRepayment repayment : linkedRepayments) {
                EmployeeLoan loan = repayment.getLoan();
                if (loan != null) {
                    BigDecimal currentBalance = loan.getBalanceAmount() != null ? loan.getBalanceAmount() : BigDecimal.ZERO;
                    loan.setBalanceAmount(currentBalance.add(repayment.getAmount()));
                    if ("CLOSED".equals(loan.getStatus())) {
                        loan.setStatus("ACTIVE");
                    }
                    employeeLoanRepository.save(loan);
                }
            }

            loanRepaymentRepository.deleteByPayrollEntryId(entryId);
            payrollEntryComponentRepository.deleteByPayrollEntryId(entryId);

            if (run != null && entry.getEmployee() != null) {
                taxComputationRepository.deleteByEmployee_IdAndMonthAndYear(
                        entry.getEmployee().getId(), run.getMonth(), run.getYear());
            }
        }

        if (!existingEntries.isEmpty()) {
            payrollEntryRepository.deleteAll(existingEntries);
        }
        payrollEntryErrorRepository.deleteByPayrollRunId(payrollRunId);
    }

    // ------------------------------------------------------------------
    // Per-run context
    // ------------------------------------------------------------------

    private static class TaxContext {
        TaxConfiguration config;
        TaxRegimeEngine engine;
        SalaryComponent tdsComponent;
        String financialYear;
    }

    /**
     * Resolves tax config + engine once per run. If a tax configuration exists
     * but no engine supports its country, the run FAILS loudly — silently
     * paying every employee with zero withholding is never acceptable.
     */
    private TaxContext resolveTaxContext(PayrollRun run) {
        List<TaxConfiguration> configs = taxConfigurationRepository
                .findAllByInstituteIdAndStatus(run.getInstituteId(), "ACTIVE");
        if (configs.isEmpty()) {
            configs = taxConfigurationRepository.findAllByInstituteId(run.getInstituteId());
        }
        if (configs.isEmpty()) {
            return null; // institute has not configured tax — TDS simply not computed
        }

        TaxContext ctx = new TaxContext();
        ctx.config = configs.get(0);
        try {
            ctx.engine = taxRegimeFactory.getEngine(ctx.config.getCountryCode());
        } catch (Exception e) {
            throw new VacademyException("Tax is configured for country " + ctx.config.getCountryCode()
                    + " but no tax engine supports it: " + e.getMessage());
        }
        ctx.financialYear = getFinancialYear(run.getMonth(), run.getYear());
        ctx.tdsComponent = getOrCreateTdsComponent(run.getInstituteId());
        return ctx;
    }

    /** V144 requires component_id NOT NULL — TDS rows need a real system component. */
    private SalaryComponent getOrCreateTdsComponent(String instituteId) {
        return salaryComponentRepository.findByInstituteIdAndCode(instituteId, TDS_COMPONENT_CODE)
                .orElseGet(() -> {
                    SalaryComponent tds = new SalaryComponent();
                    tds.setInstituteId(instituteId);
                    tds.setName("Income Tax (TDS)");
                    tds.setCode(TDS_COMPONENT_CODE);
                    tds.setType(ComponentType.DEDUCTION.name());
                    tds.setCategory("STATUTORY");
                    tds.setIsTaxable(false);
                    tds.setIsStatutory(true);
                    tds.setIsActive(true);
                    tds.setDisplayOrder(100);
                    tds.setDescription("System component: income tax deducted at source");
                    return salaryComponentRepository.save(tds);
                });
    }

    private Set<LocalDate> resolveWeekdayHolidays(String instituteId, LocalDate monthStart, LocalDate monthEnd) {
        // BUG 1 FIX (kept): only weekday holidays count — weekend holidays are
        // already excluded via the weekend subtraction.
        List<Holiday> mandatoryHolidays = holidayRepository.findByInstituteIdAndDateRange(
                instituteId, monthStart, monthEnd);
        return mandatoryHolidays.stream()
                .filter(h -> h.getIsOptional() == null || !h.getIsOptional())
                .filter(h -> {
                    DayOfWeek dow = h.getDate().getDayOfWeek();
                    return dow != DayOfWeek.SATURDAY && dow != DayOfWeek.SUNDAY;
                })
                .map(Holiday::getDate)
                .collect(Collectors.toSet());
    }

    // ------------------------------------------------------------------
    // Per-employee calculation (no persistence, no side effects)
    // ------------------------------------------------------------------

    private EntryBundle calculateEmployeePayroll(PayrollRun run, EmployeeProfile employee,
                                                 LocalDate monthStart, LocalDate monthEnd,
                                                 YearMonth yearMonth,
                                                 Set<LocalDate> weekdayHolidayDates,
                                                 TaxContext taxContext) {
        // a. Active salary structure with components
        EmployeeSalaryStructure salaryStructure = salaryStructureRepository
                .findFirstByEmployee_IdAndStatusOrderByEffectiveFromDesc(employee.getId(), "ACTIVE")
                .orElse(null);

        if (salaryStructure == null) {
            return null; // skip employees without a salary structure
        }

        // b. Attendance for the month
        int totalCalendarDays = yearMonth.lengthOfMonth();

        int weekends = 0;
        for (LocalDate date = monthStart; !date.isAfter(monthEnd); date = date.plusDays(1)) {
            DayOfWeek dayOfWeek = date.getDayOfWeek();
            if (dayOfWeek == DayOfWeek.SATURDAY || dayOfWeek == DayOfWeek.SUNDAY) {
                weekends++;
            }
        }

        int daysHoliday = weekdayHolidayDates.size();

        int totalWorkingDays = totalCalendarDays - weekends - daysHoliday;
        if (totalWorkingDays <= 0) {
            totalWorkingDays = 1; // prevent division by zero
        }

        long presentCount = attendanceRecordRepository.countByEmployeeAndDateRangeAndStatus(
                employee.getId(), monthStart, monthEnd, "PRESENT");
        long halfDayCount = attendanceRecordRepository.countByEmployeeAndDateRangeAndStatus(
                employee.getId(), monthStart, monthEnd, "HALF_DAY");

        // BUG 4 FIX (kept): no attendance records at all -> assume full attendance.
        List<AttendanceRecord> allAttendanceRecords = attendanceRecordRepository
                .findByEmployeeIdAndAttendanceDateBetweenOrderByAttendanceDateAsc(
                        employee.getId(), monthStart, monthEnd);
        boolean hasAttendanceRecords = !allAttendanceRecords.isEmpty();

        // Approved leaves in the month
        List<LeaveApplication> approvedLeaves = leaveApplicationRepository.findApprovedLeavesInRange(
                employee.getId(), monthStart, monthEnd);

        BigDecimal paidLeaveDays = BigDecimal.ZERO;
        BigDecimal unpaidLeaveDays = BigDecimal.ZERO;
        BigDecimal totalLeaveDays = BigDecimal.ZERO;

        for (LeaveApplication leave : approvedLeaves) {
            LocalDate leaveStart = leave.getFromDate().isBefore(monthStart) ? monthStart : leave.getFromDate();
            LocalDate leaveEnd = leave.getToDate().isAfter(monthEnd) ? monthEnd : leave.getToDate();

            if (leave.getIsHalfDay() != null && leave.getIsHalfDay()) {
                DayOfWeek dow = leaveStart.getDayOfWeek();
                boolean isWorkingDay = dow != DayOfWeek.SATURDAY && dow != DayOfWeek.SUNDAY
                        && !weekdayHolidayDates.contains(leaveStart);
                if (isWorkingDay) {
                    BigDecimal halfDay = new BigDecimal("0.5");
                    totalLeaveDays = totalLeaveDays.add(halfDay);

                    boolean isPaid = leave.getLeaveType() != null
                            && leave.getLeaveType().getIsPaid() != null
                            && leave.getLeaveType().getIsPaid();
                    if (isPaid) {
                        paidLeaveDays = paidLeaveDays.add(halfDay);
                    } else {
                        unpaidLeaveDays = unpaidLeaveDays.add(halfDay);
                    }
                }
            } else {
                long leaveDaysInMonth = leaveStart.datesUntil(leaveEnd.plusDays(1))
                        .filter(d -> {
                            DayOfWeek dow = d.getDayOfWeek();
                            return dow != DayOfWeek.SATURDAY && dow != DayOfWeek.SUNDAY
                                    && !weekdayHolidayDates.contains(d);
                        })
                        .count();
                BigDecimal daysInMonth = new BigDecimal(leaveDaysInMonth);
                totalLeaveDays = totalLeaveDays.add(daysInMonth);

                boolean isPaid = leave.getLeaveType() != null
                        && leave.getLeaveType().getIsPaid() != null
                        && leave.getLeaveType().getIsPaid();
                if (isPaid) {
                    paidLeaveDays = paidLeaveDays.add(daysInMonth);
                } else {
                    unpaidLeaveDays = unpaidLeaveDays.add(daysInMonth);
                }
            }
        }

        BigDecimal daysPresent;
        BigDecimal daysAbsent;

        if (hasAttendanceRecords) {
            daysPresent = new BigDecimal(presentCount)
                    .add(new BigDecimal(halfDayCount).multiply(new BigDecimal("0.5")));
            daysAbsent = new BigDecimal(totalWorkingDays)
                    .subtract(daysPresent)
                    .subtract(totalLeaveDays);
        } else {
            daysPresent = new BigDecimal(totalWorkingDays).subtract(totalLeaveDays);
            daysAbsent = BigDecimal.ZERO;
        }

        if (daysAbsent.compareTo(BigDecimal.ZERO) < 0) {
            daysAbsent = BigDecimal.ZERO;
        }

        BigDecimal effectivePaidDays = daysPresent.add(paidLeaveDays);

        // c. Pro-rate salary based on attendance
        BigDecimal grossMonthly = salaryStructure.getGrossMonthly();
        if (grossMonthly == null) {
            grossMonthly = salaryStructure.getCtcMonthly() != null ? salaryStructure.getCtcMonthly() : BigDecimal.ZERO;
        }

        BigDecimal proRateFactor;
        BigDecimal totalWorkingDaysBD = new BigDecimal(totalWorkingDays);

        if (effectivePaidDays.compareTo(totalWorkingDaysBD) >= 0) {
            proRateFactor = BigDecimal.ONE;
        } else {
            proRateFactor = effectivePaidDays.divide(totalWorkingDaysBD, 6, RoundingMode.HALF_UP);
        }

        BigDecimal grossForMonth = grossMonthly.multiply(proRateFactor).setScale(2, RoundingMode.HALF_UP);

        // d. Components proportionally
        EntryBundle bundle = new EntryBundle();
        BigDecimal totalEarnings = BigDecimal.ZERO;
        BigDecimal totalDeductionsAmount = BigDecimal.ZERO;
        BigDecimal totalEmployerContributions = BigDecimal.ZERO;

        if (salaryStructure.getComponents() != null) {
            for (EmployeeSalaryComponent salComp : salaryStructure.getComponents()) {
                BigDecimal componentAmount = salComp.getMonthlyAmount()
                        .multiply(proRateFactor)
                        .setScale(2, RoundingMode.HALF_UP);

                PayrollEntryComponent entryComp = new PayrollEntryComponent();
                entryComp.setComponent(salComp.getComponent());
                entryComp.setComponentType(salComp.getComponent().getType());
                entryComp.setAmount(componentAmount);
                bundle.components.add(entryComp);

                String compType = salComp.getComponent().getType();
                if (ComponentType.EARNING.name().equals(compType)) {
                    totalEarnings = totalEarnings.add(componentAmount);
                } else if (ComponentType.DEDUCTION.name().equals(compType)) {
                    totalDeductionsAmount = totalDeductionsAmount.add(componentAmount);
                } else if (ComponentType.EMPLOYER_CONTRIBUTION.name().equals(compType)) {
                    totalEmployerContributions = totalEmployerContributions.add(componentAmount);
                }
            }
        }

        // --- Tax: TDS via the per-run engine. A failure here fails THIS employee
        // (recorded as an error row) — never silently paid with zero withholding.
        BigDecimal tdsAmount = BigDecimal.ZERO;
        if (taxContext != null) {
            Map<String, Object> declarations = new HashMap<>();
            Optional<TaxDeclaration> declOpt = taxDeclarationRepository.findByEmployee_IdAndFinancialYear(
                    employee.getId(), taxContext.financialYear);
            if (declOpt.isPresent() && declOpt.get().getDeclarations() != null) {
                declarations = declOpt.get().getDeclarations();
            }

            // NOTE: annualizing the attendance-pro-rated month under-projects tax
            // for LOP months; replaced by YTD true-up in the Wave 2 tax rebuild.
            BigDecimal projectedAnnualIncome = grossForMonth.multiply(new BigDecimal("12"));

            Map<String, Object> taxRules = taxContext.config.getTaxRules() != null
                    ? taxContext.config.getTaxRules() : new HashMap<>();
            tdsAmount = taxContext.engine.calculateMonthlyTax(projectedAnnualIncome, declarations, taxRules);

            if (tdsAmount != null && tdsAmount.compareTo(BigDecimal.ZERO) > 0) {
                totalDeductionsAmount = totalDeductionsAmount.add(tdsAmount);

                PayrollEntryComponent tdsComponent = new PayrollEntryComponent();
                tdsComponent.setComponent(taxContext.tdsComponent);
                tdsComponent.setComponentType(ComponentType.DEDUCTION.name());
                tdsComponent.setAmount(tdsAmount);
                bundle.components.add(tdsComponent);
            } else {
                tdsAmount = BigDecimal.ZERO;
            }

            BigDecimal total80C = BigDecimal.ZERO;
            if (declOpt.isPresent() && declOpt.get().getDeclarations() != null) {
                Map<String, Object> rawDecl = declOpt.get().getDeclarations();
                for (String key : new String[]{"section_80c", "80c", "ppf", "elss", "life_insurance",
                        "nsc", "tuition_fees", "fixed_deposit_5yr", "sukanya_samriddhi", "employee_pf_contribution"}) {
                    Object val = rawDecl.get(key);
                    if (val instanceof Number) {
                        total80C = total80C.add(new BigDecimal(val.toString()));
                    }
                }
            }

            // Upsert (V200 unique on employee+fy+month+year) instead of appending.
            TaxComputation computation = taxComputationRepository
                    .findByEmployee_IdAndFinancialYearAndMonthAndYear(
                            employee.getId(), taxContext.financialYear, run.getMonth(), run.getYear())
                    .orElseGet(TaxComputation::new);
            computation.setEmployee(employee);
            computation.setFinancialYear(taxContext.financialYear);
            computation.setMonth(run.getMonth());
            computation.setYear(run.getYear());
            computation.setProjectedAnnualIncome(projectedAnnualIncome);
            computation.setProjectedAnnualTax(tdsAmount.multiply(new BigDecimal("12")));
            computation.setProjectedMonthlyTax(tdsAmount);
            computation.setActualIncomeTillDate(grossForMonth);
            computation.setActualTaxDeducted(tdsAmount);
            computation.setTotalDeductions80c(total80C);
            bundle.taxComputation = computation;
        }

        // e. Approved unpaid reimbursements
        List<Reimbursement> unpaidReimbursements = reimbursementRepository.findApprovedUnpaid(employee.getId());
        BigDecimal reimbursementTotal = BigDecimal.ZERO;
        for (Reimbursement reimb : unpaidReimbursements) {
            reimbursementTotal = reimbursementTotal.add(reimb.getAmount());
        }
        bundle.reimbursements.addAll(unpaidReimbursements);

        // f. Loan EMIs — planned only; balances are mutated at persist time,
        // so a later failure in this method leaves loans untouched.
        List<EmployeeLoan> activeLoans = employeeLoanRepository.findActiveLoans(employee.getId());
        BigDecimal loanDeduction = BigDecimal.ZERO;

        for (EmployeeLoan loan : activeLoans) {
            BigDecimal emi = loan.getEmiAmount();
            BigDecimal balance = loan.getBalanceAmount() != null ? loan.getBalanceAmount() : BigDecimal.ZERO;

            if (balance.compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal deductAmount = emi.min(balance);
                loanDeduction = loanDeduction.add(deductAmount);

                LoanRepayment repayment = new LoanRepayment();
                repayment.setLoan(loan);
                repayment.setAmount(deductAmount);
                repayment.setRepaymentDate(LocalDate.now());
                repayment.setMonth(run.getMonth());
                repayment.setYear(run.getYear());
                repayment.setBalanceAfter(balance.subtract(deductAmount));
                bundle.repayments.add(repayment);
                bundle.loanNewBalances.put(loan, balance.subtract(deductAmount));
            }
        }

        // Overtime (BUG 5 FIX kept)
        BigDecimal overtimeHours = BigDecimal.ZERO;
        for (AttendanceRecord record : allAttendanceRecords) {
            if (record.getOvertimeHours() != null) {
                overtimeHours = overtimeHours.add(record.getOvertimeHours());
            }
        }

        BigDecimal overtimePay = BigDecimal.ZERO;
        if (overtimeHours.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal hourlyRate = grossMonthly
                    .divide(totalWorkingDaysBD, 6, RoundingMode.HALF_UP)
                    .divide(new BigDecimal("8"), 6, RoundingMode.HALF_UP);
            overtimePay = hourlyRate
                    .multiply(new BigDecimal("1.5"))
                    .multiply(overtimeHours)
                    .setScale(2, RoundingMode.HALF_UP);
        }

        // g. Net pay
        BigDecimal otherEarnings = overtimePay;
        BigDecimal netPay = totalEarnings
                .add(reimbursementTotal)
                .add(otherEarnings)
                .subtract(totalDeductionsAmount)
                .subtract(loanDeduction);

        if (netPay.compareTo(BigDecimal.ZERO) < 0) {
            netPay = BigDecimal.ZERO;
        }

        // h. Entry
        PayrollEntry entry = new PayrollEntry();
        entry.setPayrollRun(run);
        entry.setEmployee(employee);
        entry.setSalaryStructure(salaryStructure);
        entry.setGrossSalary(grossForMonth);
        entry.setTotalEarnings(totalEarnings);
        entry.setTotalDeductions(totalDeductionsAmount);
        entry.setTotalEmployerContributions(totalEmployerContributions);
        entry.setNetPay(netPay);
        entry.setTotalWorkingDays(totalWorkingDays);
        entry.setDaysPresent(daysPresent);
        entry.setDaysAbsent(daysAbsent);
        entry.setDaysOnLeave(totalLeaveDays);
        entry.setDaysHoliday(daysHoliday);
        entry.setOvertimeHours(overtimeHours);
        entry.setArrears(BigDecimal.ZERO);
        entry.setReimbursements(reimbursementTotal);
        entry.setLoanDeduction(loanDeduction);
        entry.setOtherEarnings(otherEarnings);
        entry.setOtherDeductions(BigDecimal.ZERO);
        entry.setStatus(PayrollEntryStatus.CALCULATED.name());

        EmployeeBankDetail primaryBank = bankDetailRepository.findByEmployeeIdAndIsPrimaryTrue(employee.getId())
                .orElse(null);
        if (primaryBank != null) {
            entry.setBankAccount(primaryBank);
        }

        bundle.entry = entry;
        return bundle;
    }

    /** Persists one employee's bundle; only now are loan balances actually mutated. */
    private void persistBundle(EntryBundle bundle) {
        PayrollEntry entry = payrollEntryRepository.save(bundle.entry);

        for (PayrollEntryComponent entryComp : bundle.components) {
            entryComp.setPayrollEntry(entry);
            payrollEntryComponentRepository.save(entryComp);
        }

        for (LoanRepayment repayment : bundle.repayments) {
            repayment.setPayrollEntry(entry);
            loanRepaymentRepository.save(repayment);
        }

        for (Map.Entry<EmployeeLoan, BigDecimal> loanUpdate : bundle.loanNewBalances.entrySet()) {
            EmployeeLoan loan = loanUpdate.getKey();
            BigDecimal newBalance = loanUpdate.getValue();
            loan.setBalanceAmount(newBalance);
            if (newBalance.compareTo(BigDecimal.ZERO) <= 0) {
                loan.setStatus("CLOSED");
                loan.setBalanceAmount(BigDecimal.ZERO);
            }
            employeeLoanRepository.save(loan);
        }

        for (Reimbursement reimb : bundle.reimbursements) {
            reimb.setPayrollEntry(entry);
            reimbursementRepository.save(reimb);
        }

        if (bundle.taxComputation != null) {
            taxComputationRepository.save(bundle.taxComputation);
        }
    }

    /**
     * Indian financial year string (April–March): month=6, year=2025 -> "2025-26".
     * NOTE: honors India only; Wave 2 reads TaxConfiguration.financialYearStartMonth.
     */
    private String getFinancialYear(int month, int year) {
        if (month >= 4) {
            return year + "-" + ((year + 1) % 100);
        } else {
            return (year - 1) + "-" + (year % 100);
        }
    }
}

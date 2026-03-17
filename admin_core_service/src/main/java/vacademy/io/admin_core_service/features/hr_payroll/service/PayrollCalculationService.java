package vacademy.io.admin_core_service.features.hr_payroll.service;

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
import vacademy.io.admin_core_service.features.hr_salary.enums.ComponentType;
import vacademy.io.admin_core_service.features.hr_salary.repository.EmployeeSalaryStructureRepository;
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

    @Autowired
    private PayrollRunRepository payrollRunRepository;

    @Autowired
    private PayrollEntryRepository payrollEntryRepository;

    @Autowired
    private PayrollEntryComponentRepository payrollEntryComponentRepository;

    @Autowired
    private EmployeeProfileRepository employeeProfileRepository;

    @Autowired
    private EmployeeSalaryStructureRepository salaryStructureRepository;

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

    @Transactional
    public String processPayroll(String payrollRunId, String processedByUserId) {
        // 1. Get PayrollRun and validate status
        PayrollRun run = payrollRunRepository.findById(payrollRunId)
                .orElseThrow(() -> new VacademyException("Payroll run not found"));

        if (!PayrollStatus.DRAFT.name().equals(run.getStatus())) {
            throw new VacademyException("Payroll run must be in DRAFT status to process. Current status: " + run.getStatus());
        }

        // 2. Set status to PROCESSING
        run.setStatus(PayrollStatus.PROCESSING.name());
        run.setProcessedBy(processedByUserId);
        payrollRunRepository.save(run);

        try {
            // BUG 3 FIX: Delete existing entries for this payroll run before creating new ones.
            // This prevents duplicate entries if re-processing after a previous failure.
            cleanupExistingEntries(payrollRunId);

            // 3. Get all ACTIVE employees for the institute
            List<String> activeStatuses = Arrays.asList("ACTIVE", "PROBATION");
            List<EmployeeProfile> employees = employeeProfileRepository.findActiveEmployees(
                    run.getInstituteId(), activeStatuses);

            if (employees.isEmpty()) {
                throw new VacademyException("No active employees found for the institute");
            }

            // Date range for the payroll month
            YearMonth yearMonth = YearMonth.of(run.getYear(), run.getMonth());
            LocalDate monthStart = yearMonth.atDay(1);
            LocalDate monthEnd = yearMonth.atEndOfMonth();

            BigDecimal totalGross = BigDecimal.ZERO;
            BigDecimal totalDeductions = BigDecimal.ZERO;
            BigDecimal totalNetPay = BigDecimal.ZERO;
            BigDecimal totalEmployerCost = BigDecimal.ZERO;
            int processedCount = 0;

            // 4. For each employee, calculate payroll
            for (EmployeeProfile employee : employees) {
                try {
                    PayrollEntry entry = calculateEmployeePayroll(run, employee, monthStart, monthEnd, yearMonth);
                    if (entry != null) {
                        totalGross = totalGross.add(entry.getGrossSalary());
                        totalDeductions = totalDeductions.add(
                                entry.getTotalDeductions() != null ? entry.getTotalDeductions() : BigDecimal.ZERO);
                        totalNetPay = totalNetPay.add(entry.getNetPay());
                        totalEmployerCost = totalEmployerCost.add(
                                entry.getTotalEmployerContributions() != null
                                        ? entry.getGrossSalary().add(entry.getTotalEmployerContributions())
                                        : entry.getGrossSalary());
                        processedCount++;
                    }
                } catch (Exception e) {
                    // Log error for this employee but continue processing others
                    // In production, consider storing these errors in a separate table
                }
            }

            // 5. Update PayrollRun totals
            run.setTotalEmployees(processedCount);
            run.setTotalGross(totalGross);
            run.setTotalDeductions(totalDeductions);
            run.setTotalNetPay(totalNetPay);
            run.setTotalEmployerCost(totalEmployerCost);
            run.setStatus(PayrollStatus.PROCESSED.name());
            run.setProcessedAt(LocalDateTime.now());
            payrollRunRepository.save(run);

            return run.getId();

        } catch (Exception e) {
            // If processing fails, revert status to DRAFT
            run.setStatus(PayrollStatus.DRAFT.name());
            run.setProcessedBy(null);
            payrollRunRepository.save(run);
            throw new VacademyException("Payroll processing failed: " + e.getMessage());
        }
    }

    /**
     * BUG 3 FIX: Cleanup existing payroll entries and their related records
     * for a given payroll run. This ensures re-processing doesn't create duplicates.
     */
    private void cleanupExistingEntries(String payrollRunId) {
        List<PayrollEntry> existingEntries = payrollEntryRepository
                .findByPayrollRunIdOrderByEmployeeEmployeeCodeAsc(payrollRunId);

        for (PayrollEntry entry : existingEntries) {
            String entryId = entry.getId();

            // Unlink reimbursements (set payrollEntry to null so they become available again)
            List<Reimbursement> linkedReimbursements = reimbursementRepository.findByPayrollEntryId(entryId);
            for (Reimbursement reimb : linkedReimbursements) {
                reimb.setPayrollEntry(null);
                reimbursementRepository.save(reimb);
            }

            // Reverse loan repayments: restore loan balances and statuses
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

            // Delete loan repayments for this entry
            loanRepaymentRepository.deleteByPayrollEntryId(entryId);

            // Delete entry components
            payrollEntryComponentRepository.deleteByPayrollEntryId(entryId);
        }

        // Delete the entries themselves
        if (!existingEntries.isEmpty()) {
            payrollEntryRepository.deleteAll(existingEntries);
        }
    }

    private PayrollEntry calculateEmployeePayroll(PayrollRun run, EmployeeProfile employee,
                                                    LocalDate monthStart, LocalDate monthEnd,
                                                    YearMonth yearMonth) {
        // a. Get active salary structure with components
        EmployeeSalaryStructure salaryStructure = salaryStructureRepository.findFirstByEmployee_IdAndStatusOrderByEffectiveFromDesc(employee.getId(), "ACTIVE")
                .orElse(null);

        if (salaryStructure == null) {
            // Skip employees without a salary structure
            return null;
        }

        // b. Calculate attendance for the month
        int totalCalendarDays = yearMonth.lengthOfMonth();

        // Count weekends (Saturdays and Sundays)
        int weekends = 0;
        for (LocalDate date = monthStart; !date.isAfter(monthEnd); date = date.plusDays(1)) {
            DayOfWeek dayOfWeek = date.getDayOfWeek();
            if (dayOfWeek == DayOfWeek.SATURDAY || dayOfWeek == DayOfWeek.SUNDAY) {
                weekends++;
            }
        }

        // BUG 1 FIX: Fetch holiday list and only count holidays that fall on weekdays.
        // Previously, countMandatoryHolidays counted ALL holidays including those on weekends,
        // leading to double-subtraction since weekends were already excluded.
        List<Holiday> mandatoryHolidays = holidayRepository.findByInstituteIdAndDateRange(
                run.getInstituteId(), monthStart, monthEnd);

        // Filter: only mandatory holidays that fall on weekdays
        Set<LocalDate> weekdayHolidayDates = mandatoryHolidays.stream()
                .filter(h -> h.getIsOptional() == null || !h.getIsOptional())
                .filter(h -> {
                    DayOfWeek dow = h.getDate().getDayOfWeek();
                    return dow != DayOfWeek.SATURDAY && dow != DayOfWeek.SUNDAY;
                })
                .map(Holiday::getDate)
                .collect(Collectors.toSet());

        int daysHoliday = weekdayHolidayDates.size();

        // Total working days = calendar days - weekends - weekday holidays
        int totalWorkingDays = totalCalendarDays - weekends - daysHoliday;
        if (totalWorkingDays <= 0) {
            totalWorkingDays = 1; // Prevent division by zero
        }

        // Count present days from attendance records
        long presentCount = attendanceRecordRepository.countByEmployeeAndDateRangeAndStatus(
                employee.getId(), monthStart, monthEnd, "PRESENT");
        long halfDayCount = attendanceRecordRepository.countByEmployeeAndDateRangeAndStatus(
                employee.getId(), monthStart, monthEnd, "HALF_DAY");

        // BUG 4 FIX: If no attendance records exist at all for the month, assume full attendance.
        // This handles new joiners or employees where attendance tracking hasn't started yet.
        List<AttendanceRecord> allAttendanceRecords = attendanceRecordRepository
                .findByEmployeeIdAndAttendanceDateBetweenOrderByAttendanceDateAsc(
                        employee.getId(), monthStart, monthEnd);
        boolean hasAttendanceRecords = !allAttendanceRecords.isEmpty();

        // Count approved leaves in the month
        List<LeaveApplication> approvedLeaves = leaveApplicationRepository.findApprovedLeavesInRange(
                employee.getId(), monthStart, monthEnd);

        BigDecimal paidLeaveDays = BigDecimal.ZERO;
        BigDecimal unpaidLeaveDays = BigDecimal.ZERO;
        BigDecimal totalLeaveDays = BigDecimal.ZERO;

        for (LeaveApplication leave : approvedLeaves) {
            // Calculate overlapping days between leave period and payroll month
            LocalDate leaveStart = leave.getFromDate().isBefore(monthStart) ? monthStart : leave.getFromDate();
            LocalDate leaveEnd = leave.getToDate().isAfter(monthEnd) ? monthEnd : leave.getToDate();

            // BUG 2 FIX: Only count leave days that fall on weekdays (Mon-Fri) and are not holidays.
            // Previously, all calendar days between leaveStart and leaveEnd were counted,
            // which inflated leave counts by including weekends.
            long leaveDaysInMonth;

            if (leave.getIsHalfDay() != null && leave.getIsHalfDay()) {
                // Half day leave: count as 0.5 only if the day is a working day
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
                // Full day leave: count only weekdays that are not holidays
                final LocalDate finalLeaveEnd = leaveEnd;
                leaveDaysInMonth = leaveStart.datesUntil(finalLeaveEnd.plusDays(1))
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
            // BUG 4 FIX: No attendance records — assume full attendance
            daysPresent = new BigDecimal(totalWorkingDays).subtract(totalLeaveDays);
            daysAbsent = BigDecimal.ZERO;
        }

        // Ensure daysAbsent is not negative
        if (daysAbsent.compareTo(BigDecimal.ZERO) < 0) {
            daysAbsent = BigDecimal.ZERO;
        }

        // Effective paid days = present days + paid leave days
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

        // d. Calculate each component proportionally
        BigDecimal totalEarnings = BigDecimal.ZERO;
        BigDecimal totalDeductionsAmount = BigDecimal.ZERO;
        BigDecimal totalEmployerContributions = BigDecimal.ZERO;

        List<PayrollEntryComponent> entryComponents = new ArrayList<>();

        if (salaryStructure.getComponents() != null) {
            for (EmployeeSalaryComponent salComp : salaryStructure.getComponents()) {
                BigDecimal componentAmount = salComp.getMonthlyAmount()
                        .multiply(proRateFactor)
                        .setScale(2, RoundingMode.HALF_UP);

                PayrollEntryComponent entryComp = new PayrollEntryComponent();
                entryComp.setComponent(salComp.getComponent());
                entryComp.setComponentType(salComp.getComponent().getType());
                entryComp.setAmount(componentAmount);

                entryComponents.add(entryComp);

                // Categorize by component type
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

        // --- Tax Engine Integration: compute TDS (income tax) ---
        BigDecimal tdsAmount = BigDecimal.ZERO;
        Optional<TaxConfiguration> taxConfigOpt = taxConfigurationRepository.findByInstituteId(run.getInstituteId());
        if (taxConfigOpt.isPresent()) {
            TaxConfiguration taxConfig = taxConfigOpt.get();
            try {
                TaxRegimeEngine taxEngine = taxRegimeFactory.getEngine(taxConfig.getCountryCode());

                // Build declarations map from employee's tax declaration for this financial year
                Map<String, Object> declarations = new HashMap<>();
                String financialYear = getFinancialYear(run.getMonth(), run.getYear());
                Optional<TaxDeclaration> declOpt = taxDeclarationRepository.findByEmployee_IdAndFinancialYear(
                        employee.getId(), financialYear);
                if (declOpt.isPresent() && declOpt.get().getDeclarations() != null) {
                    declarations = declOpt.get().getDeclarations();
                }

                // Project annual taxable income from this month's gross
                BigDecimal projectedAnnualIncome = grossForMonth.multiply(new BigDecimal("12"));

                // Calculate monthly TDS using the tax engine
                Map<String, Object> taxRules = taxConfig.getTaxRules() != null ? taxConfig.getTaxRules() : new HashMap<>();
                tdsAmount = taxEngine.calculateMonthlyTax(projectedAnnualIncome, declarations, taxRules);

                // Add TDS as a deduction component
                if (tdsAmount.compareTo(BigDecimal.ZERO) > 0) {
                    totalDeductionsAmount = totalDeductionsAmount.add(tdsAmount);

                    // Create TDS payroll entry component (no linked SalaryComponent -- system-generated)
                    PayrollEntryComponent tdsComponent = new PayrollEntryComponent();
                    tdsComponent.setComponentType("DEDUCTION");
                    tdsComponent.setAmount(tdsAmount);
                    entryComponents.add(tdsComponent);
                }

                // Save tax computation record for audit trail
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

                TaxComputation computation = new TaxComputation();
                computation.setEmployee(employee);
                computation.setFinancialYear(financialYear);
                computation.setMonth(run.getMonth());
                computation.setYear(run.getYear());
                computation.setProjectedAnnualIncome(projectedAnnualIncome);
                computation.setProjectedAnnualTax(tdsAmount.multiply(new BigDecimal("12")));
                computation.setProjectedMonthlyTax(tdsAmount);
                computation.setActualIncomeTillDate(grossForMonth);
                computation.setActualTaxDeducted(tdsAmount);
                computation.setTotalDeductions80c(total80C);
                taxComputationRepository.save(computation);

            } catch (Exception e) {
                // Log but don't fail payroll if tax engine is not configured for this country.
                // Tax will need manual handling in such cases.
            }
        }

        // e. Get approved unpaid reimbursements, add to earnings
        List<Reimbursement> unpaidReimbursements = reimbursementRepository.findApprovedUnpaid(employee.getId());
        BigDecimal reimbursementTotal = BigDecimal.ZERO;
        for (Reimbursement reimb : unpaidReimbursements) {
            reimbursementTotal = reimbursementTotal.add(reimb.getAmount());
        }

        // f. Get active loans, deduct EMI
        List<EmployeeLoan> activeLoans = employeeLoanRepository.findActiveLoans(employee.getId());
        BigDecimal loanDeduction = BigDecimal.ZERO;
        List<LoanRepayment> repayments = new ArrayList<>();

        for (EmployeeLoan loan : activeLoans) {
            BigDecimal emi = loan.getEmiAmount();
            BigDecimal balance = loan.getBalanceAmount() != null ? loan.getBalanceAmount() : BigDecimal.ZERO;

            if (balance.compareTo(BigDecimal.ZERO) > 0) {
                // Deduct the lesser of EMI or remaining balance
                BigDecimal deductAmount = emi.min(balance);
                loanDeduction = loanDeduction.add(deductAmount);

                // Create repayment record
                LoanRepayment repayment = new LoanRepayment();
                repayment.setLoan(loan);
                repayment.setAmount(deductAmount);
                repayment.setRepaymentDate(LocalDate.now());
                repayment.setMonth(run.getMonth());
                repayment.setYear(run.getYear());
                repayment.setBalanceAfter(balance.subtract(deductAmount));
                repayments.add(repayment);

                // Update loan balance
                loan.setBalanceAmount(balance.subtract(deductAmount));
                if (loan.getBalanceAmount().compareTo(BigDecimal.ZERO) <= 0) {
                    loan.setStatus("CLOSED");
                    loan.setBalanceAmount(BigDecimal.ZERO);
                }
                employeeLoanRepository.save(loan);
            }
        }

        // BUG 5 FIX: Calculate overtime pay from overtime hours.
        // Overtime hours are tracked in attendance records but previously had no financial impact.
        // Overtime rate = (grossMonthly / totalWorkingDays / 8) * 1.5 * overtimeHours
        BigDecimal overtimeHours = BigDecimal.ZERO;
        List<AttendanceRecord> attendanceRecords = hasAttendanceRecords ? allAttendanceRecords
                : attendanceRecordRepository.findByEmployeeIdAndAttendanceDateBetweenOrderByAttendanceDateAsc(
                        employee.getId(), monthStart, monthEnd);
        for (AttendanceRecord record : attendanceRecords) {
            if (record.getOvertimeHours() != null) {
                overtimeHours = overtimeHours.add(record.getOvertimeHours());
            }
        }

        BigDecimal overtimePay = BigDecimal.ZERO;
        if (overtimeHours.compareTo(BigDecimal.ZERO) > 0) {
            // Hourly rate = grossMonthly / totalWorkingDays / 8
            // Overtime pay = hourlyRate * 1.5 * overtimeHours
            BigDecimal hourlyRate = grossMonthly
                    .divide(totalWorkingDaysBD, 6, RoundingMode.HALF_UP)
                    .divide(new BigDecimal("8"), 6, RoundingMode.HALF_UP);
            overtimePay = hourlyRate
                    .multiply(new BigDecimal("1.5"))
                    .multiply(overtimeHours)
                    .setScale(2, RoundingMode.HALF_UP);
        }

        // g. Calculate net pay (now includes overtime pay)
        BigDecimal otherEarnings = overtimePay;
        BigDecimal netPay = totalEarnings
                .add(reimbursementTotal)
                .add(otherEarnings)
                .subtract(totalDeductionsAmount)
                .subtract(loanDeduction);

        // Ensure net pay is not negative
        if (netPay.compareTo(BigDecimal.ZERO) < 0) {
            netPay = BigDecimal.ZERO;
        }

        // h. Create PayrollEntry
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

        // i. Set primary bank account
        EmployeeBankDetail primaryBank = bankDetailRepository.findByEmployeeIdAndIsPrimaryTrue(employee.getId())
                .orElse(null);
        if (primaryBank != null) {
            entry.setBankAccount(primaryBank);
        }

        entry = payrollEntryRepository.save(entry);

        // Save entry components
        for (PayrollEntryComponent entryComp : entryComponents) {
            entryComp.setPayrollEntry(entry);
            payrollEntryComponentRepository.save(entryComp);
        }

        // Save loan repayments
        for (LoanRepayment repayment : repayments) {
            repayment.setPayrollEntry(entry);
            loanRepaymentRepository.save(repayment);
        }

        // Mark reimbursements as processed by linking to this payroll entry
        for (Reimbursement reimb : unpaidReimbursements) {
            reimb.setPayrollEntry(entry);
            reimbursementRepository.save(reimb);
        }

        return entry;
    }

    /**
     * Determine the Indian financial year string for a given month and year.
     * Indian financial year runs April to March: e.g. month=6, year=2025 -> "2025-26";
     * month=2, year=2026 -> "2025-26".
     */
    private String getFinancialYear(int month, int year) {
        if (month >= 4) {
            return year + "-" + ((year + 1) % 100);
        } else {
            return (year - 1) + "-" + (year % 100);
        }
    }
}

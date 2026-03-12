package vacademy.io.admin_core_service.features.hr_leave.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.hr_employee.entity.EmployeeProfile;
import vacademy.io.admin_core_service.features.hr_employee.repository.EmployeeProfileRepository;
import vacademy.io.admin_core_service.features.hr_leave.dto.LeaveBalanceAdjustDTO;
import vacademy.io.admin_core_service.features.hr_leave.dto.LeaveBalanceDTO;
import vacademy.io.admin_core_service.features.hr_leave.entity.LeaveBalance;
import vacademy.io.admin_core_service.features.hr_leave.entity.LeavePolicy;
import vacademy.io.admin_core_service.features.hr_leave.entity.LeaveType;
import vacademy.io.admin_core_service.features.hr_leave.repository.LeaveBalanceRepository;
import vacademy.io.admin_core_service.features.hr_leave.repository.LeavePolicyRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class LeaveBalanceService {

    @Autowired
    private LeaveBalanceRepository leaveBalanceRepository;

    @Autowired
    private LeavePolicyRepository leavePolicyRepository;

    @Autowired
    private EmployeeProfileRepository employeeProfileRepository;

    @Transactional(readOnly = true)
    public List<LeaveBalanceDTO> getBalances(String employeeId, Integer year) {
        List<LeaveBalance> balances = leaveBalanceRepository.findByEmployee_IdAndYear(employeeId, year);
        return balances.stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public String adjustBalance(String balanceId, LeaveBalanceAdjustDTO dto) {
        if (dto.getAdjustment() == null) {
            throw new VacademyException("Adjustment amount is required");
        }

        LeaveBalance balance = leaveBalanceRepository.findById(balanceId)
                .orElseThrow(() -> new VacademyException("Leave balance not found"));

        BigDecimal currentAdjustment = balance.getAdjustment() != null ? balance.getAdjustment() : BigDecimal.ZERO;
        balance.setAdjustment(currentAdjustment.add(dto.getAdjustment()));
        leaveBalanceRepository.save(balance);

        return balance.getId();
    }

    /**
     * Monthly accrual process: for each active employee with an active leave policy
     * that has MONTHLY accrual type, find or create the leave balance for the current year
     * and add the accrual amount.
     */
    @Transactional
    public String accrueLeaves(String instituteId) {
        LocalDate today = LocalDate.now();
        int currentYear = today.getYear();

        // Get all active leave policies with MONTHLY accrual for this institute
        List<LeavePolicy> activePolicies = leavePolicyRepository.findActivePolicies(instituteId, today);
        List<LeavePolicy> monthlyPolicies = activePolicies.stream()
                .filter(p -> "MONTHLY".equals(p.getAccrualType()))
                .collect(Collectors.toList());

        if (monthlyPolicies.isEmpty()) {
            return "No monthly accrual policies found";
        }

        // Get all active employees
        List<EmployeeProfile> activeEmployees = employeeProfileRepository.findActiveEmployees(
                instituteId, Arrays.asList("ACTIVE", "PROBATION"));

        int accruedCount = 0;

        for (EmployeeProfile employee : activeEmployees) {
            for (LeavePolicy policy : monthlyPolicies) {
                // Check if the policy is applicable to this employee's employment type
                if (policy.getApplicableEmploymentTypes() != null
                        && !policy.getApplicableEmploymentTypes().isEmpty()
                        && !policy.getApplicableEmploymentTypes().contains(employee.getEmploymentType())) {
                    continue;
                }

                // Check if applicable after days condition is met
                if (policy.getApplicableAfterDays() != null && policy.getApplicableAfterDays() > 0) {
                    long daysSinceJoining = java.time.temporal.ChronoUnit.DAYS.between(
                            employee.getJoinDate(), today);
                    if (daysSinceJoining < policy.getApplicableAfterDays()) {
                        continue;
                    }
                }

                // Find or create leave balance
                Optional<LeaveBalance> existingBalance = leaveBalanceRepository
                        .findByEmployee_IdAndLeaveType_IdAndYear(
                                employee.getId(),
                                policy.getLeaveType().getId(),
                                currentYear);

                LeaveBalance balance;
                if (existingBalance.isPresent()) {
                    balance = existingBalance.get();
                } else {
                    balance = new LeaveBalance();
                    balance.setEmployee(employee);
                    balance.setLeaveType(policy.getLeaveType());
                    balance.setYear(currentYear);
                    balance.setOpeningBalance(BigDecimal.ZERO);
                    balance.setAccrued(BigDecimal.ZERO);
                    balance.setUsed(BigDecimal.ZERO);
                    balance.setAdjustment(BigDecimal.ZERO);
                    balance.setCarriedForward(BigDecimal.ZERO);
                    balance.setEncashed(BigDecimal.ZERO);
                }

                // Add accrual amount
                BigDecimal currentAccrued = balance.getAccrued() != null ? balance.getAccrued() : BigDecimal.ZERO;
                BigDecimal accrualAmount = policy.getAccrualAmount() != null
                        ? policy.getAccrualAmount()
                        : BigDecimal.ZERO;

                // BUG 4 FIX: Idempotency guard — prevent double-accrual in the same month.
                // Expected accrued by end of current month = accrualAmount * currentMonthNumber.
                // If already accrued >= expected, skip this policy for this balance.
                int currentMonth = today.getMonthValue();
                BigDecimal expectedAccruedForMonth = accrualAmount.multiply(new BigDecimal(currentMonth));
                if (currentAccrued.compareTo(expectedAccruedForMonth) >= 0) {
                    continue;
                }

                // Cap total accrued to annual quota
                BigDecimal newAccrued = currentAccrued.add(accrualAmount);
                if (newAccrued.compareTo(policy.getAnnualQuota()) > 0) {
                    newAccrued = policy.getAnnualQuota();
                }

                balance.setAccrued(newAccrued);
                leaveBalanceRepository.save(balance);
                accruedCount++;
            }
        }

        return "Accrual completed for " + accruedCount + " employee-policy combinations";
    }

    /**
     * Year-end process: for each employee's leave balance of the closing year,
     * calculate closing balance and handle carry forward and encashment.
     */
    @Transactional
    public String yearEndProcess(String instituteId, Integer year) {
        int nextYear = year + 1;

        // Get all active employees
        List<EmployeeProfile> activeEmployees = employeeProfileRepository.findActiveEmployees(
                instituteId, Arrays.asList("ACTIVE", "PROBATION"));

        // BUG 5 FIX: Guard against re-running year-end process
        List<String> employeeIds = activeEmployees.stream()
                .map(EmployeeProfile::getId)
                .collect(Collectors.toList());
        if (!employeeIds.isEmpty() && leaveBalanceRepository.existsByEmployeeIdsAndYear(employeeIds, nextYear)) {
            throw new VacademyException("Year-end process already completed for year " + year);
        }

        int processedCount = 0;

        for (EmployeeProfile employee : activeEmployees) {
            List<LeaveBalance> balances = leaveBalanceRepository.findByEmployee_IdAndYear(
                    employee.getId(), year);

            for (LeaveBalance balance : balances) {
                LeaveType leaveType = balance.getLeaveType();
                BigDecimal closingBalance = balance.getClosingBalance();

                if (closingBalance.compareTo(BigDecimal.ZERO) <= 0) {
                    processedCount++;
                    continue;
                }

                BigDecimal carryForwardAmount = BigDecimal.ZERO;
                BigDecimal encashedAmount = BigDecimal.ZERO;

                // Handle carry forward
                if (Boolean.TRUE.equals(leaveType.getIsCarryForward())) {
                    carryForwardAmount = closingBalance;
                    // Cap at max carry forward if specified
                    if (leaveType.getMaxCarryForward() != null && leaveType.getMaxCarryForward() > 0) {
                        BigDecimal maxCF = new BigDecimal(leaveType.getMaxCarryForward());
                        if (carryForwardAmount.compareTo(maxCF) > 0) {
                            BigDecimal excess = carryForwardAmount.subtract(maxCF);
                            carryForwardAmount = maxCF;

                            // If encashable, mark the excess as encashed
                            if (Boolean.TRUE.equals(leaveType.getIsEncashable())) {
                                encashedAmount = excess;
                            }
                        }
                    }
                } else if (Boolean.TRUE.equals(leaveType.getIsEncashable())) {
                    // No carry forward, but encashable: encash entire closing balance
                    encashedAmount = closingBalance;
                }

                // Update encashed amount on closing year's balance
                if (encashedAmount.compareTo(BigDecimal.ZERO) > 0) {
                    BigDecimal currentEncashed = balance.getEncashed() != null
                            ? balance.getEncashed() : BigDecimal.ZERO;
                    balance.setEncashed(currentEncashed.add(encashedAmount));
                    leaveBalanceRepository.save(balance);
                }

                // Create next year's balance with carry forward
                if (carryForwardAmount.compareTo(BigDecimal.ZERO) > 0) {
                    Optional<LeaveBalance> nextYearBalance = leaveBalanceRepository
                            .findByEmployee_IdAndLeaveType_IdAndYear(
                                    employee.getId(),
                                    leaveType.getId(),
                                    nextYear);

                    LeaveBalance newBalance;
                    if (nextYearBalance.isPresent()) {
                        newBalance = nextYearBalance.get();
                        newBalance.setCarriedForward(carryForwardAmount);
                    } else {
                        newBalance = new LeaveBalance();
                        newBalance.setEmployee(employee);
                        newBalance.setLeaveType(leaveType);
                        newBalance.setYear(nextYear);
                        newBalance.setOpeningBalance(BigDecimal.ZERO);
                        newBalance.setAccrued(BigDecimal.ZERO);
                        newBalance.setUsed(BigDecimal.ZERO);
                        newBalance.setAdjustment(BigDecimal.ZERO);
                        newBalance.setCarriedForward(carryForwardAmount);
                        newBalance.setEncashed(BigDecimal.ZERO);
                    }

                    leaveBalanceRepository.save(newBalance);
                }

                processedCount++;
            }
        }

        return "Year-end process completed for " + processedCount + " balance records";
    }

    private LeaveBalanceDTO toDTO(LeaveBalance entity) {
        return LeaveBalanceDTO.builder()
                .id(entity.getId())
                .employeeId(entity.getEmployee().getId())
                .leaveTypeId(entity.getLeaveType().getId())
                .leaveTypeName(entity.getLeaveType().getName())
                .year(entity.getYear())
                .openingBalance(entity.getOpeningBalance())
                .accrued(entity.getAccrued())
                .used(entity.getUsed())
                .adjustment(entity.getAdjustment())
                .carriedForward(entity.getCarriedForward())
                .encashed(entity.getEncashed())
                .closingBalance(entity.getClosingBalance())
                .build();
    }
}

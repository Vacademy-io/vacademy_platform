package vacademy.io.admin_core_service.features.hr_leave.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.hr_employee.entity.EmployeeProfile;
import vacademy.io.admin_core_service.features.hr_employee.repository.EmployeeProfileRepository;
import vacademy.io.admin_core_service.features.hr_leave.dto.CompOffActionDTO;
import vacademy.io.admin_core_service.features.hr_leave.dto.CompOffDTO;
import vacademy.io.admin_core_service.features.hr_leave.entity.CompensatoryOff;
import vacademy.io.admin_core_service.features.hr_leave.entity.LeaveBalance;
import vacademy.io.admin_core_service.features.hr_leave.entity.LeaveType;
import vacademy.io.admin_core_service.features.hr_leave.enums.LeaveStatus;
import vacademy.io.admin_core_service.features.hr_leave.repository.CompensatoryOffRepository;
import vacademy.io.admin_core_service.features.hr_leave.repository.LeaveBalanceRepository;
import vacademy.io.admin_core_service.features.hr_leave.repository.LeaveTypeRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class CompOffService {

    @Autowired
    private CompensatoryOffRepository compensatoryOffRepository;

    @Autowired
    private EmployeeProfileRepository employeeProfileRepository;

    @Autowired
    private LeaveTypeRepository leaveTypeRepository;

    @Autowired
    private LeaveBalanceRepository leaveBalanceRepository;

    @Transactional
    public String requestCompOff(CompOffDTO dto, String instituteId) {
        if (!StringUtils.hasText(dto.getEmployeeId())) {
            throw new VacademyException("Employee ID is required");
        }
        if (dto.getWorkedOnDate() == null) {
            throw new VacademyException("Worked on date is required");
        }
        if (dto.getEarnedDays() == null || dto.getEarnedDays().compareTo(BigDecimal.ZERO) <= 0) {
            throw new VacademyException("Earned days must be greater than zero");
        }

        EmployeeProfile employee = employeeProfileRepository.findById(dto.getEmployeeId())
                .orElseThrow(() -> new VacademyException("Employee not found"));

        CompensatoryOff compOff = new CompensatoryOff();
        compOff.setEmployee(employee);
        compOff.setWorkedOnDate(dto.getWorkedOnDate());
        compOff.setEarnedDays(dto.getEarnedDays());
        compOff.setExpiryDate(dto.getExpiryDate());
        compOff.setUsed(false);
        compOff.setStatus(LeaveStatus.PENDING.name());

        compOff = compensatoryOffRepository.save(compOff);
        return compOff.getId();
    }

    @Transactional
    public String approveRejectCompOff(String id, CompOffActionDTO actionDTO, String approverUserId) {
        CompensatoryOff compOff = compensatoryOffRepository.findById(id)
                .orElseThrow(() -> new VacademyException("Compensatory off request not found"));

        if (!LeaveStatus.PENDING.name().equals(compOff.getStatus())) {
            throw new VacademyException("Only pending compensatory off requests can be approved or rejected");
        }

        if (actionDTO.getApproved() == null) {
            throw new VacademyException("Approval decision is required");
        }

        if (Boolean.TRUE.equals(actionDTO.getApproved())) {
            compOff.setStatus(LeaveStatus.APPROVED.name());
            compOff.setApprovedBy(approverUserId);

            // BUG 6 FIX: Credit approved comp-off to leave balance
            creditCompOffToLeaveBalance(compOff);
        } else {
            compOff.setStatus(LeaveStatus.REJECTED.name());
        }

        compensatoryOffRepository.save(compOff);
        return compOff.getId();
    }

    @Transactional(readOnly = true)
    public List<CompOffDTO> getCompOffs(String employeeId) {
        // Fetch all comp offs for the employee (all statuses), ordered by worked on date desc
        List<CompensatoryOff> compOffs = compensatoryOffRepository
                .findByEmployee_IdAndStatusOrderByWorkedOnDateDesc(employeeId, LeaveStatus.APPROVED.name());

        // Also get pending ones
        List<CompensatoryOff> pendingCompOffs = compensatoryOffRepository
                .findByEmployee_IdAndStatusOrderByWorkedOnDateDesc(employeeId, LeaveStatus.PENDING.name());

        // Merge both lists into a new mutable list
        List<CompensatoryOff> allCompOffs = new ArrayList<>(compOffs);
        allCompOffs.addAll(pendingCompOffs);

        return allCompOffs.stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    /**
     * BUG 6 FIX: When a comp-off is approved, credit the earned days to the employee's
     * COMP_OFF leave balance for the current year. Find or create the COMP_OFF leave type
     * for the institute, then find or create a LeaveBalance and add earned days to adjustment.
     */
    private void creditCompOffToLeaveBalance(CompensatoryOff compOff) {
        EmployeeProfile employee = compOff.getEmployee();
        String instituteId = employee.getInstituteId();
        int currentYear = LocalDate.now().getYear();

        // Find or create COMP_OFF leave type for the institute
        LeaveType compOffLeaveType = leaveTypeRepository.findByInstituteIdAndCode(instituteId, "COMP_OFF")
                .orElseGet(() -> {
                    LeaveType newType = new LeaveType();
                    newType.setInstituteId(instituteId);
                    newType.setName("Compensatory Off");
                    newType.setCode("COMP_OFF");
                    newType.setIsPaid(true);
                    newType.setIsCarryForward(false);
                    newType.setIsEncashable(false);
                    newType.setRequiresDocument(false);
                    newType.setStatus("ACTIVE");
                    return leaveTypeRepository.save(newType);
                });

        // Find or create leave balance for the employee + COMP_OFF leave type + current year
        Optional<LeaveBalance> existingBalance = leaveBalanceRepository
                .findByEmployee_IdAndLeaveType_IdAndYear(employee.getId(), compOffLeaveType.getId(), currentYear);

        LeaveBalance balance;
        if (existingBalance.isPresent()) {
            balance = existingBalance.get();
        } else {
            balance = new LeaveBalance();
            balance.setEmployee(employee);
            balance.setLeaveType(compOffLeaveType);
            balance.setYear(currentYear);
            balance.setOpeningBalance(BigDecimal.ZERO);
            balance.setAccrued(BigDecimal.ZERO);
            balance.setUsed(BigDecimal.ZERO);
            balance.setAdjustment(BigDecimal.ZERO);
            balance.setCarriedForward(BigDecimal.ZERO);
            balance.setEncashed(BigDecimal.ZERO);
        }

        // Add earned days to the adjustment field
        BigDecimal currentAdjustment = balance.getAdjustment() != null ? balance.getAdjustment() : BigDecimal.ZERO;
        balance.setAdjustment(currentAdjustment.add(compOff.getEarnedDays()));
        leaveBalanceRepository.save(balance);
    }

    private CompOffDTO toDTO(CompensatoryOff entity) {
        return CompOffDTO.builder()
                .id(entity.getId())
                .employeeId(entity.getEmployee().getId())
                .workedOnDate(entity.getWorkedOnDate())
                .earnedDays(entity.getEarnedDays())
                .expiryDate(entity.getExpiryDate())
                .status(entity.getStatus())
                .build();
    }
}

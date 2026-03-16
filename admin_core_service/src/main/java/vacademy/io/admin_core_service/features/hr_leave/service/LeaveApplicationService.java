package vacademy.io.admin_core_service.features.hr_leave.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.hr_attendance.entity.Holiday;
import vacademy.io.admin_core_service.features.hr_attendance.repository.HolidayRepository;
import vacademy.io.admin_core_service.features.hr_employee.entity.EmployeeProfile;
import vacademy.io.admin_core_service.features.hr_employee.repository.EmployeeProfileRepository;
import vacademy.io.admin_core_service.features.hr_leave.dto.LeaveActionDTO;
import vacademy.io.admin_core_service.features.hr_leave.dto.LeaveApplicationDTO;
import vacademy.io.admin_core_service.features.hr_leave.dto.LeaveApplyDTO;
import vacademy.io.admin_core_service.features.hr_leave.entity.LeaveApplication;
import vacademy.io.admin_core_service.features.hr_leave.entity.LeaveBalance;
import vacademy.io.admin_core_service.features.hr_leave.entity.LeaveType;
import vacademy.io.admin_core_service.features.hr_leave.enums.HalfDayType;
import vacademy.io.admin_core_service.features.hr_leave.enums.LeaveStatus;
import vacademy.io.admin_core_service.features.hr_leave.repository.LeaveApplicationRepository;
import vacademy.io.admin_core_service.features.hr_leave.repository.LeaveBalanceRepository;
import vacademy.io.admin_core_service.features.hr_leave.repository.LeaveTypeRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class LeaveApplicationService {

    @Autowired
    private LeaveApplicationRepository leaveApplicationRepository;

    @Autowired
    private LeaveTypeRepository leaveTypeRepository;

    @Autowired
    private LeaveBalanceRepository leaveBalanceRepository;

    @Autowired
    private EmployeeProfileRepository employeeProfileRepository;

    @Autowired
    private HolidayRepository holidayRepository;

    @Transactional
    public String applyLeave(LeaveApplyDTO dto, String instituteId) {
        if (!StringUtils.hasText(dto.getEmployeeId())) {
            throw new VacademyException("Employee ID is required");
        }
        if (!StringUtils.hasText(dto.getLeaveTypeId())) {
            throw new VacademyException("Leave type ID is required");
        }
        if (dto.getFromDate() == null || dto.getToDate() == null) {
            throw new VacademyException("From date and to date are required");
        }
        if (dto.getFromDate().isAfter(dto.getToDate())) {
            throw new VacademyException("From date cannot be after to date");
        }

        // BUG 7 FIX: Reject cross-year leave applications
        if (dto.getFromDate().getYear() != dto.getToDate().getYear()) {
            throw new VacademyException("Cross-year leave applications are not supported. Please apply separately for each year.");
        }

        // BUG 3 FIX: Half-day leave must be for a single day only
        if (Boolean.TRUE.equals(dto.getIsHalfDay()) && !dto.getFromDate().isEqual(dto.getToDate())) {
            throw new VacademyException("Half-day leave can only be applied for a single day");
        }

        EmployeeProfile employee = employeeProfileRepository.findById(dto.getEmployeeId())
                .orElseThrow(() -> new VacademyException("Employee not found"));

        LeaveType leaveType = leaveTypeRepository.findById(dto.getLeaveTypeId())
                .orElseThrow(() -> new VacademyException("Leave type not found"));

        // BUG 1 FIX: Check for overlapping leaves (PENDING or APPROVED)
        List<LeaveApplication> overlapping = leaveApplicationRepository.findOverlappingLeaves(
                dto.getEmployeeId(), dto.getFromDate(), dto.getToDate());
        if (!overlapping.isEmpty()) {
            throw new VacademyException("Leave application overlaps with an existing leave");
        }

        // Calculate working days (exclude weekends and holidays)
        BigDecimal calculatedDays = calculateWorkingDays(
                dto.getFromDate(), dto.getToDate(), instituteId);

        // If half day, count as 0.5
        if (Boolean.TRUE.equals(dto.getIsHalfDay())) {
            calculatedDays = new BigDecimal("0.5");
        }

        if (calculatedDays.compareTo(BigDecimal.ZERO) <= 0) {
            throw new VacademyException("No working days in the selected date range");
        }

        // BUG 2 FIX: Validate maxConsecutiveDays
        if (leaveType.getMaxConsecutiveDays() != null && leaveType.getMaxConsecutiveDays() > 0) {
            if (calculatedDays.compareTo(new BigDecimal(leaveType.getMaxConsecutiveDays())) > 0) {
                throw new VacademyException("Requested days (" + calculatedDays
                        + ") exceed the maximum consecutive days allowed (" + leaveType.getMaxConsecutiveDays() + ") for this leave type");
            }
        }

        // Validate leave balance
        int year = dto.getFromDate().getYear();
        LeaveBalance balance = leaveBalanceRepository
                .findByEmployee_IdAndLeaveType_IdAndYear(dto.getEmployeeId(), dto.getLeaveTypeId(), year)
                .orElse(null);

        if (balance != null) {
            BigDecimal availableBalance = balance.getClosingBalance();
            if (availableBalance.compareTo(calculatedDays) < 0) {
                throw new VacademyException("Insufficient leave balance. Available: "
                        + availableBalance + ", Requested: " + calculatedDays);
            }
        } else {
            throw new VacademyException("No leave balance found for the selected leave type and year");
        }

        // Validate halfDayType enum
        if (Boolean.TRUE.equals(dto.getIsHalfDay()) && dto.getHalfDayType() != null) {
            try {
                HalfDayType.valueOf(dto.getHalfDayType());
            } catch (IllegalArgumentException e) {
                throw new VacademyException("Invalid half day type: " + dto.getHalfDayType());
            }
        }

        // Determine reporting manager
        String appliedTo = null;
        if (employee.getReportingManager() != null) {
            appliedTo = employee.getReportingManager().getUserId();
        }

        // Create leave application
        LeaveApplication application = new LeaveApplication();
        application.setEmployee(employee);
        application.setInstituteId(instituteId);
        application.setLeaveType(leaveType);
        application.setFromDate(dto.getFromDate());
        application.setToDate(dto.getToDate());
        application.setTotalDays(calculatedDays);
        application.setIsHalfDay(dto.getIsHalfDay() != null ? dto.getIsHalfDay() : false);
        application.setHalfDayType(dto.getHalfDayType());
        application.setReason(dto.getReason());
        application.setDocumentFileId(dto.getDocumentFileId());
        application.setStatus(LeaveStatus.PENDING.name());
        application.setAppliedTo(appliedTo);

        application = leaveApplicationRepository.save(application);
        return application.getId();
    }

    @Transactional
    public String approveRejectLeave(String id, LeaveActionDTO actionDTO, String approverUserId) {
        LeaveApplication application = leaveApplicationRepository.findById(id)
                .orElseThrow(() -> new VacademyException("Leave application not found"));

        if (!LeaveStatus.PENDING.name().equals(application.getStatus())) {
            throw new VacademyException("Only pending leave applications can be approved or rejected");
        }

        if (!StringUtils.hasText(actionDTO.getAction())) {
            throw new VacademyException("Action is required");
        }

        String action = actionDTO.getAction().toUpperCase();
        if (!LeaveStatus.APPROVED.name().equals(action) && !LeaveStatus.REJECTED.name().equals(action)) {
            throw new VacademyException("Action must be APPROVED or REJECTED");
        }

        if (LeaveStatus.APPROVED.name().equals(action)) {
            // Deduct from leave balance
            int year = application.getFromDate().getYear();
            LeaveBalance balance = leaveBalanceRepository
                    .findByEmployee_IdAndLeaveType_IdAndYear(
                            application.getEmployee().getId(),
                            application.getLeaveType().getId(),
                            year)
                    .orElseThrow(() -> new VacademyException("Leave balance not found"));

            BigDecimal currentUsed = balance.getUsed() != null ? balance.getUsed() : BigDecimal.ZERO;
            balance.setUsed(currentUsed.add(application.getTotalDays()));
            leaveBalanceRepository.save(balance);

            application.setStatus(LeaveStatus.APPROVED.name());
            application.setApprovedBy(approverUserId);
            application.setApprovedAt(LocalDateTime.now());
        } else {
            // Rejected
            if (!StringUtils.hasText(actionDTO.getRejectionReason())) {
                throw new VacademyException("Rejection reason is required");
            }
            application.setStatus(LeaveStatus.REJECTED.name());
            application.setRejectionReason(actionDTO.getRejectionReason());
        }

        leaveApplicationRepository.save(application);
        return application.getId();
    }

    @Transactional
    public String cancelLeave(String id) {
        LeaveApplication application = leaveApplicationRepository.findById(id)
                .orElseThrow(() -> new VacademyException("Leave application not found"));

        String currentStatus = application.getStatus();
        if (!LeaveStatus.PENDING.name().equals(currentStatus)
                && !LeaveStatus.APPROVED.name().equals(currentStatus)) {
            throw new VacademyException("Only pending or approved leave applications can be cancelled");
        }

        // If it was approved, restore the leave balance
        if (LeaveStatus.APPROVED.name().equals(currentStatus)) {
            int year = application.getFromDate().getYear();
            LeaveBalance balance = leaveBalanceRepository
                    .findByEmployee_IdAndLeaveType_IdAndYear(
                            application.getEmployee().getId(),
                            application.getLeaveType().getId(),
                            year)
                    .orElse(null);

            if (balance != null) {
                BigDecimal currentUsed = balance.getUsed() != null ? balance.getUsed() : BigDecimal.ZERO;
                BigDecimal restoredUsed = currentUsed.subtract(application.getTotalDays());
                balance.setUsed(restoredUsed.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : restoredUsed);
                leaveBalanceRepository.save(balance);
            }
        }

        application.setStatus(LeaveStatus.CANCELLED.name());
        leaveApplicationRepository.save(application);
        return application.getId();
    }

    @Transactional(readOnly = true)
    public Page<LeaveApplicationDTO> getLeaveApplications(String instituteId, String status,
                                                           String employeeId, int pageNo, int pageSize) {
        Pageable pageable = PageRequest.of(pageNo, pageSize);
        Page<LeaveApplication> page = leaveApplicationRepository.findByFilters(
                instituteId, status, employeeId, pageable);
        return page.map(this::toDTO);
    }

    @Transactional(readOnly = true)
    public List<LeaveApplicationDTO> getPendingForManager(String managerUserId) {
        List<LeaveApplication> applications = leaveApplicationRepository.findPendingForManager(managerUserId);
        return applications.stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    /**
     * Calculates the number of working days between two dates (inclusive),
     * excluding weekends (Saturday and Sunday) and holidays.
     */
    private BigDecimal calculateWorkingDays(LocalDate fromDate, LocalDate toDate, String instituteId) {
        // Fetch holidays in the date range
        List<Holiday> holidays = holidayRepository.findByInstituteIdAndDateRange(instituteId, fromDate, toDate);
        Set<LocalDate> holidayDates = holidays.stream()
                .filter(h -> !Boolean.TRUE.equals(h.getIsOptional()))
                .map(Holiday::getDate)
                .collect(Collectors.toSet());

        int workingDays = 0;
        LocalDate current = fromDate;
        while (!current.isAfter(toDate)) {
            DayOfWeek dayOfWeek = current.getDayOfWeek();
            boolean isWeekend = dayOfWeek == DayOfWeek.SATURDAY || dayOfWeek == DayOfWeek.SUNDAY;
            boolean isHoliday = holidayDates.contains(current);

            if (!isWeekend && !isHoliday) {
                workingDays++;
            }
            current = current.plusDays(1);
        }

        return new BigDecimal(workingDays);
    }

    private LeaveApplicationDTO toDTO(LeaveApplication entity) {
        return LeaveApplicationDTO.builder()
                .id(entity.getId())
                .employeeId(entity.getEmployee().getId())
                .employeeCode(entity.getEmployee().getEmployeeCode())
                .instituteId(entity.getInstituteId())
                .leaveTypeId(entity.getLeaveType().getId())
                .leaveTypeName(entity.getLeaveType().getName())
                .fromDate(entity.getFromDate())
                .toDate(entity.getToDate())
                .totalDays(entity.getTotalDays())
                .isHalfDay(entity.getIsHalfDay())
                .halfDayType(entity.getHalfDayType())
                .reason(entity.getReason())
                .documentFileId(entity.getDocumentFileId())
                .status(entity.getStatus())
                .appliedTo(entity.getAppliedTo())
                .approvedBy(entity.getApprovedBy())
                .approvedAt(entity.getApprovedAt())
                .rejectionReason(entity.getRejectionReason())
                .createdAt(entity.getCreatedAt())
                .build();
    }
}

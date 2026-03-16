package vacademy.io.admin_core_service.features.hr_attendance.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.hr_attendance.dto.AttendanceRecordDTO;
import vacademy.io.admin_core_service.features.hr_attendance.dto.AttendanceSummaryDTO;
import vacademy.io.admin_core_service.features.hr_attendance.dto.BulkAttendanceMarkDTO;
import vacademy.io.admin_core_service.features.hr_attendance.dto.CheckInDTO;
import vacademy.io.admin_core_service.features.hr_attendance.dto.CheckOutDTO;
import vacademy.io.admin_core_service.features.hr_attendance.entity.AttendanceConfig;
import vacademy.io.admin_core_service.features.hr_attendance.entity.AttendanceRecord;
import vacademy.io.admin_core_service.features.hr_attendance.entity.EmployeeShiftMapping;
import vacademy.io.admin_core_service.features.hr_attendance.enums.AttendanceSource;
import vacademy.io.admin_core_service.features.hr_attendance.enums.AttendanceStatus;
import vacademy.io.admin_core_service.features.hr_attendance.repository.AttendanceConfigRepository;
import vacademy.io.admin_core_service.features.hr_attendance.repository.AttendanceRecordRepository;
import vacademy.io.admin_core_service.features.hr_attendance.repository.EmployeeShiftMappingRepository;
import vacademy.io.admin_core_service.features.hr_attendance.repository.HolidayRepository;
import vacademy.io.admin_core_service.features.hr_employee.entity.EmployeeProfile;
import vacademy.io.admin_core_service.features.hr_employee.repository.EmployeeProfileRepository;
import vacademy.io.common.auth.entity.User;
import vacademy.io.common.auth.repository.UserRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class AttendanceService {

    @Autowired
    private AttendanceRecordRepository attendanceRecordRepository;

    @Autowired
    private AttendanceConfigRepository attendanceConfigRepository;

    @Autowired
    private EmployeeProfileRepository employeeProfileRepository;

    @Autowired
    private EmployeeShiftMappingRepository employeeShiftMappingRepository;

    @Autowired
    private HolidayRepository holidayRepository;

    @Autowired
    private UserRepository userRepository;

    // TODO: BUG 6 — Currently any authenticated user can check in for any employeeId.
    // Once role-based authorization infrastructure is in place, verify that dto.getEmployeeId()
    // belongs to the authenticated user, or that the user has ADMIN/HR role to mark attendance for others.
    @Transactional
    public String checkIn(CheckInDTO dto, String instituteId) {
        EmployeeProfile employee = employeeProfileRepository.findById(dto.getEmployeeId())
                .orElseThrow(() -> new VacademyException("Employee not found with id: " + dto.getEmployeeId()));

        // Fetch attendance config for geo-fence and IP restriction validation
        AttendanceConfig config = attendanceConfigRepository.findByInstituteId(instituteId).orElse(null);

        // BUG 1 FIX: Enforce geo-fence validation
        if (config != null && Boolean.TRUE.equals(config.getGeoFenceEnabled())) {
            if (dto.getLatitude() == null || dto.getLongitude() == null) {
                throw new VacademyException("Location coordinates are required for check-in");
            }
            double distance = calculateDistance(config.getGeoFenceLat(), config.getGeoFenceLng(),
                                                dto.getLatitude(), dto.getLongitude());
            if (distance > config.getGeoFenceRadiusM()) {
                throw new VacademyException("You are outside the allowed geo-fence area");
            }
        }

        // BUG 2 FIX: Enforce IP restriction
        if (config != null && Boolean.TRUE.equals(config.getIpRestrictionEnabled()) && config.getAllowedIps() != null) {
            String clientIp = dto.getIpAddress();
            if (clientIp == null || !config.getAllowedIps().contains(clientIp)) {
                throw new VacademyException("Check-in not allowed from this IP address");
            }
        }

        LocalDate today = LocalDate.now();
        Optional<AttendanceRecord> existingRecord = attendanceRecordRepository
                .findByEmployeeIdAndAttendanceDate(dto.getEmployeeId(), today);

        if (existingRecord.isPresent() && existingRecord.get().getCheckInTime() != null) {
            throw new VacademyException("Employee has already checked in today");
        }

        AttendanceRecord record;
        if (existingRecord.isPresent()) {
            record = existingRecord.get();
        } else {
            record = new AttendanceRecord();
            record.setEmployee(employee);
            record.setInstituteId(instituteId);
            record.setAttendanceDate(today);
        }

        // Set shift if employee has an active shift mapping
        Optional<EmployeeShiftMapping> shiftMapping = employeeShiftMappingRepository
                .findActiveMapping(dto.getEmployeeId(), today);
        shiftMapping.ifPresent(mapping -> record.setShift(mapping.getShift()));

        record.setCheckInTime(LocalDateTime.now());
        record.setCheckInLat(dto.getLatitude());
        record.setCheckInLng(dto.getLongitude());
        record.setCheckInIp(dto.getIpAddress());
        record.setStatus(AttendanceStatus.PRESENT.name());
        record.setRemarks(dto.getRemarks());

        // Determine source based on whether geo coordinates are provided
        if (dto.getLatitude() != null && dto.getLongitude() != null) {
            record.setSource(AttendanceSource.GEO.name());
        } else {
            record.setSource(AttendanceSource.MANUAL.name());
        }

        // BUG 5 FIX: Handle race condition — unique constraint violation on (employee_id, attendance_date)
        try {
            attendanceRecordRepository.save(record);
        } catch (DataIntegrityViolationException e) {
            throw new VacademyException("Check-in already recorded for today");
        }
        return "Check-in recorded successfully";
    }

    @Transactional
    public String checkOut(CheckOutDTO dto, String instituteId) {
        LocalDate today = LocalDate.now();

        // BUG 3 FIX: For night shifts, the employee may check out on the next day.
        // Try today first, then fall back to yesterday's record.
        Optional<AttendanceRecord> existingOpt = attendanceRecordRepository
                .findByEmployeeIdAndAttendanceDate(dto.getEmployeeId(), today);
        if (existingOpt.isEmpty()) {
            // Try yesterday for night shift
            existingOpt = attendanceRecordRepository
                    .findByEmployeeIdAndAttendanceDate(dto.getEmployeeId(), today.minusDays(1));
        }
        if (existingOpt.isEmpty()) {
            throw new VacademyException("No check-in record found for today");
        }
        AttendanceRecord record = existingOpt.get();

        if (record.getCheckInTime() == null) {
            throw new VacademyException("No check-in record found for today. Please check in first.");
        }

        if (record.getCheckOutTime() != null) {
            throw new VacademyException("Employee has already checked out today");
        }

        LocalDateTime checkOutTime = LocalDateTime.now();
        record.setCheckOutTime(checkOutTime);
        record.setCheckOutLat(dto.getLatitude());
        record.setCheckOutLng(dto.getLongitude());
        record.setCheckOutIp(dto.getIpAddress());
        if (dto.getRemarks() != null) {
            record.setRemarks(dto.getRemarks());
        }

        // Calculate total hours worked
        long minutesWorked = ChronoUnit.MINUTES.between(record.getCheckInTime(), checkOutTime);

        // Subtract break duration if shift is assigned
        if (record.getShift() != null && record.getShift().getBreakDurationMin() != null) {
            minutesWorked -= record.getShift().getBreakDurationMin();
            record.setBreakDurationMin(record.getShift().getBreakDurationMin());
        }

        // BUG 4 FIX: Ensure minutesWorked is never negative after break subtraction
        minutesWorked = Math.max(0, minutesWorked);

        BigDecimal totalHours = BigDecimal.valueOf(minutesWorked)
                .divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP);
        record.setTotalHours(totalHours);

        // Check if half-day based on config
        Optional<AttendanceConfig> configOpt = attendanceConfigRepository.findByInstituteId(instituteId);
        if (configOpt.isPresent()) {
            AttendanceConfig config = configOpt.get();

            // Determine if half-day
            if (config.getHalfDayThresholdMin() != null && minutesWorked < config.getHalfDayThresholdMin()) {
                record.setStatus(AttendanceStatus.HALF_DAY.name());
            }

            // Calculate overtime if enabled
            if (Boolean.TRUE.equals(config.getOvertimeEnabled()) && config.getOvertimeThresholdMin() != null) {
                if (minutesWorked > config.getOvertimeThresholdMin()) {
                    long overtimeMinutes = minutesWorked - config.getOvertimeThresholdMin();
                    BigDecimal overtimeHours = BigDecimal.valueOf(overtimeMinutes)
                            .divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP);
                    record.setOvertimeHours(overtimeHours);
                }
            }
        }

        attendanceRecordRepository.save(record);
        return "Check-out recorded successfully. Total hours: " + totalHours;
    }

    @Transactional
    public String markBulkAttendance(BulkAttendanceMarkDTO dto) {
        int successCount = 0;

        for (BulkAttendanceMarkDTO.AttendanceMarkEntry entry : dto.getEntries()) {
            // BUG 7 FIX: Validate status against AttendanceStatus enum
            try {
                AttendanceStatus.valueOf(entry.getStatus());
            } catch (IllegalArgumentException e) {
                throw new VacademyException("Invalid attendance status: " + entry.getStatus());
            }

            EmployeeProfile employee = employeeProfileRepository.findById(entry.getEmployeeId())
                    .orElseThrow(() -> new VacademyException("Employee not found with id: " + entry.getEmployeeId()));

            Optional<AttendanceRecord> existingRecord = attendanceRecordRepository
                    .findByEmployeeIdAndAttendanceDate(entry.getEmployeeId(), dto.getDate());

            AttendanceRecord record;
            if (existingRecord.isPresent()) {
                record = existingRecord.get();
            } else {
                record = new AttendanceRecord();
                record.setEmployee(employee);
                record.setInstituteId(dto.getInstituteId());
                record.setAttendanceDate(dto.getDate());
            }

            record.setStatus(entry.getStatus());
            record.setRemarks(entry.getRemarks());
            record.setSource(AttendanceSource.ADMIN.name());

            attendanceRecordRepository.save(record);
            successCount++;
        }

        return "Bulk attendance marked successfully for " + successCount + " employee(s)";
    }

    @Transactional(readOnly = true)
    public List<AttendanceRecordDTO> getAttendanceRecords(String instituteId, String employeeId,
                                                           Integer month, Integer year) {
        YearMonth yearMonth = YearMonth.of(year, month);
        LocalDate startDate = yearMonth.atDay(1);
        LocalDate endDate = yearMonth.atEndOfMonth();

        List<AttendanceRecord> records;
        if (employeeId != null && !employeeId.isEmpty()) {
            records = attendanceRecordRepository
                    .findByEmployeeIdAndAttendanceDateBetweenOrderByAttendanceDateAsc(
                            employeeId, startDate, endDate);
        } else {
            records = attendanceRecordRepository
                    .findByInstituteAndDateRange(instituteId, startDate, endDate);
        }

        // Collect all unique userIds from employee profiles to batch-fetch user names
        List<String> userIds = records.stream()
                .map(r -> r.getEmployee().getUserId())
                .distinct()
                .collect(Collectors.toList());
        Map<String, String> userNameMap = buildUserNameMap(userIds);

        return records.stream().map(record -> toRecordDTO(record, userNameMap)).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<AttendanceSummaryDTO> getAttendanceSummary(String instituteId, Integer month, Integer year) {
        YearMonth yearMonth = YearMonth.of(year, month);
        LocalDate startDate = yearMonth.atDay(1);
        LocalDate endDate = yearMonth.atEndOfMonth();

        // Get attendance config for weekend days
        List<String> weekendDays = new ArrayList<>();
        Optional<AttendanceConfig> configOpt = attendanceConfigRepository.findByInstituteId(instituteId);
        if (configOpt.isPresent() && configOpt.get().getWeekendDays() != null) {
            weekendDays = configOpt.get().getWeekendDays();
        }

        // Calculate total working days (exclude weekends and holidays)
        long totalDaysInMonth = yearMonth.lengthOfMonth();
        long holidayCount = holidayRepository.countMandatoryHolidays(instituteId, startDate, endDate);
        long weekendCount = countWeekendDays(startDate, endDate, weekendDays);
        int totalWorkingDays = (int) (totalDaysInMonth - holidayCount - weekendCount);

        // Get all active employees
        List<EmployeeProfile> activeEmployees = employeeProfileRepository
                .findActiveEmployees(instituteId, Arrays.asList("ACTIVE", "PROBATION"));

        // Batch-fetch user names
        List<String> userIds = activeEmployees.stream()
                .map(EmployeeProfile::getUserId)
                .distinct()
                .collect(Collectors.toList());
        Map<String, String> userNameMap = buildUserNameMap(userIds);

        List<AttendanceSummaryDTO> summaries = new ArrayList<>();

        for (EmployeeProfile employee : activeEmployees) {
            AttendanceSummaryDTO summary = new AttendanceSummaryDTO();
            summary.setEmployeeId(employee.getId());
            summary.setEmployeeName(userNameMap.getOrDefault(employee.getUserId(), "Unknown"));
            summary.setEmployeeCode(employee.getEmployeeCode());
            summary.setTotalWorkingDays(totalWorkingDays);

            // Count statuses for this employee
            long present = attendanceRecordRepository.countByEmployeeAndDateRangeAndStatus(
                    employee.getId(), startDate, endDate, AttendanceStatus.PRESENT.name());
            long absent = attendanceRecordRepository.countByEmployeeAndDateRangeAndStatus(
                    employee.getId(), startDate, endDate, AttendanceStatus.ABSENT.name());
            long halfDay = attendanceRecordRepository.countByEmployeeAndDateRangeAndStatus(
                    employee.getId(), startDate, endDate, AttendanceStatus.HALF_DAY.name());
            long onLeave = attendanceRecordRepository.countByEmployeeAndDateRangeAndStatus(
                    employee.getId(), startDate, endDate, AttendanceStatus.ON_LEAVE.name());

            summary.setPresent(present);
            summary.setAbsent(absent);
            summary.setHalfDay(halfDay);
            summary.setOnLeave(onLeave);
            summary.setHolidays(holidayCount);
            summary.setWeekends(weekendCount);

            // Sum overtime hours from records
            List<AttendanceRecord> empRecords = attendanceRecordRepository
                    .findByEmployeeIdAndAttendanceDateBetweenOrderByAttendanceDateAsc(
                            employee.getId(), startDate, endDate);
            BigDecimal totalOvertime = empRecords.stream()
                    .filter(r -> r.getOvertimeHours() != null)
                    .map(AttendanceRecord::getOvertimeHours)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            summary.setOvertime(totalOvertime);

            summaries.add(summary);
        }

        return summaries;
    }

    /**
     * Calculates the distance in meters between two geographic coordinates
     * using the Haversine formula.
     */
    private double calculateDistance(double lat1, double lon1, double lat2, double lon2) {
        final int R = 6371000; // Earth radius in meters
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                   Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                   Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private long countWeekendDays(LocalDate startDate, LocalDate endDate, List<String> weekendDayNames) {
        if (weekendDayNames == null || weekendDayNames.isEmpty()) {
            return 0;
        }

        List<DayOfWeek> weekendDaysOfWeek = weekendDayNames.stream()
                .map(name -> {
                    try {
                        return DayOfWeek.valueOf(name.toUpperCase());
                    } catch (IllegalArgumentException e) {
                        return null;
                    }
                })
                .filter(d -> d != null)
                .collect(Collectors.toList());

        long count = 0;
        LocalDate current = startDate;
        while (!current.isAfter(endDate)) {
            if (weekendDaysOfWeek.contains(current.getDayOfWeek())) {
                count++;
            }
            current = current.plusDays(1);
        }
        return count;
    }

    private Map<String, String> buildUserNameMap(List<String> userIds) {
        if (userIds.isEmpty()) {
            return Map.of();
        }
        List<User> users = userRepository.findByIdIn(userIds);
        return users.stream()
                .collect(Collectors.toMap(
                        User::getId,
                        u -> u.getFullName() != null ? u.getFullName() : u.getUsername(),
                        (a, b) -> a
                ));
    }

    private AttendanceRecordDTO toRecordDTO(AttendanceRecord record, Map<String, String> userNameMap) {
        AttendanceRecordDTO dto = new AttendanceRecordDTO();
        dto.setId(record.getId());
        dto.setEmployeeId(record.getEmployee().getId());
        dto.setEmployeeName(userNameMap.getOrDefault(record.getEmployee().getUserId(), "Unknown"));
        dto.setEmployeeCode(record.getEmployee().getEmployeeCode());
        dto.setInstituteId(record.getInstituteId());
        dto.setAttendanceDate(record.getAttendanceDate());

        if (record.getShift() != null) {
            dto.setShiftId(record.getShift().getId());
            dto.setShiftName(record.getShift().getName());
        }

        dto.setCheckInTime(record.getCheckInTime());
        dto.setCheckOutTime(record.getCheckOutTime());
        dto.setTotalHours(record.getTotalHours());
        dto.setOvertimeHours(record.getOvertimeHours());
        dto.setStatus(record.getStatus());
        dto.setSource(record.getSource());
        dto.setRemarks(record.getRemarks());
        dto.setIsRegularized(record.getIsRegularized());
        return dto;
    }
}

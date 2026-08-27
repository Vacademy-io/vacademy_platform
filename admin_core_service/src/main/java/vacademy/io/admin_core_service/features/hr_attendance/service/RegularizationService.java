package vacademy.io.admin_core_service.features.hr_attendance.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.core.security.HrAccessGuard;
import vacademy.io.admin_core_service.features.hr_attendance.dto.RegularizationActionDTO;
import vacademy.io.admin_core_service.features.hr_attendance.dto.RegularizationDTO;
import vacademy.io.admin_core_service.features.hr_attendance.entity.AttendanceConfig;
import vacademy.io.admin_core_service.features.hr_attendance.entity.AttendanceRecord;
import vacademy.io.admin_core_service.features.hr_attendance.entity.AttendanceRegularization;
import vacademy.io.admin_core_service.features.hr_attendance.repository.AttendanceConfigRepository;
import vacademy.io.admin_core_service.features.hr_attendance.repository.AttendanceRecordRepository;
import vacademy.io.admin_core_service.features.hr_attendance.repository.AttendanceRegularizationRepository;
import vacademy.io.admin_core_service.features.hr_employee.entity.EmployeeProfile;
import vacademy.io.common.exceptions.VacademyException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;

@Service
public class RegularizationService {

    @Autowired
    private AttendanceRegularizationRepository regularizationRepository;

    @Autowired
    private AttendanceRecordRepository attendanceRecordRepository;

    @Autowired
    private AttendanceConfigRepository attendanceConfigRepository;

    @Autowired
    private HrAccessGuard hrAccessGuard;

    /**
     * The employee is resolved and authorized by HrAccessGuard in the controller
     * (self or HR staff, member of the validated institute). The attendance
     * record must belong to that SAME employee and institute — a request may
     * never regularize someone else's record.
     */
    @Transactional
    public String requestRegularization(RegularizationDTO dto, EmployeeProfile employee, String instituteId) {
        validateRequestedTimes(dto.getRequestedCheckIn(), dto.getRequestedCheckOut());

        AttendanceRecord attendanceRecord = attendanceRecordRepository.findById(dto.getAttendanceId())
                .orElseThrow(() -> new VacademyException("Attendance record not found with id: " + dto.getAttendanceId()));
        hrAccessGuard.requireInstituteMatch(attendanceRecord.getInstituteId(), instituteId, "Attendance record");
        if (attendanceRecord.getEmployee() == null
                || !employee.getId().equals(attendanceRecord.getEmployee().getId())) {
            throw new VacademyException("Attendance record does not belong to the specified employee");
        }

        AttendanceRegularization regularization = new AttendanceRegularization();
        regularization.setAttendanceRecord(attendanceRecord);
        regularization.setEmployee(employee);
        regularization.setOriginalStatus(dto.getOriginalStatus() != null
                ? dto.getOriginalStatus() : attendanceRecord.getStatus());
        regularization.setRequestedStatus(dto.getRequestedStatus());
        regularization.setOriginalCheckIn(dto.getOriginalCheckIn() != null
                ? dto.getOriginalCheckIn() : attendanceRecord.getCheckInTime());
        regularization.setOriginalCheckOut(dto.getOriginalCheckOut() != null
                ? dto.getOriginalCheckOut() : attendanceRecord.getCheckOutTime());
        regularization.setRequestedCheckIn(dto.getRequestedCheckIn());
        regularization.setRequestedCheckOut(dto.getRequestedCheckOut());
        regularization.setReason(dto.getReason());
        regularization.setApprovalStatus("PENDING");
        regularization.setRemarks(dto.getRemarks());

        regularizationRepository.save(regularization);
        return "Regularization request submitted successfully";
    }

    @Transactional
    public String approveRejectRegularization(String id, RegularizationActionDTO actionDTO,
                                              String approverUserId, String instituteId) {
        AttendanceRegularization regularization = regularizationRepository.findById(id)
                .orElseThrow(() -> new VacademyException("Regularization request not found with id: " + id));
        hrAccessGuard.requireInstituteMatch(
                regularization.getAttendanceRecord() != null
                        ? regularization.getAttendanceRecord().getInstituteId() : null,
                instituteId, "Regularization request");

        if (!"PENDING".equals(regularization.getApprovalStatus())) {
            throw new VacademyException("Regularization request has already been processed");
        }

        if (Boolean.TRUE.equals(actionDTO.getApproved())) {
            regularization.setApprovalStatus("APPROVED");
            regularization.setApprovedBy(approverUserId);
            regularization.setApprovedAt(LocalDateTime.now());
            regularization.setRemarks(actionDTO.getRemarks());

            // Update the original attendance record with the requested changes
            AttendanceRecord record = regularization.getAttendanceRecord();
            if (regularization.getRequestedStatus() != null) {
                record.setStatus(regularization.getRequestedStatus());
            }
            if (regularization.getRequestedCheckIn() != null) {
                record.setCheckInTime(regularization.getRequestedCheckIn());
            }
            if (regularization.getRequestedCheckOut() != null) {
                record.setCheckOutTime(regularization.getRequestedCheckOut());
            }
            record.setIsRegularized(true);

            // The applied times must still form a valid interval (e.g. a requested
            // check-out combined with the existing check-in)
            if (record.getCheckInTime() != null && record.getCheckOutTime() != null
                    && !record.getCheckOutTime().isAfter(record.getCheckInTime())) {
                throw new VacademyException("Regularized check-out time must be after check-in time");
            }

            // Recalculate total hours if both check-in and check-out are present
            if (record.getCheckInTime() != null && record.getCheckOutTime() != null) {
                long minutesWorked = java.time.temporal.ChronoUnit.MINUTES.between(
                        record.getCheckInTime(), record.getCheckOutTime());
                if (record.getBreakDurationMin() != null) {
                    minutesWorked -= record.getBreakDurationMin();
                }
                record.setTotalHours(java.math.BigDecimal.valueOf(minutesWorked)
                        .divide(java.math.BigDecimal.valueOf(60), 2, java.math.RoundingMode.HALF_UP));
            }

            // Recalculate overtime
            AttendanceConfig config = attendanceConfigRepository.findByInstituteId(record.getInstituteId()).orElse(null);
            if (config != null && Boolean.TRUE.equals(config.getOvertimeEnabled()) && config.getOvertimeThresholdMin() != null) {
                if (record.getTotalHours() != null) {
                    long totalMinutes = (long) (record.getTotalHours().doubleValue() * 60);
                    if (totalMinutes > config.getOvertimeThresholdMin()) {
                        long overtimeMinutes = totalMinutes - config.getOvertimeThresholdMin();
                        record.setOvertimeHours(new BigDecimal(overtimeMinutes).divide(new BigDecimal("60"), 2, RoundingMode.HALF_UP));
                    } else {
                        record.setOvertimeHours(BigDecimal.ZERO);
                    }
                }
            }

            attendanceRecordRepository.save(record);
        } else {
            regularization.setApprovalStatus("REJECTED");
            regularization.setApprovedBy(approverUserId);
            regularization.setApprovedAt(LocalDateTime.now());
            regularization.setRemarks(actionDTO.getRemarks());
        }

        regularizationRepository.save(regularization);
        return Boolean.TRUE.equals(actionDTO.getApproved())
                ? "Regularization request approved successfully"
                : "Regularization request rejected";
    }

    private void validateRequestedTimes(LocalDateTime requestedCheckIn, LocalDateTime requestedCheckOut) {
        if (requestedCheckIn != null && requestedCheckOut != null
                && !requestedCheckOut.isAfter(requestedCheckIn)) {
            throw new VacademyException("Requested check-out time must be after requested check-in time");
        }
    }
}

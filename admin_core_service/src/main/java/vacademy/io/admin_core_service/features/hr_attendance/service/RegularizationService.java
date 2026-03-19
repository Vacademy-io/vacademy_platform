package vacademy.io.admin_core_service.features.hr_attendance.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.hr_attendance.dto.RegularizationActionDTO;
import vacademy.io.admin_core_service.features.hr_attendance.dto.RegularizationDTO;
import vacademy.io.admin_core_service.features.hr_attendance.entity.AttendanceConfig;
import vacademy.io.admin_core_service.features.hr_attendance.entity.AttendanceRecord;
import vacademy.io.admin_core_service.features.hr_attendance.entity.AttendanceRegularization;
import vacademy.io.admin_core_service.features.hr_attendance.repository.AttendanceConfigRepository;
import vacademy.io.admin_core_service.features.hr_attendance.repository.AttendanceRecordRepository;
import vacademy.io.admin_core_service.features.hr_attendance.repository.AttendanceRegularizationRepository;
import vacademy.io.admin_core_service.features.hr_employee.entity.EmployeeProfile;
import vacademy.io.admin_core_service.features.hr_employee.repository.EmployeeProfileRepository;
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
    private EmployeeProfileRepository employeeProfileRepository;

    @Autowired
    private AttendanceConfigRepository attendanceConfigRepository;

    @Transactional
    public String requestRegularization(RegularizationDTO dto) {
        AttendanceRecord attendanceRecord = attendanceRecordRepository.findById(dto.getAttendanceId())
                .orElseThrow(() -> new VacademyException("Attendance record not found with id: " + dto.getAttendanceId()));

        EmployeeProfile employee = employeeProfileRepository.findById(dto.getEmployeeId())
                .orElseThrow(() -> new VacademyException("Employee not found with id: " + dto.getEmployeeId()));

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
    public String approveRejectRegularization(String id, RegularizationActionDTO actionDTO, String approverUserId) {
        AttendanceRegularization regularization = regularizationRepository.findById(id)
                .orElseThrow(() -> new VacademyException("Regularization request not found with id: " + id));

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
}

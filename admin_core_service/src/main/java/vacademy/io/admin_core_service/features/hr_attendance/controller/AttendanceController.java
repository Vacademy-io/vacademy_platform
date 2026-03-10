package vacademy.io.admin_core_service.features.hr_attendance.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.admin_core_service.features.hr_attendance.dto.AttendanceConfigDTO;
import vacademy.io.admin_core_service.features.hr_attendance.dto.AttendanceRecordDTO;
import vacademy.io.admin_core_service.features.hr_attendance.dto.AttendanceSummaryDTO;
import vacademy.io.admin_core_service.features.hr_attendance.dto.BulkAttendanceMarkDTO;
import vacademy.io.admin_core_service.features.hr_attendance.dto.CheckInDTO;
import vacademy.io.admin_core_service.features.hr_attendance.dto.CheckOutDTO;
import vacademy.io.admin_core_service.features.hr_attendance.dto.RegularizationActionDTO;
import vacademy.io.admin_core_service.features.hr_attendance.dto.RegularizationDTO;
import vacademy.io.admin_core_service.features.hr_attendance.service.AttendanceConfigService;
import vacademy.io.admin_core_service.features.hr_attendance.service.AttendanceService;
import vacademy.io.admin_core_service.features.hr_attendance.service.RegularizationService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/api/v1/hr/attendance")
public class AttendanceController {

    @Autowired
    private AttendanceConfigService attendanceConfigService;

    @Autowired
    private AttendanceService attendanceService;

    @Autowired
    private RegularizationService regularizationService;

    @Autowired
    private InstituteAccessValidator instituteAccessValidator;

    @PostMapping("/config")
    public ResponseEntity<AttendanceConfigDTO> saveConfig(
            @RequestBody AttendanceConfigDTO configDTO,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(attendanceConfigService.saveConfig(configDTO));
    }

    @GetMapping("/config")
    public ResponseEntity<AttendanceConfigDTO> getConfig(
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(attendanceConfigService.getConfig(instituteId));
    }

    @PostMapping("/check-in")
    public ResponseEntity<String> checkIn(
            @RequestBody CheckInDTO checkInDTO,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(attendanceService.checkIn(checkInDTO, instituteId));
    }

    @PostMapping("/check-out")
    public ResponseEntity<String> checkOut(
            @RequestBody CheckOutDTO checkOutDTO,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(attendanceService.checkOut(checkOutDTO, instituteId));
    }

    @PostMapping("/mark")
    public ResponseEntity<String> markBulkAttendance(
            @RequestBody BulkAttendanceMarkDTO bulkDTO,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(attendanceService.markBulkAttendance(bulkDTO));
    }

    @GetMapping
    public ResponseEntity<List<AttendanceRecordDTO>> getAttendanceRecords(
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "employeeId", required = false) String employeeId,
            @RequestParam("month") Integer month,
            @RequestParam("year") Integer year,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(attendanceService.getAttendanceRecords(instituteId, employeeId, month, year));
    }

    @GetMapping("/summary")
    public ResponseEntity<List<AttendanceSummaryDTO>> getAttendanceSummary(
            @RequestParam("instituteId") String instituteId,
            @RequestParam("month") Integer month,
            @RequestParam("year") Integer year,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(attendanceService.getAttendanceSummary(instituteId, month, year));
    }

    @PostMapping("/regularization")
    public ResponseEntity<String> requestRegularization(
            @RequestBody RegularizationDTO regularizationDTO,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(regularizationService.requestRegularization(regularizationDTO));
    }

    @PutMapping("/regularization/{id}/action")
    public ResponseEntity<String> approveRejectRegularization(
            @PathVariable("id") String id,
            @RequestBody RegularizationActionDTO actionDTO,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(regularizationService.approveRejectRegularization(id, actionDTO, user.getUserId()));
    }
}

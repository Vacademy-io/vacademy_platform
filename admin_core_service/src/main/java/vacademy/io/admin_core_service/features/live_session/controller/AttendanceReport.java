package vacademy.io.admin_core_service.features.live_session.controller;


import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.common.dto.CustomFieldDTO;
import vacademy.io.admin_core_service.features.live_session.dto.*;
import vacademy.io.admin_core_service.features.live_session.service.AttendanceReportService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/admin-core-service/live-session-report")
@RequiredArgsConstructor
public class AttendanceReport {

    private final AttendanceReportService attendanceReportService;

    @GetMapping("/by-session-id")
    ResponseEntity<List<AttendanceReportDTO>> getReportBySessionIds(@RequestParam("sessionId") String sessionId , @RequestParam("scheduleId") String scheduleId , @RequestParam("accessType") String accessType , @RequestAttribute("user") CustomUserDetails user){
        return ResponseEntity.ok(attendanceReportService.generateReport(sessionId , scheduleId , accessType));
    }

    @GetMapping("/by-batch-session")
    public ResponseEntity<List<StudentAttendanceDTO>> getAttendanceReportByBatchSessionId(
            @RequestParam("batchSessionId") String batchSessionId , @RequestParam("startDate") LocalDate start, @RequestParam("endDate") LocalDate end
    ) {
        List<StudentAttendanceDTO> report = attendanceReportService.getGroupedAttendanceReport(batchSessionId , start , end);
        return ResponseEntity.ok(report);
    }

    @GetMapping("/public-registration")
    public ResponseEntity<Map<String, List<CustomFieldDTO>>> getPublicRegisteredData(@RequestParam("SessionId") String sessionId){
        return ResponseEntity.ok(attendanceReportService.getGuestWiseCustomFields(sessionId));
    }

    @GetMapping("/student-report")
    public ResponseEntity<StudentAttendanceReportDTO> getStudentReport(@RequestParam("userId") String userId , @RequestParam("batchId") String batchId , @RequestParam("startDate") LocalDate start, @RequestParam("endDate") LocalDate end){
        return ResponseEntity.ok(attendanceReportService.getStudentReport(userId , batchId , start ,end));
    }

}

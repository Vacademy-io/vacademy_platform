package vacademy.io.admin_core_service.features.live_session.controller;


import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.live_session.dto.AttendanceReportDTO;
import vacademy.io.admin_core_service.features.live_session.service.AttendanceReportService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/live-session-report")
@RequiredArgsConstructor
public class AttendanceReport {

    private final AttendanceReportService attendanceReportService;

    @GetMapping("/by-session-id")
    ResponseEntity<List<AttendanceReportDTO>> getReportBySessionIds(@RequestParam("sessionId") String sessionId , @RequestParam("scheduleId") String scheduleId , @RequestParam("accessType") String accessType , @RequestAttribute("user") CustomUserDetails user){
        return ResponseEntity.ok(attendanceReportService.generateReport(sessionId , scheduleId , accessType));
    }
}

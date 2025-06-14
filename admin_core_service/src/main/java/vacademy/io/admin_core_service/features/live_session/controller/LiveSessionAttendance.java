package vacademy.io.admin_core_service.features.live_session.controller;


import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.live_session.dto.MarkAttendanceRequestDTO;
import vacademy.io.admin_core_service.features.live_session.service.LIveSessionAttendanceService;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/live-session")
@RequiredArgsConstructor
public class LiveSessionAttendance {

    private final LIveSessionAttendanceService lIveSessionAttendanceService;

    @PostMapping("/mark-attendance")
    public ResponseEntity<String> markAttendance(@RequestBody MarkAttendanceRequestDTO request , @RequestAttribute("user") CustomUserDetails user) {
        lIveSessionAttendanceService.markAttendance(request , user);
        return ResponseEntity.ok("Attendance marked successfully.");
    }
    @PostMapping("/mark-guest-attendance")
    public ResponseEntity<String> markGuestAttendance(@RequestBody MarkAttendanceRequestDTO request ) {
        lIveSessionAttendanceService.markAttendanceForGuest(request);
        return ResponseEntity.ok("Attendance marked successfully.");
    }


}

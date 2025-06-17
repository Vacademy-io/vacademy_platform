package vacademy.io.admin_core_service.features.live_session.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.live_session.dto.GetSessionDetailsBySessionIdResponseDTO;
import vacademy.io.admin_core_service.features.live_session.dto.MarkAttendanceRequestDTO;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSessionLogs;
import vacademy.io.admin_core_service.features.live_session.service.GetSessionByIdService;
import vacademy.io.admin_core_service.features.live_session.service.LIveSessionAttendanceService;
import vacademy.io.common.auth.model.CustomUserDetails;


@RestController
@RequestMapping("/admin-core-service/live-session/guest")
@RequiredArgsConstructor
public class GuestController {

    @Autowired
    private GetSessionByIdService getSessionByIdService;

    @Autowired
    private LIveSessionAttendanceService lIveSessionAttendanceService;

    @GetMapping("/get-session-by-schedule-id")
    ResponseEntity<GetSessionDetailsBySessionIdResponseDTO> getSessionByScheduleIdForGuestUser(@RequestParam("scheduleId") String scheduleId ){
        return ResponseEntity.ok(getSessionByIdService.getSessionByScheduleIdForGuestUser(scheduleId));
    }

    @PostMapping("/mark-attendance")
    public ResponseEntity<String> markAttendanceForGuest(@RequestBody MarkAttendanceRequestDTO request ) {
        lIveSessionAttendanceService.markAttendanceForGuest(request);
        return ResponseEntity.ok("Attendance marked successfully.");
    }
}

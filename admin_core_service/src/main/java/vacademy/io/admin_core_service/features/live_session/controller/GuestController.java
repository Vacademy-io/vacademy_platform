package vacademy.io.admin_core_service.features.live_session.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.live_session.dto.GetSessionDetailsBySessionIdResponseDTO;
import vacademy.io.admin_core_service.features.live_session.dto.MarkAttendanceRequestDTO;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSessionLogs;
import vacademy.io.admin_core_service.features.live_session.entity.SessionSchedule;
import vacademy.io.admin_core_service.features.live_session.enums.SessionLog;
import vacademy.io.admin_core_service.features.live_session.provider.manager.BbbMeetingManager;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionLogsRepository;
import vacademy.io.admin_core_service.features.live_session.repository.SessionScheduleRepository;
import vacademy.io.admin_core_service.features.live_session.service.GetSessionByIdService;
import vacademy.io.admin_core_service.features.live_session.service.LIveSessionAttendanceService;
import vacademy.io.common.exceptions.VacademyException;

import java.sql.Timestamp;
import java.util.Map;
import java.util.UUID;


@RestController
@RequestMapping("/admin-core-service/live-session/guest")
@RequiredArgsConstructor
@Slf4j
public class GuestController {

    @Autowired
    private GetSessionByIdService getSessionByIdService;

    @Autowired
    private LIveSessionAttendanceService lIveSessionAttendanceService;

    @Autowired
    private BbbMeetingManager bbbMeetingManager;

    @Autowired
    private SessionScheduleRepository scheduleRepository;

    @Autowired
    private LiveSessionLogsRepository liveSessionLogsRepository;

    @GetMapping("/get-session-by-schedule-id")
    ResponseEntity<GetSessionDetailsBySessionIdResponseDTO> getSessionByScheduleIdForGuestUser(@RequestParam("scheduleId") String scheduleId ){
        return ResponseEntity.ok(getSessionByIdService.getSessionByScheduleIdForGuestUser(scheduleId));
    }

    @PostMapping("/mark-attendance")
    public ResponseEntity<String> markAttendanceForGuest(@RequestBody MarkAttendanceRequestDTO request ) {
        lIveSessionAttendanceService.markAttendanceForGuest(request);
        return ResponseEntity.ok("Attendance marked successfully.");
    }

    /**
     * GET /admin-core-service/live-session/guest/bbb-join
     * ?scheduleId=xxx&guestName=John
     *
     * Public (no auth) BBB join for guest/public sessions.
     * The moderator (admin) must have started the meeting first.
     * Returns a personalized BBB join URL for the guest viewer.
     */
    @GetMapping("/bbb-join")
    public ResponseEntity<Map<String, String>> guestBbbJoin(
            @RequestParam String scheduleId,
            @RequestParam(defaultValue = "Guest") String guestName) {

        SessionSchedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new VacademyException("Schedule not found: " + scheduleId));

        String providerMeetingId = schedule.getProviderMeetingId();

        // Guest cannot create meetings — moderator (admin) must start the meeting first
        if (providerMeetingId == null || providerMeetingId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "Meeting has not started yet. Please wait for the host to start the class."));
        }

        // Check if meeting is running — guests can only join running meetings
        boolean isRunning = bbbMeetingManager.isMeetingRunning(providerMeetingId, null);
        if (!isRunning) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "Meeting has not started yet or has ended",
                    "meetingId", providerMeetingId));
        }

        // Generate guest join URL (VIEWER role, random guest ID)
        String guestId = "guest-" + UUID.randomUUID().toString().substring(0, 8);
        String joinUrl = bbbMeetingManager.buildJoinUrlForUser(
                providerMeetingId, guestName, guestId, "VIEWER", null);

        // Mark guest attendance
        markGuestBbbAttendance(schedule.getSessionId(), scheduleId, guestId, guestName);

        return ResponseEntity.ok(Map.of(
                "joinUrl", joinUrl,
                "meetingId", providerMeetingId));
    }

    private void markGuestBbbAttendance(String sessionId, String scheduleId,
                                         String guestId, String guestName) {
        try {
            LiveSessionLogs logEntry = LiveSessionLogs.builder()
                    .sessionId(sessionId)
                    .scheduleId(scheduleId)
                    .userSourceType("GUEST")
                    .userSourceId(guestId)
                    .logType(SessionLog.ATTENDANCE_RECORDED.name())
                    .status("PRESENT")
                    .statusType("ONLINE")
                    .details(guestName + " | role=VIEWER | guest=true")
                    .providerJoinTime(java.time.Instant.now().toString())
                    .createdAt(new Timestamp(System.currentTimeMillis()))
                    .updatedAt(new Timestamp(System.currentTimeMillis()))
                    .build();
            liveSessionLogsRepository.save(logEntry);
        } catch (Exception e) {
            log.warn("[BBB Guest] Failed to mark attendance: {}", e.getMessage());
        }
    }
}

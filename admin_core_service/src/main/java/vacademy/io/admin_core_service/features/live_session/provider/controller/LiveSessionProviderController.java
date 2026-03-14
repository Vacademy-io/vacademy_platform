package vacademy.io.admin_core_service.features.live_session.provider.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSessionLogs;
import vacademy.io.admin_core_service.features.live_session.entity.SessionSchedule;
import vacademy.io.admin_core_service.features.live_session.enums.SessionLog;
import vacademy.io.admin_core_service.features.live_session.provider.dto.ProviderMeetingCreateRequestDTO;
import vacademy.io.admin_core_service.features.live_session.provider.dto.ProviderConnectRequestDTO;
import vacademy.io.admin_core_service.features.live_session.provider.entity.LiveSessionProviderConfig;
import vacademy.io.admin_core_service.features.live_session.provider.manager.BbbMeetingManager;
import vacademy.io.admin_core_service.features.live_session.provider.service.LiveSessionProviderService;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionLogsRepository;
import vacademy.io.admin_core_service.features.live_session.repository.SessionScheduleRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.meeting.dto.CreateMeetingResponseDTO;
import vacademy.io.common.meeting.dto.MeetingAttendeeDTO;
import vacademy.io.common.meeting.dto.MeetingRecordingDTO;
import vacademy.io.common.meeting.enums.MeetingProvider;

import java.sql.Timestamp;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Live Session Provider REST API.
 * All endpoints require a valid JWT (enforced by the security filter chain).
 */
@RestController
@RequestMapping("/admin-core-service/live-sessions/provider")
@RequiredArgsConstructor
@Slf4j
public class LiveSessionProviderController {

    private final LiveSessionProviderService providerService;
    private final BbbMeetingManager bbbMeetingManager;
    private final SessionScheduleRepository scheduleRepository;
    private final LiveSessionLogsRepository liveSessionLogsRepository;

    // -----------------------------------------------------------------------
    // OAuth connect / status
    // -----------------------------------------------------------------------

    /**
     * One-time Zoho OAuth setup for an institute.
     * Admin generates the auth code from Zoho API Console → Self Client → Generate
     * Code.
     *
     * POST /admin-core/live-session/provider/connect/{providerName}
     */
    @PostMapping("/connect/{providerName}")
    public ResponseEntity<LiveSessionProviderConfig> connectProvider(
            @PathVariable String providerName,
            @RequestBody ProviderConnectRequestDTO request) {
        LiveSessionProviderConfig config = providerService.connectProvider(providerName, request);
        // Mask secrets before responding — configJson is not exposed in the entity
        // response
        config.setConfigJson(null);
        return ResponseEntity.ok(config);
    }

    /**
     * GET /admin-core/live-session/provider/status?instituteId=xxx
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getProviderStatus(
            @RequestParam String instituteId,
            @RequestParam(required = false, defaultValue = "ZOHO_MEETING") String provider) {
        boolean isConnected = providerService.isProviderConnected(instituteId, provider);
        return ResponseEntity.ok(Map.of(
                "instituteId", instituteId,
                "provider", provider,
                "isConnected", isConnected,
                "zohoMeetingConnected", isConnected)); // legacy frontend backward compatibility
    }

    /**
     * Returns the masked config (no secrets) for display on the admin dashboard.
     * GET
     * /admin-core/live-session/provider/config?instituteId=xxx&provider=ZOHO_MEETING
     */
    @GetMapping("/config")
    public ResponseEntity<Map<String, Object>> getProviderConfig(
            @RequestParam String instituteId,
            @RequestParam String provider) {
        return providerService.getProviderConfigDisplay(instituteId, provider)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // -----------------------------------------------------------------------
    // Meeting operations
    // -----------------------------------------------------------------------

    /**
     * Create a meeting via the institute's connected provider.
     * Join URL is automatically written back to
     * session_schedule.custom_meeting_link.
     *
     * POST /admin-core/live-session/provider/meeting/create
     */
    @PostMapping("/meeting/create")
    public ResponseEntity<CreateMeetingResponseDTO> createMeeting(
            @RequestBody ProviderMeetingCreateRequestDTO request) {
        return ResponseEntity.ok(providerService.createMeeting(request));
    }

    /**
     * GET /admin-core/live-session/provider/meeting/recordings
     * ?scheduleId=xxx&instituteId=yyy
     */
    @GetMapping("/meeting/recordings")
    public ResponseEntity<List<MeetingRecordingDTO>> getRecordings(
            @RequestParam String scheduleId,
            @RequestParam String instituteId) {
        return ResponseEntity.ok(providerService.getRecordings(scheduleId, instituteId));
    }

    /**
     * GET /admin-core/live-session/provider/meeting/attendance
     * ?scheduleId=xxx&instituteId=yyy
     */
    @GetMapping("/meeting/attendance")
    public ResponseEntity<List<MeetingAttendeeDTO>> getAttendance(
            @RequestParam String scheduleId,
            @RequestParam String instituteId) {
        return ResponseEntity.ok(providerService.getAttendance(scheduleId, instituteId));
    }

    // -----------------------------------------------------------------------
    // BBB Join — generates per-user join URL, auto-creates room if needed
    // -----------------------------------------------------------------------

    /**
     * GET /admin-core-service/live-sessions/provider/meeting/join
     * ?scheduleId=xxx&role=MODERATOR|VIEWER
     *
     * Flow:
     * 1. If no BBB meeting exists for this schedule → auto-create it
     * 2. Generate a personalized BBB join URL for the current user
     * 3. Mark attendance immediately
     * 4. Return the join URL (frontend loads it in iframe)
     */
    @GetMapping("/meeting/join")
    public ResponseEntity<Map<String, String>> joinBbbMeeting(
            @RequestParam String scheduleId,
            @RequestParam(defaultValue = "VIEWER") String role,
            @RequestAttribute("user") CustomUserDetails user) {

        SessionSchedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new vacademy.io.common.exceptions.VacademyException("Schedule not found: " + scheduleId));

        String providerMeetingId = schedule.getProviderMeetingId();

        // Auto-create BBB meeting if it doesn't exist yet
        if (providerMeetingId == null || providerMeetingId.isBlank()) {
            String sessionTitle = "Vacademy Live Class";
            if (schedule.getDefaultClassName() != null && !schedule.getDefaultClassName().isBlank()) {
                sessionTitle = schedule.getDefaultClassName();
            }

            ProviderMeetingCreateRequestDTO createRequest = ProviderMeetingCreateRequestDTO.builder()
                    .instituteId(null)
                    .sessionId(schedule.getSessionId())
                    .scheduleId(scheduleId)
                    .topic(sessionTitle)
                    .provider(MeetingProvider.BBB_MEETING.name())
                    .durationMinutes(120)
                    .build();

            CreateMeetingResponseDTO created = providerService.createMeeting(createRequest);
            providerMeetingId = created.getProviderMeetingId();

            // Re-fetch schedule to get updated fields
            schedule = scheduleRepository.findById(scheduleId).orElse(schedule);
        }

        // Generate personalized join URL
        String fullName = user.getFullName() != null ? user.getFullName() : user.getUsername();
        String joinUrl = bbbMeetingManager.buildJoinUrlForUser(
                providerMeetingId, fullName, user.getUserId(), role, null);

        // Mark attendance with join timestamp
        markBbbAttendance(schedule.getSessionId(), scheduleId, user.getUserId(), fullName, role);

        return ResponseEntity.ok(Map.of(
                "joinUrl", joinUrl,
                "meetingId", providerMeetingId,
                "role", role));
    }

    // -----------------------------------------------------------------------
    // BBB End callback — called by BBB server when meeting ends
    // -----------------------------------------------------------------------

    /**
     * GET /admin-core-service/live-sessions/provider/meeting/bbb-callback
     * ?scheduleId=xxx
     *
     * Called by BBB when a meeting ends (via meta_endCallbackUrl).
     * No auth required — called server-to-server from BBB.
     *
     * Note: We do NOT call getMeetingInfo here because BBB destroys meeting
     * data once the meeting ends, so attendee info would be empty.
     * Attendance is already tracked at join time in the /meeting/join endpoint.
     */
    @GetMapping("/meeting/bbb-callback")
    public ResponseEntity<String> bbbMeetingEndCallback(
            @RequestParam String scheduleId) {
        log.info("[BBB Callback] Meeting ended for scheduleId={}", scheduleId);

        try {
            SessionSchedule schedule = scheduleRepository.findById(scheduleId).orElse(null);
            if (schedule != null) {
                // Mark the sync timestamp — attendance was already recorded at join time
                schedule.setLastAttendanceSyncAt(new java.util.Date());
                scheduleRepository.save(schedule);
                log.info("[BBB Callback] Updated sync timestamp for scheduleId={}", scheduleId);
            }
        } catch (Exception e) {
            log.warn("[BBB Callback] Failed to update schedule for scheduleId={}: {}", scheduleId, e.getMessage());
        }

        return ResponseEntity.ok("OK");
    }

    private void markBbbAttendance(String sessionId, String scheduleId, String userId,
                                    String fullName, String role) {
        Optional<LiveSessionLogs> existing = liveSessionLogsRepository
                .findExistingAttendanceRecord(scheduleId, userId);

        String joinTimeIso = java.time.Instant.now().toString();

        if (existing.isEmpty()) {
            LiveSessionLogs logEntry = LiveSessionLogs.builder()
                    .sessionId(sessionId)
                    .scheduleId(scheduleId)
                    .userSourceType("USER")
                    .userSourceId(userId)
                    .logType(SessionLog.ATTENDANCE_RECORDED.name())
                    .status("PRESENT")
                    .details(fullName + " | role=" + role)
                    .providerJoinTime(joinTimeIso)
                    .createdAt(new Timestamp(System.currentTimeMillis()))
                    .updatedAt(new Timestamp(System.currentTimeMillis()))
                    .build();
            liveSessionLogsRepository.save(logEntry);
        }
    }
}

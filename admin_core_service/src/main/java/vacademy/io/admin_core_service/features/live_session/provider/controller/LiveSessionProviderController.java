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
import vacademy.io.common.meeting.dto.ParticipantJoinLinkDTO;
import vacademy.io.common.meeting.dto.UserScheduleAvailabilityDTO;
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
    private final vacademy.io.admin_core_service.features.live_session.repository.LiveSessionRepository liveSessionRepository;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;
    private final vacademy.io.common.media.service.FileService fileService;

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
     * One-time Zoho SDK OAuth setup for an institute (Server-based Application).
     * Merges SDK credentials into the existing provider config — regular meeting
     * credentials are preserved.
     *
     * POST /admin-core/live-session/provider/connect/{providerName}/sdk
     *
     * Body fields used: clientId (sdkClientId), clientSecret (sdkClientSecret),
     * authorizationCode, redirectUri, domain, presenterZuid
     */
    @PostMapping("/connect/{providerName}/sdk")
    public ResponseEntity<LiveSessionProviderConfig> connectSdkProvider(
            @PathVariable String providerName,
            @RequestBody ProviderConnectRequestDTO request) {
        LiveSessionProviderConfig config = providerService.connectSdkProvider(providerName, request);
        config.setConfigJson(null); // mask secrets
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

    /**
     * GET /admin-core/live-session/provider/meeting/session-links?scheduleId=
     *
     * Returns the stored joinUrl (participants) and hostUrl (organizer) for a
     * schedule. The hostUrl is a pre-signed Zoho startLink — opens directly
     * without a name/email form. Open either URL in a new browser tab.
     */
    @GetMapping("/meeting/session-links")
    public ResponseEntity<Map<String, String>> getSessionLinks(
            @RequestParam String scheduleId) {
        return ResponseEntity.ok(providerService.getSessionLinks(scheduleId));
    }

    /**
     * POST /admin-core/live-session/provider/meeting/participant-join-link
     * ?scheduleId=&instituteId=&participantName=&participantEmail=
     *
     * Registers the participant with the provider and returns a join link
     * pre-filled with their name/email.
     */
    @PostMapping("/meeting/participant-join-link")
    public ResponseEntity<ParticipantJoinLinkDTO> getParticipantJoinLink(
            @RequestParam String scheduleId,
            @RequestParam String instituteId,
            @RequestParam String participantName,
            @RequestParam String participantEmail) {
        return ResponseEntity.ok(providerService.getParticipantJoinLink(
                scheduleId, participantName, participantEmail, instituteId));
    }

    /**
     * GET /admin-core/live-session/provider/meeting/availability
     * ?instituteId=&vendorUserId=&startTime=&durationMinutes=
     *
     * Checks whether the organizer has any conflicting sessions in the requested
     * time window. Call this before creating a meeting to alert the user.
     */
    @GetMapping("/meeting/availability")
    public ResponseEntity<UserScheduleAvailabilityDTO> checkUserAvailability(
            @RequestParam String instituteId,
            @RequestParam(required = false) String vendorUserId,
            @RequestParam String startTime,
            @RequestParam int durationMinutes) {
        return ResponseEntity.ok(providerService.checkUserAvailability(
                startTime, durationMinutes, instituteId, vendorUserId));
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
            String instituteId = null;
            java.util.Map<String, Object> bbbConfig = null;

            // Load session-level data (title, instituteId, BBB config)
            if (schedule.getSessionId() != null) {
                var sessionOpt = liveSessionRepository.findById(schedule.getSessionId());
                if (sessionOpt.isPresent()) {
                    var session = sessionOpt.get();
                    if (session.getTitle() != null && !session.getTitle().isBlank()) {
                        sessionTitle = session.getTitle();
                    }
                    instituteId = session.getInstituteId();
                    if (session.getBbbConfigJson() != null && !session.getBbbConfigJson().isBlank()) {
                        try {
                            bbbConfig = objectMapper.readValue(session.getBbbConfigJson(),
                                    new com.fasterxml.jackson.core.type.TypeReference<java.util.Map<String, Object>>() {});
                        } catch (Exception e) {
                            log.warn("[BBB] Failed to parse bbbConfigJson: {}", e.getMessage());
                        }
                    }
                }
            }
            if ("Vacademy Live Class".equals(sessionTitle)
                    && schedule.getDefaultClassName() != null && !schedule.getDefaultClassName().isBlank()) {
                sessionTitle = schedule.getDefaultClassName();
            }

            ProviderMeetingCreateRequestDTO createRequest = ProviderMeetingCreateRequestDTO.builder()
                    .instituteId(instituteId)
                    .sessionId(schedule.getSessionId())
                    .scheduleId(scheduleId)
                    .topic(sessionTitle)
                    .provider(MeetingProvider.BBB_MEETING.name())
                    .durationMinutes(120)
                    .bbbConfig(bbbConfig)
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

    // -----------------------------------------------------------------------
    // BBB Recording upload — called by BBB post-publish script
    // -----------------------------------------------------------------------

    /**
     * POST /admin-core-service/live-sessions/provider/meeting/recording/init-upload
     * ?meetingId=xxx&fileName=recording.mp4&fileType=video/mp4
     *
     * Called by the BBB post-publish script to get a presigned S3 upload URL.
     * No auth required — server-to-server from BBB.
     * Simple secret check via X-BBB-Secret header.
     */
    @PostMapping("/meeting/recording/init-upload")
    public ResponseEntity<Map<String, String>> initRecordingUpload(
            @RequestParam String meetingId,
            @RequestParam String fileName,
            @RequestParam(defaultValue = "video/mp4") String fileType,
            @RequestHeader(value = "X-BBB-Secret", required = false) String bbbSecret) {

        // Validate BBB secret
        if (!bbbMeetingManager.validateBbbSecret(bbbSecret)) {
            log.warn("[BBB Recording] Invalid secret for meetingId={}", meetingId);
            return ResponseEntity.status(403).body(Map.of("error", "Invalid BBB secret"));
        }

        log.info("[BBB Recording] Init upload for meetingId={}, fileName={}", meetingId, fileName);

        Map<String, String> presigned = fileService.getPresignedUploadUrl(
                fileName, fileType, "BBB_RECORDING", meetingId);

        return ResponseEntity.ok(Map.of(
                "fileId", presigned.get("id"),
                "uploadUrl", presigned.get("url")));
    }

    /**
     * POST /admin-core-service/live-sessions/provider/meeting/recording/complete
     * Body: { "meetingId": "...", "fileId": "...", "recordingId": "...",
     *         "durationSeconds": 3600, "startTime": "2026-03-15T10:00:00Z" }
     *
     * Called by the BBB post-publish script after the recording MP4 has been
     * uploaded to S3 via the presigned URL. Saves the fileId and metadata
     * into session_schedule.provider_recordings_json.
     */
    @PostMapping("/meeting/recording/complete")
    public ResponseEntity<String> completeRecordingUpload(
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "X-BBB-Secret", required = false) String bbbSecret) {

        if (!bbbMeetingManager.validateBbbSecret(bbbSecret)) {
            log.warn("[BBB Recording] Invalid secret for complete request");
            return ResponseEntity.status(403).body("Invalid BBB secret");
        }

        String meetingId = (String) body.get("meetingId");
        String fileId = (String) body.get("fileId");
        String recordingId = (String) body.getOrDefault("recordingId", meetingId);
        long durationSeconds = body.containsKey("durationSeconds")
                ? ((Number) body.get("durationSeconds")).longValue() : 0;
        String startTime = (String) body.getOrDefault("startTime", java.time.Instant.now().toString());

        log.info("[BBB Recording] Complete upload: meetingId={}, fileId={}, duration={}s",
                meetingId, fileId, durationSeconds);

        // Find schedule by providerMeetingId
        List<SessionSchedule> schedules = scheduleRepository.findByProviderMeetingId(meetingId);
        if (schedules.isEmpty()) {
            log.warn("[BBB Recording] No schedule found for meetingId={}", meetingId);
            return ResponseEntity.ok("No schedule found — recording registered but not linked");
        }

        // Build recording entry
        MeetingRecordingDTO recording = MeetingRecordingDTO.builder()
                .recordingId(recordingId)
                .fileId(fileId)
                .durationSeconds(durationSeconds)
                .startTime(startTime)
                .providerMeetingId(meetingId)
                .build();

        for (SessionSchedule schedule : schedules) {
            try {
                // Merge with existing recordings (if any)
                List<MeetingRecordingDTO> recordings = new java.util.ArrayList<>();
                if (schedule.getProviderRecordingsJson() != null
                        && !schedule.getProviderRecordingsJson().isBlank()) {
                    recordings = objectMapper.readValue(schedule.getProviderRecordingsJson(),
                            new com.fasterxml.jackson.core.type.TypeReference<List<MeetingRecordingDTO>>() {});
                    recordings = new java.util.ArrayList<>(recordings);
                }
                recordings.add(recording);
                schedule.setProviderRecordingsJson(objectMapper.writeValueAsString(recordings));
                schedule.setLastRecordingSyncAt(new java.util.Date());
                scheduleRepository.save(schedule);
                log.info("[BBB Recording] Saved recording for scheduleId={}", schedule.getId());
            } catch (Exception e) {
                log.error("[BBB Recording] Failed to save for scheduleId={}: {}",
                        schedule.getId(), e.getMessage());
            }
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

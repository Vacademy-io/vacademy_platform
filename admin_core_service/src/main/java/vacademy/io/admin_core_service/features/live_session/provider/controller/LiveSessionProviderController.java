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

import vacademy.io.admin_core_service.features.live_session.dto.BbbAnalyticsCallbackDTO;

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
    private final vacademy.io.common.auth.repository.UserRepository userRepository;

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
            @RequestParam(defaultValue = "false") boolean recreate,
            @RequestAttribute("user") CustomUserDetails user) {

        SessionSchedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new vacademy.io.common.exceptions.VacademyException("Schedule not found: " + scheduleId));

        String providerMeetingId = schedule.getProviderMeetingId();
        String instituteId = null;

        // If moderator requested recreate, clear old meeting so a fresh one is created
        if (recreate && "MODERATOR".equalsIgnoreCase(role)
                && providerMeetingId != null && !providerMeetingId.isBlank()) {
            log.info("[BBB] Moderator requested recreate for scheduleId={}, clearing old meetingId={}", scheduleId, providerMeetingId);
            schedule.setProviderMeetingId(null);
            schedule.setCustomMeetingLink(null);
            schedule.setProviderHostUrl(null);
            scheduleRepository.save(schedule);
            providerMeetingId = null;
        }

        // Auto-create BBB meeting if it doesn't exist yet
        boolean justCreated = false;
        if (providerMeetingId == null || providerMeetingId.isBlank()) {
            String sessionTitle = "Live Class";
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
            if ("Live Class".equals(sessionTitle)
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
            justCreated = true;

            // Re-fetch schedule to get updated fields
            schedule = scheduleRepository.findById(scheduleId).orElse(schedule);
        } else {
            // Meeting already exists — still need instituteId for per-institute join branding
            if (schedule.getSessionId() != null) {
                var sessionOpt = liveSessionRepository.findById(schedule.getSessionId());
                if (sessionOpt.isPresent()) {
                    instituteId = sessionOpt.get().getInstituteId();
                }
            }
        }

        // Check if the meeting is still running (prevents joining ended meetings).
        // Skip this check if we just created the meeting — BBB reports it as "not running"
        // until the first participant joins, which would cause an infinite recreate loop.
        if (!justCreated) {
            boolean isRunning = bbbMeetingManager.isMeetingRunning(providerMeetingId, null);
            if (!isRunning && "MODERATOR".equalsIgnoreCase(role)) {
                // Meeting ended — tell the moderator so they can choose to recreate
                return ResponseEntity.ok(Map.of(
                        "status", "MEETING_ENDED",
                        "message", "This meeting has ended. Would you like to start a new meeting for this session?",
                        "meetingId", providerMeetingId));
            }
            if (!isRunning) {
                // For viewers, the meeting must be running
                return ResponseEntity.badRequest().body(Map.of(
                        "error", "Meeting has ended",
                        "meetingId", providerMeetingId));
            }
        }

        // Generate personalized join URL — resolve real name from DB if JWT doesn't have it
        String fullName = user.getFullName();
        if (fullName == null || fullName.isBlank()) {
            try {
                var dbUser = userRepository.findById(user.getUserId());
                if (dbUser.isPresent() && dbUser.get().getFullName() != null && !dbUser.get().getFullName().isBlank()) {
                    fullName = dbUser.get().getFullName();
                }
            } catch (Exception e) {
                log.warn("[BBB] Failed to fetch user full name from DB: {}", e.getMessage());
            }
        }
        if (fullName == null || fullName.isBlank()) {
            fullName = user.getUsername();
        }
        String joinUrl = bbbMeetingManager.buildJoinUrlForUser(
                providerMeetingId, fullName, user.getUserId(), role, instituteId);

        // Mark attendance with join timestamp
        markBbbAttendance(schedule.getSessionId(), scheduleId, user.getUserId(), fullName, role, providerMeetingId);

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
    // BBB Analytics callback — called by BBB after meeting ends
    // -----------------------------------------------------------------------

    /**
     * POST /admin-core-service/live-sessions/provider/meeting/bbb-analytics-callback
     * ?scheduleId=xxx
     *
     * Called by BBB after meeting ends (via meta_analytics-callback-url).
     * No auth required — server-to-server from BBB.
     * Receives per-attendee duration and engagement data.
     * For schedule retry: merges (sums) data with existing attendance logs.
     */
    @PostMapping("/meeting/bbb-analytics-callback")
    public ResponseEntity<String> bbbAnalyticsCallback(
            @RequestParam String scheduleId,
            @RequestBody BbbAnalyticsCallbackDTO callback) {
        log.info("[BBB Analytics] Received callback for scheduleId={}, meetingId={}, attendees={}",
                scheduleId, callback.getMeetingId(),
                callback.getAttendees() != null ? callback.getAttendees().size() : 0);

        try {
            SessionSchedule schedule = scheduleRepository.findById(scheduleId).orElse(null);
            if (schedule == null) {
                log.warn("[BBB Analytics] Schedule not found: {}", scheduleId);
                return ResponseEntity.ok("OK");
            }

            String sessionId = schedule.getSessionId();

            if (callback.getAttendees() != null) {
                for (BbbAnalyticsCallbackDTO.Attendee attendee : callback.getAttendees()) {
                    if (attendee.getExtUserId() == null || attendee.getExtUserId().isBlank()) {
                        continue;
                    }

                    try {
                        processAnalyticsAttendee(sessionId, scheduleId, callback.getMeetingId(), attendee);
                    } catch (Exception e) {
                        log.warn("[BBB Analytics] Failed to process attendee {}: {}",
                                attendee.getExtUserId(), e.getMessage());
                    }
                }
            }

            schedule.setLastAttendanceSyncAt(new java.util.Date());
            scheduleRepository.save(schedule);
            log.info("[BBB Analytics] Processed callback for scheduleId={}", scheduleId);

        } catch (Exception e) {
            log.error("[BBB Analytics] Failed for scheduleId={}: {}", scheduleId, e.getMessage());
        }

        return ResponseEntity.ok("OK");
    }

    /**
     * Process a single attendee from the BBB analytics callback.
     * Merges duration/engagement with any existing log (sums values for retry scenario).
     */
    private void processAnalyticsAttendee(String sessionId, String scheduleId,
                                           String providerMeetingId,
                                           BbbAnalyticsCallbackDTO.Attendee attendee) {
        Optional<LiveSessionLogs> existing = liveSessionLogsRepository
                .findExistingAttendanceRecord(scheduleId, attendee.getExtUserId());

        int durationMinutes = attendee.getDuration() != null
                ? (int) (attendee.getDuration() / 60) : 0;

        String engagementJson = buildEngagementJson(attendee.getEngagement());

        if (existing.isPresent()) {
            LiveSessionLogs log = existing.get();

            // Sum duration with existing (for retry/recreate scenario)
            int existingDuration = log.getProviderTotalDurationMinutes() != null
                    ? log.getProviderTotalDurationMinutes() : 0;
            log.setProviderTotalDurationMinutes(existingDuration + durationMinutes);

            // Merge engagement data (sum counts)
            log.setEngagementData(mergeEngagementJson(log.getEngagementData(), engagementJson));

            // Update provider meeting ID to latest
            log.setProviderMeetingId(providerMeetingId);

            // If user was absent (e.g. admin marked offline) but BBB says present, mark present
            if (!"PRESENT".equals(log.getStatus())) {
                log.setStatus("PRESENT");
                log.setStatusType("ONLINE");
            }

            log.setUpdatedAt(new Timestamp(System.currentTimeMillis()));
            liveSessionLogsRepository.save(log);
        } else {
            // User joined BBB directly without going through Vacademy join endpoint
            LiveSessionLogs logEntry = LiveSessionLogs.builder()
                    .sessionId(sessionId)
                    .scheduleId(scheduleId)
                    .userSourceType("USER")
                    .userSourceId(attendee.getExtUserId())
                    .logType(SessionLog.ATTENDANCE_RECORDED.name())
                    .status("PRESENT")
                    .statusType("ONLINE")
                    .details(attendee.getName() + " | role=" + (Boolean.TRUE.equals(attendee.getModerator()) ? "MODERATOR" : "VIEWER"))
                    .providerMeetingId(providerMeetingId)
                    .providerTotalDurationMinutes(durationMinutes)
                    .engagementData(engagementJson)
                    .createdAt(new Timestamp(System.currentTimeMillis()))
                    .updatedAt(new Timestamp(System.currentTimeMillis()))
                    .build();
            liveSessionLogsRepository.save(logEntry);
        }
    }

    private String buildEngagementJson(BbbAnalyticsCallbackDTO.Engagement engagement) {
        if (engagement == null) return null;
        try {
            Map<String, Integer> data = new java.util.LinkedHashMap<>();
            data.put("chats", engagement.getChats() != null ? engagement.getChats() : 0);
            data.put("talks", engagement.getTalks() != null ? engagement.getTalks() : 0);
            data.put("talkTime", engagement.getTalkTime() != null ? engagement.getTalkTime() : 0);
            data.put("raisehand", engagement.getRaisehand() != null ? engagement.getRaisehand() : 0);
            data.put("emojis", engagement.getEmojis() != null ? engagement.getEmojis() : 0);
            data.put("pollVotes", engagement.getPollVotes() != null ? engagement.getPollVotes() : 0);
            return objectMapper.writeValueAsString(data);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Merge two engagement JSON strings by summing each field.
     * Used when a meeting is recreated on the same schedule (retry scenario).
     */
    private String mergeEngagementJson(String existingJson, String newJson) {
        if (existingJson == null || existingJson.isBlank()) return newJson;
        if (newJson == null || newJson.isBlank()) return existingJson;
        try {
            Map<String, Integer> existingMap = objectMapper.readValue(existingJson,
                    new com.fasterxml.jackson.core.type.TypeReference<Map<String, Integer>>() {});
            Map<String, Integer> newMap = objectMapper.readValue(newJson,
                    new com.fasterxml.jackson.core.type.TypeReference<Map<String, Integer>>() {});

            Map<String, Integer> merged = new java.util.LinkedHashMap<>(existingMap);
            for (Map.Entry<String, Integer> entry : newMap.entrySet()) {
                merged.merge(entry.getKey(), entry.getValue(), Integer::sum);
            }
            return objectMapper.writeValueAsString(merged);
        } catch (Exception e) {
            return newJson; // fallback: use latest
        }
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
                                    String fullName, String role, String providerMeetingId) {
        Optional<LiveSessionLogs> existing = liveSessionLogsRepository
                .findExistingAttendanceRecord(scheduleId, userId);

        String joinTimeIso = java.time.Instant.now().toString();

        if (existing.isPresent()) {
            // User already has an attendance record for this schedule.
            // Update join time and provider meeting ID (handles retry/recreate scenario).
            LiveSessionLogs log = existing.get();
            log.setProviderJoinTime(joinTimeIso);
            log.setProviderMeetingId(providerMeetingId);
            log.setStatus("PRESENT");
            log.setStatusType("ONLINE");
            log.setUpdatedAt(new Timestamp(System.currentTimeMillis()));
            liveSessionLogsRepository.save(log);
        } else {
            LiveSessionLogs logEntry = LiveSessionLogs.builder()
                    .sessionId(sessionId)
                    .scheduleId(scheduleId)
                    .userSourceType("USER")
                    .userSourceId(userId)
                    .logType(SessionLog.ATTENDANCE_RECORDED.name())
                    .status("PRESENT")
                    .statusType("ONLINE")
                    .details(fullName + " | role=" + role)
                    .providerJoinTime(joinTimeIso)
                    .providerMeetingId(providerMeetingId)
                    .createdAt(new Timestamp(System.currentTimeMillis()))
                    .updatedAt(new Timestamp(System.currentTimeMillis()))
                    .build();
            liveSessionLogsRepository.save(logEntry);
        }
    }
}

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
import vacademy.io.admin_core_service.features.live_session.provider.dto.RecordingSyncResultDTO;
import vacademy.io.admin_core_service.features.live_session.provider.entity.LiveSessionProviderConfig;
import vacademy.io.admin_core_service.features.live_session.provider.manager.BbbMeetingManager;
import vacademy.io.admin_core_service.features.live_session.provider.service.BbbServerRouter;
import vacademy.io.admin_core_service.features.live_session.provider.service.LiveSessionProviderService;
import vacademy.io.admin_core_service.features.live_session.provider.service.ProviderMeetingBatchService;
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
    private final BbbServerRouter serverRouter;
    private final SessionScheduleRepository scheduleRepository;
    private final LiveSessionLogsRepository liveSessionLogsRepository;
    private final vacademy.io.admin_core_service.features.live_session.repository.LiveSessionRepository liveSessionRepository;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;
    private final vacademy.io.admin_core_service.features.institute.repository.InstituteRepository instituteRepository;
    private final vacademy.io.common.media.service.FileService fileService;
    private final vacademy.io.common.auth.repository.UserRepository userRepository;
    private final vacademy.io.admin_core_service.features.youtube.service.YoutubeUploadJobService youtubeUploadJobService;
    private final ProviderMeetingBatchService providerMeetingBatchService;
    private final vacademy.io.admin_core_service.core.security.InstituteAccessValidator instituteAccessValidator;

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
     * POST /admin-core-service/live-sessions/provider/meeting/create-for-session
     *
     * Provisions a provider meeting for EVERY schedule row of a session in one call,
     * server-side and in the background — replacing the admin browser looping a
     * create call per occurrence. Used for recurring sessions (one meeting per
     * occurrence). Idempotent: rows that already have a meeting are skipped, so this
     * can be re-called safely to fill gaps. Returns 202 with the count still pending.
     *
     * Body: same {@link ProviderMeetingCreateRequestDTO} as /meeting/create but
     * {@code scheduleId} is ignored — every not-yet-provisioned schedule of
     * {@code sessionId} is processed, each occurrence's start time + duration derived
     * from its own row.
     */
    @PostMapping("/meeting/create-for-session")
    public ResponseEntity<Map<String, Object>> createMeetingsForSession(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestBody ProviderMeetingCreateRequestDTO request) {
        // Authorize against the SESSION's real institute (not the client-supplied
        // instituteId) so a caller can't provision billable meetings on another tenant.
        instituteAccessValidator.validateUserAccess(user, resolveSessionInstituteId(request.getSessionId()));
        int pending = providerMeetingBatchService.countPending(request.getSessionId());
        providerMeetingBatchService.rememberProvisioningConfig(request);
        providerMeetingBatchService.createMeetingsForSessionAsync(request);
        return ResponseEntity.accepted().body(Map.of(
                "status", "PROCESSING",
                "sessionId", request.getSessionId() != null ? request.getSessionId() : "",
                "pendingCount", pending));
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
     * POST /admin-core/live-session/provider/meeting/recordings/sync
     * Admin escape hatch: fetches recordings directly from BBB, downloads any
     * missing, uploads to S3, and persists fileIds.
     * Returns status=BBB_OFFLINE when BBB is unreachable (it's often down).
     * Only call this after 2 hours from session start — enforced on the frontend.
     */
    @PostMapping("/meeting/recordings/sync")
    public ResponseEntity<RecordingSyncResultDTO> syncRecordings(
            @RequestParam String scheduleId,
            @RequestParam String instituteId) {
        return ResponseEntity.ok(providerService.syncRecordingsFromBbb(scheduleId, instituteId));
    }

    /**
     * POST /admin-core-service/live-sessions/provider/meeting/recordings/sync-to-s3
     * ?scheduleId=xxx&instituteId=yyy
     *
     * Admin "Sync to S3" for Zoom recordings: mirrors not-yet-mirrored cloud
     * recordings to Vacademy storage so they survive Zoom's ~30-day auto-delete.
     * Idempotent. Returns the updated recording list + count mirrored.
     */
    @PostMapping("/meeting/recordings/sync-to-s3")
    public ResponseEntity<RecordingSyncResultDTO> syncRecordingsToS3(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam String scheduleId,
            @RequestParam String instituteId) {
        SessionSchedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new vacademy.io.common.exceptions.VacademyException("Schedule not found: " + scheduleId));
        instituteAccessValidator.validateUserAccess(user, resolveInstituteId(schedule));
        return ResponseEntity.ok(providerService.syncRecordingsToS3(scheduleId, instituteId));
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

    /**
     * GET /admin-core-service/live-sessions/provider/meeting/availability-for-session
     * ?sessionId=&providerAccountId=
     *
     * Double-booking check for a whole (recurring) session: returns other meetings
     * already booked on the same provider account that overlap ANY of the session's
     * occurrences. Advisory — the wizard surfaces a warning; it does not block.
     */
    @GetMapping("/meeting/availability-for-session")
    public ResponseEntity<UserScheduleAvailabilityDTO> checkAvailabilityForSession(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam String sessionId,
            @RequestParam String providerAccountId) {
        instituteAccessValidator.validateUserAccess(user, resolveSessionInstituteId(sessionId));
        return ResponseEntity.ok(
                providerService.checkAvailabilityForSession(sessionId, providerAccountId));
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

        // NOTE: BBB join intentionally keeps its original (pre-Zoom) behaviour —
        // client-supplied role, no enrolment gate — to avoid regressing the live
        // BBB feature for institutes not using Zoom. The server-derived-role +
        // enrolment guard (LiveSessionJoinAuthorizer) is applied to the Zoom
        // SDK-join endpoints only. Hardening the BBB path is tracked separately
        // and must be validated against real BBB usage first.

        SessionSchedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new vacademy.io.common.exceptions.VacademyException("Schedule not found: " + scheduleId));

        // Ensure the BBB meeting exists for this schedule. The service holds a
        // pessimistic row lock across the read-meetingId → maybe-call-BBB →
        // persist-meetingId critical section so concurrent first-join requests
        // can't create two separate BBB rooms (the bug that caused
        // "faculty can't see learners until they leave and rejoin").
        CreateMeetingResponseDTO ensured;
        try {
            ensured = providerService.ensureMeetingForSchedule(
                    scheduleId,
                    () -> buildBbbCreateRequest(scheduleId),
                    recreate, role);
        } catch (org.springframework.dao.PessimisticLockingFailureException e) {
            log.warn("[BBB] Lock timeout waiting for in-flight meeting creation on scheduleId={}: {}",
                    scheduleId, e.getMessage());
            return ResponseEntity.status(503).body(Map.of(
                    "error", "Meeting is being created, please retry"));
        }
        String providerMeetingId = ensured.getProviderMeetingId();
        boolean justCreated = ensured.isJustCreated();

        // Re-fetch to pick up any fields the service mutated (linkType,
        // bbbServerId), then resolve the institute for per-institute branding.
        schedule = scheduleRepository.findById(scheduleId).orElse(schedule);
        String instituteId = resolveInstituteId(schedule);

        // Check if the meeting is still running (prevents joining ended meetings).
        // Skip this check if we just created the meeting — BBB reports it as "not running"
        // until the first participant joins, which would cause an infinite recreate loop.
        if (!justCreated) {
            boolean isRunning = bbbMeetingManager.isMeetingRunning(providerMeetingId, null, schedule.getBbbServerId());
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
                providerMeetingId, fullName, user.getUserId(), role, instituteId, schedule.getBbbServerId());

        // Mark attendance with join timestamp.
        // Note: LIVE_SESSION_START is NOT emitted from here. It's dispatched
        // by LiveSessionNotificationProcessor's periodic scan when the
        // schedule's start_time falls in the look-back window — same pattern
        // as LIVE_SESSION_END. That avoids the join-time race (multiple
        // concurrent first-joins all seeing count=0) and keeps lifecycle
        // emissions in one place.
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

                // Decrement active meetings on the server (pool support)
                if (schedule.getBbbServerId() != null) {
                    serverRouter.onMeetingEnded(schedule.getBbbServerId());
                    log.info("[BBB Callback] Decremented active meetings for server {}", schedule.getBbbServerId());
                }

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
        String internalMeetingId = (String) body.get("internalMeetingId");
        String fileId = (String) body.get("fileId");
        String recordingId = (String) body.getOrDefault("recordingId", meetingId);
        long durationSeconds = body.containsKey("durationSeconds")
                ? ((Number) body.get("durationSeconds")).longValue() : 0;
        String startTime = (String) body.getOrDefault("startTime", java.time.Instant.now().toString());
        String recordingType = (String) body.getOrDefault("type", "full");

        log.info("[BBB Recording] Complete upload: meetingId={}, fileId={}, type={}, duration={}s",
                meetingId, fileId, recordingType, durationSeconds);

        // Find schedule by providerMeetingId
        List<SessionSchedule> schedules = scheduleRepository.findByProviderMeetingId(meetingId);
        if (schedules.isEmpty()) {
            log.warn("[BBB Recording] No schedule found for meetingId={}", meetingId);
            return ResponseEntity.ok("No schedule found — recording registered but not linked");
        }

        // Build recording entry. bbbInternalId is what the sync service uses to
        // decide whether a recording has already been uploaded (and therefore
        // whether to ask the heal service to re-run the post-publish hook).
        MeetingRecordingDTO recording = MeetingRecordingDTO.builder()
                .recordingId(recordingId)
                .bbbInternalId(internalMeetingId)
                .fileId(fileId)
                .durationSeconds(durationSeconds)
                .startTime(startTime)
                .providerMeetingId(meetingId)
                .type(recordingType)
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
                // Deduplicate: skip if a recording with the same recordingId already exists
                String finalRecordingId = recordingId;
                boolean alreadyExists = recordings.stream()
                        .anyMatch(r -> finalRecordingId.equals(r.getRecordingId()));
                if (alreadyExists) {
                    log.info("[BBB Recording] Recording {} already exists for scheduleId={}, skipping",
                            recordingId, schedule.getId());
                    continue;
                }
                recordings.add(recording);
                schedule.setProviderRecordingsJson(objectMapper.writeValueAsString(recordings));
                schedule.setLastRecordingSyncAt(new java.util.Date());
                scheduleRepository.save(schedule);
                log.info("[BBB Recording] Saved recording (type={}) for scheduleId={}", recordingType, schedule.getId());

                // Kick off YouTube auto-upload if the institute has connected
                // their channel and not disabled auto-upload. Silent skip
                // otherwise — we don't want post-publish to fail because
                // YouTube isn't set up.
                try {
                    youtubeUploadJobService.autoEnqueueIfEnabled(
                            schedule.getId(), recordingId, fileId);
                } catch (Exception ytEx) {
                    log.warn("[YouTube] Auto-enqueue failed for scheduleId={}: {}",
                            schedule.getId(), ytEx.getMessage());
                }
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

    // ───────────────────────────── Feedback endpoints ─────────────────────────────

    /**
     * Returns the feedback configuration for a schedule.
     * Learner feedback page calls this on mount to decide whether to show the form.
     */
    @GetMapping("meeting/feedback-config")
    public ResponseEntity<?> getFeedbackConfig(
            @RequestParam String scheduleId,
            @org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails user) {
        try {
            // Look up schedule → session
            SessionSchedule schedule = scheduleRepository.findById(scheduleId).orElse(null);
            if (schedule == null) {
                return ResponseEntity.notFound().build();
            }

            var session = liveSessionRepository.findById(schedule.getSessionId()).orElse(null);
            if (session == null) {
                return ResponseEntity.notFound().build();
            }

            // Parse feedback config
            Object feedbackConfig = null;
            if (session.getFeedbackConfigJson() != null && !session.getFeedbackConfigJson().isBlank()) {
                feedbackConfig = objectMapper.readValue(session.getFeedbackConfigJson(), Object.class);
            }

            // Check if user already submitted
            boolean alreadySubmitted = liveSessionLogsRepository.hasFeedbackBeenSubmitted(
                    scheduleId, user.getUserId());

            // Get institute branding
            String instituteName = null;
            String instituteLogo = null;
            if (session.getInstituteId() != null) {
                var institute = instituteRepository.findById(session.getInstituteId()).orElse(null);
                if (institute != null) {
                    instituteName = institute.getInstituteName();
                    if (institute.getLogoFileId() != null && !institute.getLogoFileId().isBlank()) {
                        instituteLogo = institute.getLogoFileId();
                    }
                }
            }

            var response = vacademy.io.admin_core_service.features.live_session.dto.FeedbackConfigResponseDTO.builder()
                    .feedbackConfig(feedbackConfig)
                    .alreadySubmitted(alreadySubmitted)
                    .sessionTitle(session.getTitle())
                    .instituteName(instituteName)
                    .instituteLogo(instituteLogo)
                    .build();

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("[Feedback] Failed to get feedback config for schedule {}", scheduleId, e);
            return ResponseEntity.internalServerError().body("Failed to get feedback config");
        }
    }

    /**
     * Submits learner feedback for a session.
     * Creates a FEEDBACK_SUBMITTED entry in live_session_logs.
     * Prevents duplicate submissions.
     */
    @PostMapping("meeting/feedback")
    public ResponseEntity<?> submitFeedback(
            @RequestBody vacademy.io.admin_core_service.features.live_session.dto.FeedbackSubmitRequestDTO request,
            @org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails user) {
        try {
            String scheduleId = request.getScheduleId();
            if (scheduleId == null || scheduleId.isBlank()) {
                return ResponseEntity.badRequest().body("scheduleId is required");
            }

            // Look up schedule → session
            SessionSchedule schedule = scheduleRepository.findById(scheduleId).orElse(null);
            if (schedule == null) {
                return ResponseEntity.notFound().build();
            }

            String sessionId = schedule.getSessionId();

            // Prevent duplicate submissions
            if (liveSessionLogsRepository.hasFeedbackBeenSubmitted(scheduleId, user.getUserId())) {
                return ResponseEntity.ok(Map.of("status", "already_submitted",
                        "message", "Feedback already submitted for this session"));
            }

            // Enforce compulsory feedback: when allow_skip is explicitly false, every
            // enabled+mandatory question must have a non-empty answer. The frontend
            // hides the skip button using the same flag — this is the server backstop.
            var sessionForValidation = liveSessionRepository.findById(sessionId).orElse(null);
            if (sessionForValidation != null
                    && sessionForValidation.getFeedbackConfigJson() != null
                    && !sessionForValidation.getFeedbackConfigJson().isBlank()) {
                try {
                    var feedbackConfig = objectMapper.readValue(
                            sessionForValidation.getFeedbackConfigJson(),
                            vacademy.io.admin_core_service.features.live_session.dto.LiveSessionStep1RequestDTO.FeedbackConfigDTO.class);
                    if (feedbackConfig != null
                            && Boolean.FALSE.equals(feedbackConfig.getAllowSkip())
                            && feedbackConfig.getQuestions() != null) {
                        Map<String, Object> responses = request.getResponses() != null
                                ? request.getResponses()
                                : Map.of();
                        for (var question : feedbackConfig.getQuestions()) {
                            if (!Boolean.TRUE.equals(question.getEnabled())) continue;
                            if (!Boolean.TRUE.equals(question.getMandatory())) continue;
                            Object answer = responses.get(question.getId());
                            boolean missing = answer == null
                                    || (answer instanceof String s && s.isBlank());
                            if (missing) {
                                return ResponseEntity.badRequest().body(Map.of(
                                        "status", "validation_failed",
                                        "message", "Mandatory feedback question must be answered: " + question.getLabel(),
                                        "questionId", question.getId()));
                            }
                        }
                    }
                } catch (Exception e) {
                    // Don't block submission on a parse failure — log and accept.
                    log.warn("[Feedback] Could not parse feedback config for validation on schedule {}: {}",
                            scheduleId, e.getMessage());
                }
            }

            // Serialize responses to JSON
            String responsesJson = objectMapper.writeValueAsString(request.getResponses());

            // Create the feedback log entry
            LiveSessionLogs feedbackLog = LiveSessionLogs.builder()
                    .sessionId(sessionId)
                    .scheduleId(scheduleId)
                    .userSourceType("USER")
                    .userSourceId(user.getUserId())
                    .logType(SessionLog.FEEDBACK_SUBMITTED.name())
                    .status("SUBMITTED")
                    .statusType("ONLINE")
                    .details(responsesJson)
                    .createdAt(new Timestamp(System.currentTimeMillis()))
                    .updatedAt(new Timestamp(System.currentTimeMillis()))
                    .build();

            liveSessionLogsRepository.save(feedbackLog);

            return ResponseEntity.ok(Map.of("status", "success",
                    "message", "Feedback submitted successfully"));
        } catch (Exception e) {
            log.error("[Feedback] Failed to submit feedback", e);
            return ResponseEntity.internalServerError().body("Failed to submit feedback");
        }
    }

    // -----------------------------------------------------------------------
    // Helpers for /meeting/join
    // -----------------------------------------------------------------------

    /**
     * Builds the BBB create-meeting request for a given schedule, pulling
     * sessionTitle/instituteId/bbbConfig from the parent live_session row and
     * falling back to the schedule's defaultClassName for the topic. Invoked
     * lazily by {@link LiveSessionProviderService#ensureMeetingForSchedule} —
     * only on the race-winner path where a fresh BBB /create is needed.
     */
    private ProviderMeetingCreateRequestDTO buildBbbCreateRequest(String scheduleId) {
        SessionSchedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new vacademy.io.common.exceptions.VacademyException("Schedule not found: " + scheduleId));

        String sessionTitle = "Live Class";
        String instituteId = null;
        java.util.Map<String, Object> bbbConfig = null;

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

        return ProviderMeetingCreateRequestDTO.builder()
                .instituteId(instituteId)
                .sessionId(schedule.getSessionId())
                .scheduleId(scheduleId)
                .topic(sessionTitle)
                .provider(MeetingProvider.BBB_MEETING.name())
                .durationMinutes(120)
                .bbbConfig(bbbConfig)
                .build();
    }

    /**
     * Resolves the instituteId for a schedule by walking through its parent
     * live_session row. Used to apply per-institute branding (theme color, etc.)
     * to the generated join URL.
     */
    private String resolveInstituteId(SessionSchedule schedule) {
        if (schedule == null || schedule.getSessionId() == null) {
            return null;
        }
        return liveSessionRepository.findById(schedule.getSessionId())
                .map(s -> s.getInstituteId())
                .orElse(null);
    }

    /** Resolves the owning institute for a live_session id (for cross-tenant authz). */
    private String resolveSessionInstituteId(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            return null;
        }
        return liveSessionRepository.findById(sessionId)
                .map(s -> s.getInstituteId())
                .orElse(null);
    }
}

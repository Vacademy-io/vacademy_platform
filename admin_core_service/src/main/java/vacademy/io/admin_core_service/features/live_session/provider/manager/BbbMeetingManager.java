package vacademy.io.admin_core_service.features.live_session.provider.manager;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.live_session.provider.LiveSessionProviderStrategy;
import vacademy.io.admin_core_service.features.live_session.provider.entity.BbbServerPool;
import vacademy.io.admin_core_service.features.live_session.provider.entity.LiveSessionProviderConfig;
import vacademy.io.admin_core_service.features.live_session.provider.dto.ProviderConnectRequestDTO;
import vacademy.io.admin_core_service.features.live_session.provider.repository.LiveSessionProviderConfigRepository;
import vacademy.io.admin_core_service.features.live_session.provider.service.BbbServerRouter;
import vacademy.io.admin_core_service.features.media_service.service.MediaService;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.common.meeting.dto.*;
import vacademy.io.common.meeting.enums.MeetingProvider;

import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

/**
 * BigBlueButton implementation of LiveSessionProviderStrategy.
 *
 * BBB uses a REST API with SHA-256 checksum authentication.
 * API reference: https://docs.bigbluebutton.org/development/api/
 *
 * Multi-server support: When a BbbServerRouter is available, meeting creation
 * uses sequential-fill routing across the server pool. Join/recording/attendance
 * operations resolve the server from the schedule's bbbServerId field.
 *
 * Config stored in configJson (legacy, per-institute):
 * {
 * "apiUrl": "https://meet.vacademy.io/bigbluebutton/api",
 * "secret": "shared-secret-here"
 * }
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class BbbMeetingManager implements LiveSessionProviderStrategy {

    private final ObjectMapper objectMapper;
    private final LiveSessionProviderConfigRepository configRepository;
    private final WebClient.Builder webClientBuilder;
    private final InstituteRepository instituteRepository;
    private final MediaService mediaService;
    private final BbbServerRouter serverRouter;

    @Value("${tool.executor.base-url:http://localhost}")
    private String backendBaseUrl;

    /** Public URL reachable from the BBB server (for callbacks). */
    @Value("${bbb.callback.base-url:${tool.executor.base-url:http://localhost}}")
    private String bbbCallbackBaseUrl;

    /**
     * Kill-switch for the self-hosted Picture-in-Picture HTML5 plugin (webcams +
     * screen-share in a floating window). Default on; set bbb.plugins.pip.enabled=false
     * to disable platform-wide without a redeploy. The bundle is hosted on each BBB
     * server at https://<host>/plugins/picture-in-picture/manifest.json (see
     * bigbluebutton-server repo: plugins/ + install-recording-hook.sh + sync).
     */
    @Value("${bbb.plugins.pip.enabled:true}")
    private boolean pipPluginEnabled;

    private static final List<String> ACTIVE = List.of("ACTIVE");

    @Override
    public String getProviderName() {
        return MeetingProvider.BBB_MEETING.name();
    }

    // -----------------------------------------------------------------------
    // Connect (store API URL + secret)
    // -----------------------------------------------------------------------

    @Override
    public LiveSessionProviderConfig connectProvider(ProviderConnectRequestDTO request) {
        String provider = MeetingProvider.BBB_MEETING.name();

        // For BBB, clientId = apiUrl, clientSecret = shared secret
        Map<String, Object> configMap = new HashMap<>();
        configMap.put("apiUrl", request.getClientId());
        configMap.put("secret", request.getClientSecret());

        String configJson;
        try {
            configJson = objectMapper.writeValueAsString(configMap);
        } catch (Exception e) {
            throw new VacademyException("Failed to serialize BBB config");
        }

        // BBB is Vacademy-level (instituteId can be null)
        Optional<LiveSessionProviderConfig> existing = request.getInstituteId() != null
                ? configRepository.findByInstituteIdAndProviderAndStatusIn(request.getInstituteId(), provider, ACTIVE)
                : configRepository.findByProviderAndStatusIn(provider, ACTIVE);

        LiveSessionProviderConfig config;
        if (existing.isPresent()) {
            config = existing.get();
            config.setConfigJson(configJson);
            config.setUpdatedAt(new Date());
        } else {
            config = LiveSessionProviderConfig.builder()
                    .instituteId(request.getInstituteId())
                    .provider(provider)
                    .configJson(configJson)
                    .status("ACTIVE")
                    .build();
        }

        return configRepository.save(config);
    }

    @Override
    public ParticipantJoinLinkDTO getParticipantJoinLink(String providerMeetingId, String participantName,
            String participantEmail, String instituteId) {
        String joinUrl = buildJoinUrlForUser(providerMeetingId, participantName, participantEmail, "VIEWER",
                instituteId);
        return ParticipantJoinLinkDTO.builder()
                .joinLink(joinUrl)
                .participantName(participantName)
                .participantEmail(participantEmail)
                .providerMeetingId(providerMeetingId)
                .build();
    }

    // -----------------------------------------------------------------------
    // Create meeting
    // -----------------------------------------------------------------------

    @Override
    public CreateMeetingResponseDTO createMeeting(CreateMeetingRequestDTO request, String instituteId) {
        // Use server pool router for meeting placement
        BbbServerPool selectedServer = null;
        String apiUrl;
        String secret;

        try {
            selectedServer = serverRouter.pickServer();
            apiUrl = selectedServer.getApiUrl();
            secret = selectedServer.getSecret();
            log.info("[BBB] Routed meeting to server: {} ({})", selectedServer.getSlug(), selectedServer.getDomain());
        } catch (Exception e) {
            // Fallback to legacy config if router fails (e.g., empty pool table)
            log.warn("[BBB] Server pool routing failed, falling back to legacy config: {}", e.getMessage());
            Map<String, Object> cfg = getConfigMap(instituteId);
            apiUrl = (String) cfg.get("apiUrl");
            secret = (String) cfg.get("secret");
        }

        String meetingId = UUID.randomUUID().toString();

        // Fetch institute branding
        String instituteName = "Live Class";
        String themeColor = null;
        String logoUrl = null;
        String learnerBaseUrl = null;
        if (instituteId != null) {
            try {
                Institute institute = instituteRepository.findById(instituteId).orElse(null);
                if (institute != null) {
                    if (institute.getInstituteName() != null && !institute.getInstituteName().isBlank()) {
                        instituteName = institute.getInstituteName();
                    }
                    if (institute.getInstituteThemeCode() != null && !institute.getInstituteThemeCode().isBlank()) {
                        themeColor = institute.getInstituteThemeCode();
                    }
                    if (institute.getLogoFileId() != null && !institute.getLogoFileId().isBlank()) {
                        logoUrl = mediaService.getFilePublicUrlByIdWithoutExpiry(institute.getLogoFileId());
                    }
                    if (institute.getLearnerPortalBaseUrl() != null && !institute.getLearnerPortalBaseUrl().isBlank()) {
                        learnerBaseUrl = institute.getLearnerPortalBaseUrl();
                        if (!learnerBaseUrl.startsWith("http")) {
                            learnerBaseUrl = "https://" + learnerBaseUrl;
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("[BBB] Failed to fetch institute branding for {}: {}", instituteId, e.getMessage());
            }
        }

        // Read BBB config from request (admin-set options). resolveProviderConfig()
        // prefers the generic providerConfig and falls back to the legacy bbbConfig.
        // Keys are snake_case because BbbConfigDTO uses @JsonNaming(SnakeCaseStrategy)
        Map<String, Object> bbbCfg = request.resolveProviderConfig() != null ? request.resolveProviderConfig() : Map.of();
        boolean record = boolOrDefault(bbbCfg, "record", true);
        boolean autoStartRec = boolOrDefault(bbbCfg, "auto_start_recording", true);
        boolean muteOnStart = boolOrDefault(bbbCfg, "mute_on_start", true);
        boolean webcamsOnlyForMod = boolOrDefault(bbbCfg, "webcams_only_for_moderator", false);
        String guestPolicy = bbbCfg.containsKey("guest_policy") ? String.valueOf(bbbCfg.get("guest_policy"))
                : "ALWAYS_ACCEPT";
        // Webcam caps protect server CPU/bandwidth on large classes (cameras scale
        // exponentially: 20 cams ≈ 400 streams). Defaults: max 20 simultaneous cameras
        // per meeting, max 3 per user. 0 disables the respective cap. Admin-overridable
        // via the provider config keys below.
        int meetingCameraCap = intOrDefault(bbbCfg, "meeting_camera_cap", 20);
        int userCameraCap = intOrDefault(bbbCfg, "user_camera_cap", 3);

        Map<String, String> params = new LinkedHashMap<>();
        params.put("name", request.getTopic() != null ? request.getTopic() : instituteName + " Live Class");
        params.put("meetingID", meetingId);
        params.put("record", String.valueOf(record));
        params.put("autoStartRecording", String.valueOf(autoStartRec));
        params.put("allowStartStopRecording", "true");
        params.put("muteOnStart", String.valueOf(muteOnStart));
        params.put("webcamsOnlyForModerator", String.valueOf(webcamsOnlyForMod));
        params.put("meetingCameraCap", String.valueOf(meetingCameraCap));
        params.put("userCameraCap", String.valueOf(userCameraCap));
        params.put("guestPolicy", guestPolicy);
        params.put("welcome", "");

        // Institute branding
        if (logoUrl != null) {
            params.put("logo", logoUrl);
        }
        if (themeColor != null) {
            params.put("bannerColor", themeColor);
        }
        params.put("bannerText", instituteName);

        // Whitelabeling: disable default BBB presentation (removes "Welcome to
        // BigBlueButton" slide)
        params.put("preUploadedPresentationOverrideDefault", "true");

        // Whitelabeling: set custom copyright/branding text
        params.put("copyright", "\u00A9 " + instituteName);

        // Whitelabeling: metadata for client-side branding
        params.put("meta_bbb-origin-server-name", instituteName);
        params.put("meta_bbb-origin", instituteName);

        // Redirect students to the feedback page when meeting ends.
        // If feedback is disabled for this session, the page auto-redirects to the listing.
        if (learnerBaseUrl != null && request.getScheduleId() != null) {
            String feedbackUrl = learnerBaseUrl + "/study-library/live-class/feedback?scheduleId=" + request.getScheduleId();
            params.put("logoutURL", feedbackUrl);
            params.put("meetingEndedURL", feedbackUrl);
        } else if (learnerBaseUrl != null) {
            params.put("logoutURL", learnerBaseUrl + "/study-library/live-class");
            params.put("meetingEndedURL", learnerBaseUrl + "/study-library/live-class");
        }

        // BBB hard-stops a meeting after `duration` minutes (BBB shows "X minutes left"
        // warnings near the end, then ends it). Add a 30-minute buffer beyond the chosen/
        // scheduled length so a class is never cut short, while still giving BBB a bound
        // so the recording pipeline reliably kicks off.
        if (request.getDurationMinutes() > 0) {
            params.put("duration", String.valueOf(request.getDurationMinutes() + 30));
        }

        // Guard: if bbbCallbackBaseUrl is localhost the BBB server (Hetzner) can never
        // reach it — callbacks will silently fail. Log a loud error so it's caught early.
        if (bbbCallbackBaseUrl.contains("localhost")) {
            log.error("[BBB] CRITICAL: bbb.callback.base-url='{}' — BBB callbacks will FAIL from external server! "
                    + "Set BBB_CALLBACK_BASE_URL or ADMIN_CORE_SERVICE_BASE_URL env var.", bbbCallbackBaseUrl);
        }

        // Set end callback URL so BBB notifies us when the meeting ends.
        // Uses bbbCallbackBaseUrl (public URL) since BBB server is external.
        if (request.getScheduleId() != null) {
            String callbackUrl = bbbCallbackBaseUrl
                    + "/admin-core-service/live-sessions/provider/meeting/bbb-callback?scheduleId="
                    + request.getScheduleId();
            params.put("meta_endCallbackUrl", callbackUrl);

            // Analytics callback — BBB POSTs per-attendee duration & engagement data after meeting ends
            String analyticsCallbackUrl = bbbCallbackBaseUrl
                    + "/admin-core-service/live-sessions/provider/meeting/bbb-analytics-callback?scheduleId="
                    + request.getScheduleId();
            params.put("meta_analytics-callback-url", analyticsCallbackUrl);
        }

        // Retain event data so BBB can send analytics callback after meeting ends
        params.put("keepEvents", "true");

        // HTML5 Picture-in-Picture plugin (webcams + screen-share in a floating window).
        // The bundle is self-hosted on the routed BBB server, so derive the manifest URL
        // from that server's apiUrl (strip "/bigbluebutton/api"). Relative entrypoints in
        // the manifest keep it domain-agnostic across the pool. buildQueryString() URL-encodes
        // the JSON value. Toggle off via bbb.plugins.pip.enabled=false.
        if (pipPluginEnabled) {
            String bbbBaseUrl = apiUrl.replaceAll("/bigbluebutton/api/?$", "");
            String pipManifestUrl = bbbBaseUrl + "/plugins/picture-in-picture/manifest.json";
            params.put("pluginManifests", "[{\"url\":\"" + pipManifestUrl + "\"}]");
        }

        String queryString = buildQueryString(params);
        String checksum = sha256("create" + queryString + secret);
        String url = apiUrl + "/create?" + queryString + "&checksum=" + checksum;

        // Build XML body with custom presentation (institute logo as slide, replaces
        // BBB default)
        String xmlBody = null;
        if (logoUrl != null) {
            xmlBody = "<?xml version='1.0' encoding='UTF-8'?>"
                    + "<modules><module name='presentation'>"
                    + "<document url='" + logoUrl + "' filename='welcome.png'/>"
                    + "</module></modules>";
        }

        // Use POST with XML body if we have a custom presentation, otherwise GET
        String xmlResponse;
        if (xmlBody != null) {
            final String body = xmlBody;
            xmlResponse = webClientBuilder.build()
                    .post().uri(URI.create(url))
                    .header("Content-Type", "application/xml")
                    .bodyValue(body)
                    .retrieve()
                    .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(),
                            resp -> resp.bodyToMono(String.class).map(respBody -> {
                                log.error("[BBB] Create meeting failed: {}", respBody);
                                return new VacademyException("BBB create meeting error: " + respBody);
                            }))
                    .bodyToMono(String.class)
                    .block();
        } else {
            xmlResponse = webClientBuilder.build()
                    .get().uri(URI.create(url))
                    .retrieve()
                    .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(),
                            resp -> resp.bodyToMono(String.class).map(respBody -> {
                                log.error("[BBB] Create meeting failed: {}", respBody);
                                return new VacademyException("BBB create meeting error: " + respBody);
                            }))
                    .bodyToMono(String.class)
                    .block();
        }

        Document doc = parseXml(xmlResponse);
        String returnCode = getXmlText(doc, "returncode");
        if (!"SUCCESS".equals(returnCode)) {
            String msg = getXmlText(doc, "message");
            throw new VacademyException("BBB create meeting failed: " + msg);
        }

        String bbbMeetingId = getXmlText(doc, "meetingID");
        String internalMeetingId = getXmlText(doc, "internalMeetingID");

        // Generic fallback join URLs. These are NOT the path real users take —
        // learners/hosts join via buildJoinUrlForUser (through /meeting/join), which
        // sets their real name + unique userId. We pass a null userID here (instead of
        // the old shared "attendee-id"/"moderator-id") so that IF this fallback URL ever
        // leaks into a real join, BBB assigns each joiner a unique internal id and they
        // don't eject one another via maxUserConcurrentAccesses. The name stays generic
        // because a stored, shared URL cannot know who is joining.
        String moderatorJoinUrl = buildJoinUrl(apiUrl, secret, bbbMeetingId, "Moderator", null, "MODERATOR");
        String attendeeJoinUrl = buildJoinUrl(apiUrl, secret, bbbMeetingId, "Attendee", null, "VIEWER");

        Map<String, Object> raw = new HashMap<>();
        raw.put("meetingID", bbbMeetingId);
        raw.put("internalMeetingID", internalMeetingId);

        // Track which server this meeting is on
        if (selectedServer != null) {
            raw.put("bbbServerId", selectedServer.getId());
            raw.put("bbbServerSlug", selectedServer.getSlug());
            serverRouter.onMeetingCreated(selectedServer.getId());
        }

        return CreateMeetingResponseDTO.builder()
                .providerMeetingId(bbbMeetingId)
                .joinUrl(attendeeJoinUrl)
                .hostUrl(moderatorJoinUrl)
                .provider(MeetingProvider.BBB_MEETING)
                .rawResponse(raw)
                .build();
    }

    /**
     * Build a personalized join URL for a specific user.
     * This is called by the join endpoint to create per-user URLs.
     */
    public String buildJoinUrl(String apiUrl, String secret, String meetingId,
            String fullName, String userId, String role) {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("meetingID", meetingId);
        params.put("fullName", fullName);
        // Only send userID when we have a real per-user id. For the generic
        // fallback URLs (see createMeeting) we pass null so BBB assigns a unique
        // internal id per joiner — a shared userID would trip maxUserConcurrentAccesses
        // and eject learners who ever land on the fallback URL.
        if (userId != null && !userId.isBlank()) {
            params.put("userID", userId);
        }
        params.put("role", role);
        params.put("redirect", "true");

        String queryString = buildQueryString(params);
        String checksum = sha256("join" + queryString + secret);
        return apiUrl + "/join?" + queryString + "&checksum=" + checksum;
    }

    /**
     * Build a personalized join URL using stored config.
     * Public method used by the controller for per-user join URLs.
     * Includes per-institute branding via userdata parameters.
     */
    public String buildJoinUrlForUser(String meetingId, String fullName,
            String userId, String role, String instituteId) {
        return buildJoinUrlForUser(meetingId, fullName, userId, role, instituteId, null);
    }

    /**
     * Build a personalized join URL. Uses the schedule's assigned server if available,
     * otherwise falls back to legacy config.
     */
    public String buildJoinUrlForUser(String meetingId, String fullName,
            String userId, String role, String instituteId, String bbbServerId) {
        String apiUrl;
        String secret;
        if (bbbServerId != null) {
            try {
                BbbServerPool server = serverRouter.getServer(bbbServerId);
                apiUrl = server.getApiUrl();
                secret = server.getSecret();
            } catch (Exception e) {
                log.warn("[BBB] Failed to resolve server {}, falling back to legacy config", bbbServerId);
                Map<String, Object> cfg = getConfigMap(instituteId);
                apiUrl = (String) cfg.get("apiUrl");
                secret = (String) cfg.get("secret");
            }
        } else {
            Map<String, Object> cfg = getConfigMap(instituteId);
            apiUrl = (String) cfg.get("apiUrl");
            secret = (String) cfg.get("secret");
        }

        // Build base join params
        Map<String, String> params = new LinkedHashMap<>();
        params.put("meetingID", meetingId);
        params.put("fullName", fullName);
        params.put("userID", userId);
        params.put("role", role);
        params.put("redirect", "true");

        // Per-institute theming via userdata params
        if (instituteId != null) {
            try {
                Institute institute = instituteRepository.findById(instituteId).orElse(null);
                if (institute != null && institute.getInstituteThemeCode() != null
                        && !institute.getInstituteThemeCode().isBlank()) {
                    String color = institute.getInstituteThemeCode();
                    // Inject institute theme color as CSS custom properties.
                    // BBB 3.0 uses --color-primary as the main accent (palette.js).
                    // We also override button states for a complete theme.
                    String css = ":root{"
                            + "--color-primary:" + color + ";"
                            + "--color-link:" + color + ";"
                            + "--btn-primary-bg:" + color + ";"
                            + "}";
                    params.put("userdata-bbb_custom_style", css);

                    // Skip the "Microphone / Listen only" chooser and echo test
                    params.put("userdata-bbb_auto_join_audio", "true");
                    params.put("userdata-bbb_skip_check_audio", "true");
                    params.put("userdata-bbb_listen_only_mode", "false");
                    // Transparent listen-only (BBB 3.0): a muted/idle student stays on the
                    // cheap shared-audio path instead of holding a FreeSWITCH mic channel,
                    // yet can unmute instantly. This keeps the no-prompt auto-join UX above
                    // while preventing the "N silent mics = N hot channels" CPU blowup.
                    // Forced on per-meeting in case the server default is off/regressed.
                    params.put("userdata-bbb_transparent_listen_only", "true");

                    // Hide the Session Details welcome popup (BBB 3.0+)
                    params.put("userdata-bbb_show_session_details_on_join", "false");
                }
            } catch (Exception e) {
                log.warn("[BBB] Failed to fetch institute theme for join URL: {}", e.getMessage());
            }
        }

        String queryString = buildQueryString(params);
        String checksum = sha256("join" + queryString + secret);
        return apiUrl + "/join?" + queryString + "&checksum=" + checksum;
    }

    // -----------------------------------------------------------------------
    // Check if meeting is running
    // -----------------------------------------------------------------------

    /**
     * Calls BBB's isMeetingRunning API to check if the meeting is still active.
     * Returns false if the meeting was force-ended or never started.
     */
    public boolean isMeetingRunning(String meetingId, String instituteId) {
        return isMeetingRunning(meetingId, instituteId, null);
    }

    /**
     * Check if meeting is running. Uses the schedule's assigned server if available.
     */
    public boolean isMeetingRunning(String meetingId, String instituteId, String bbbServerId) {
        try {
            String apiUrl;
            String secret;
            if (bbbServerId != null) {
                try {
                    BbbServerPool server = serverRouter.getServer(bbbServerId);
                    apiUrl = server.getApiUrl();
                    secret = server.getSecret();
                } catch (Exception e) {
                    Map<String, Object> cfg = getConfigMap(instituteId);
                    apiUrl = (String) cfg.get("apiUrl");
                    secret = (String) cfg.get("secret");
                }
            } else {
                Map<String, Object> cfg = getConfigMap(instituteId);
                apiUrl = (String) cfg.get("apiUrl");
                secret = (String) cfg.get("secret");
            }

            Map<String, String> params = new LinkedHashMap<>();
            params.put("meetingID", meetingId);

            String queryString = buildQueryString(params);
            String checksum = sha256("isMeetingRunning" + queryString + secret);
            String url = apiUrl + "/isMeetingRunning?" + queryString + "&checksum=" + checksum;

            String xmlResponse = webClientBuilder.build()
                    .get().uri(URI.create(url))
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            Document doc = parseXml(xmlResponse);
            String returnCode = getXmlText(doc, "returncode");
            if (!"SUCCESS".equals(returnCode)) {
                return false;
            }
            String running = getXmlText(doc, "running");
            return "true".equalsIgnoreCase(running);
        } catch (Exception e) {
            log.warn("[BBB] isMeetingRunning check failed for meetingId={}: {}", meetingId, e.getMessage());
            return false;
        }
    }

    // -----------------------------------------------------------------------
    // Get recordings
    // -----------------------------------------------------------------------

    @Override
    public List<MeetingRecordingDTO> getRecordings(String providerMeetingId, String instituteId) {
        return getRecordings(providerMeetingId, instituteId, null);
    }

    /**
     * Get recordings from the correct server. Uses bbbServerId if available.
     */
    public List<MeetingRecordingDTO> getRecordings(String providerMeetingId, String instituteId, String bbbServerId) {
        String apiUrl;
        String secret;
        if (bbbServerId != null) {
            try {
                BbbServerPool server = serverRouter.getServer(bbbServerId);
                apiUrl = server.getApiUrl();
                secret = server.getSecret();
            } catch (Exception e) {
                Map<String, Object> cfg = getConfigMap(instituteId);
                apiUrl = (String) cfg.get("apiUrl");
                secret = (String) cfg.get("secret");
            }
        } else {
            Map<String, Object> cfg = getConfigMap(instituteId);
            apiUrl = (String) cfg.get("apiUrl");
            secret = (String) cfg.get("secret");
        }

        Map<String, String> params = new LinkedHashMap<>();
        params.put("meetingID", providerMeetingId);

        String queryString = buildQueryString(params);
        String checksum = sha256("getRecordings" + queryString + secret);
        String url = apiUrl + "/getRecordings?" + queryString + "&checksum=" + checksum;

        String xmlResponse;
        try {
            xmlResponse = webClientBuilder.build()
                    .get().uri(URI.create(url))
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
        } catch (Exception e) {
            log.warn("[BBB] getRecordings failed for meetingId={}: {}", providerMeetingId, e.getMessage());
            return List.of();
        }

        Document doc = parseXml(xmlResponse);
        if (!"SUCCESS".equals(getXmlText(doc, "returncode"))) {
            log.warn("[BBB] getRecordings returned non-SUCCESS for meetingId={}", providerMeetingId);
            return List.of();
        }

        List<MeetingRecordingDTO> recordings = new ArrayList<>();
        NodeList recordingNodes = doc.getElementsByTagName("recording");
        for (int i = 0; i < recordingNodes.getLength(); i++) {
            Element rec = (Element) recordingNodes.item(i);
            String recordId = getChildText(rec, "recordID");
            long startTimeMs = Long.parseLong(getChildText(rec, "startTime", "0"));
            long endTimeMs = Long.parseLong(getChildText(rec, "endTime", "0"));
            long durationSecs = (endTimeMs - startTimeMs) / 1000;
            String startTimeIso = new Date(startTimeMs).toInstant().toString();

            // BBB's getRecordings only advertises the HTML playback page as a format
            // (type=presentation, url=https://.../playback/presentation/...). The actual
            // MP4 files are produced and uploaded to S3 by our post-publish hook on the
            // BBB server, not exposed by BBB's API. So we emit a single metadata-only
            // DTO (no downloadable URL) — recovery of missing MP4s requires re-running
            // the post-publish hook on the BBB host, not this sync endpoint.
            recordings.add(MeetingRecordingDTO.builder()
                    .recordingId(recordId)
                    .bbbInternalId(recordId)
                    .durationSeconds(durationSecs)
                    .startTime(startTimeIso)
                    .providerMeetingId(providerMeetingId)
                    .build());
        }
        return recordings;
    }

    // -----------------------------------------------------------------------
    // Delete recording from BBB server
    // -----------------------------------------------------------------------

    /**
     * Calls BBB's deleteRecordings API to remove a recording from the BBB server.
     * Only deletes from BBB — S3/Vacademy file storage is untouched.
     *
     * @param recordingId BBB recordID (e.g. "abc123-content")
     * @param bbbServerId pool server ID to route to (null = legacy config)
     * @return true if BBB confirmed deletion, false if it failed or was not found
     */
    public boolean deleteRecording(String recordingId, String bbbServerId) {
        String apiUrl;
        String secret;
        if (bbbServerId != null) {
            try {
                BbbServerPool server = serverRouter.getServer(bbbServerId);
                apiUrl = server.getApiUrl();
                secret = server.getSecret();
            } catch (Exception e) {
                log.warn("[BBB] deleteRecording: failed to resolve server {}, falling back to legacy config", bbbServerId);
                Map<String, Object> cfg = getConfigMap(null);
                apiUrl = (String) cfg.get("apiUrl");
                secret = (String) cfg.get("secret");
            }
        } else {
            Map<String, Object> cfg = getConfigMap(null);
            apiUrl = (String) cfg.get("apiUrl");
            secret = (String) cfg.get("secret");
        }

        Map<String, String> params = new LinkedHashMap<>();
        params.put("recordID", recordingId);

        String queryString = buildQueryString(params);
        String checksum = sha256("deleteRecordings" + queryString + secret);
        String url = apiUrl + "/deleteRecordings?" + queryString + "&checksum=" + checksum;

        try {
            String xmlResponse = webClientBuilder.build()
                    .get().uri(URI.create(url))
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            Document doc = parseXml(xmlResponse);
            String returnCode = getXmlText(doc, "returncode");
            if ("SUCCESS".equals(returnCode)) {
                log.info("[BBB] Deleted recording {} from BBB server", recordingId);
                return true;
            } else {
                String msg = getXmlText(doc, "message");
                log.warn("[BBB] deleteRecordings returned non-SUCCESS for recordingId={}: {}", recordingId, msg);
                return false;
            }
        } catch (Exception e) {
            log.warn("[BBB] deleteRecording failed for recordingId={}: {}", recordingId, e.getMessage());
            return false;
        }
    }

    // -----------------------------------------------------------------------
    // Get attendance (via getMeetingInfo)
    // -----------------------------------------------------------------------

    @Override
    public List<MeetingAttendeeDTO> getAttendance(String providerMeetingId, String instituteId) {
        return getAttendance(providerMeetingId, instituteId, null);
    }

    /**
     * Get attendance from the correct server. Uses bbbServerId if available.
     */
    public List<MeetingAttendeeDTO> getAttendance(String providerMeetingId, String instituteId, String bbbServerId) {
        String apiUrl;
        String secret;
        if (bbbServerId != null) {
            try {
                BbbServerPool server = serverRouter.getServer(bbbServerId);
                apiUrl = server.getApiUrl();
                secret = server.getSecret();
            } catch (Exception e) {
                Map<String, Object> cfg = getConfigMap(instituteId);
                apiUrl = (String) cfg.get("apiUrl");
                secret = (String) cfg.get("secret");
            }
        } else {
            Map<String, Object> cfg = getConfigMap(instituteId);
            apiUrl = (String) cfg.get("apiUrl");
            secret = (String) cfg.get("secret");
        }

        Map<String, String> params = new LinkedHashMap<>();
        params.put("meetingID", providerMeetingId);

        String queryString = buildQueryString(params);
        String checksum = sha256("getMeetingInfo" + queryString + secret);
        String url = apiUrl + "/getMeetingInfo?" + queryString + "&checksum=" + checksum;

        String xmlResponse;
        try {
            xmlResponse = webClientBuilder.build()
                    .get().uri(URI.create(url))
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
        } catch (Exception e) {
            log.warn("[BBB] getMeetingInfo failed for meetingId={}: {}", providerMeetingId, e.getMessage());
            return List.of();
        }

        Document doc = parseXml(xmlResponse);
        if (!"SUCCESS".equals(getXmlText(doc, "returncode"))) {
            log.warn("[BBB] getMeetingInfo returned non-SUCCESS for meetingId={}", providerMeetingId);
            return List.of();
        }

        List<MeetingAttendeeDTO> attendees = new ArrayList<>();
        NodeList attendeeNodes = doc.getElementsByTagName("attendee");
        for (int i = 0; i < attendeeNodes.getLength(); i++) {
            Element att = (Element) attendeeNodes.item(i);
            attendees.add(MeetingAttendeeDTO.builder()
                    .name(getChildText(att, "fullName", ""))
                    .email(getChildText(att, "userID", ""))
                    .joinTime(null)
                    .leaveTime(null)
                    .durationMinutes(0)
                    .build());
        }
        return attendees;
    }

    @Override
    public UserScheduleAvailabilityDTO checkUserAvailability(
            String requestedStartTimeIso, int durationMinutes, String instituteId, String vendorUserId) {
        // BBB does not track user schedules — always available
        return UserScheduleAvailabilityDTO.builder()
                .available(true)
                .conflicts(List.of())
                .build();
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    /**
     * Load BBB config. For BBB, config is Vacademy-level (instituteId may be null).
     */
    Map<String, Object> getConfigMap(String instituteId) {
        Optional<LiveSessionProviderConfig> config;
        String provider = MeetingProvider.BBB_MEETING.name();

        // Try institute-specific first, then fall back to Vacademy-level (null
        // instituteId)
        if (instituteId != null) {
            config = configRepository.findByInstituteIdAndProviderAndStatusIn(instituteId, provider, ACTIVE);
            if (config.isEmpty()) {
                config = configRepository.findByProviderAndStatusIn(provider, ACTIVE);
            }
        } else {
            config = configRepository.findByProviderAndStatusIn(provider, ACTIVE);
        }

        if (config.isEmpty()) {
            throw new VacademyException("BBB provider not configured");
        }

        try {
            return objectMapper.readValue(config.get().getConfigJson(),
                    new TypeReference<Map<String, Object>>() {
                    });
        } catch (Exception e) {
            throw new VacademyException("Failed to read BBB config");
        }
    }

    /**
     * Validates a BBB secret sent by the post-publish script.
     * Checks against ALL pool server secrets (any match = valid)
     * and falls back to legacy provider config if pool is empty.
     */
    public boolean validateBbbSecret(String secret) {
        if (secret == null || secret.isBlank())
            return false;
        try {
            // Check against all pool server secrets first
            List<BbbServerPool> servers = serverRouter.getAllEnabledServers();
            for (BbbServerPool server : servers) {
                if (secret.equals(server.getSecret())) {
                    return true;
                }
            }
            // Fallback: check legacy provider config
            var config = configRepository.findByProviderAndStatusIn(
                    MeetingProvider.BBB_MEETING.name(), ACTIVE);
            if (config.isEmpty())
                return false;
            Map<String, Object> cfg = objectMapper.readValue(config.get().getConfigJson(),
                    new TypeReference<Map<String, Object>>() {
                    });
            return secret.equals(cfg.get("secret"));
        } catch (Exception e) {
            log.warn("[BBB] Failed to validate secret: {}", e.getMessage());
            return false;
        }
    }

    private static boolean boolOrDefault(Map<String, Object> map, String key, boolean defaultValue) {
        if (!map.containsKey(key))
            return defaultValue;
        Object val = map.get(key);
        if (val instanceof Boolean)
            return (Boolean) val;
        return Boolean.parseBoolean(String.valueOf(val));
    }

    private static int intOrDefault(Map<String, Object> map, String key, int defaultValue) {
        if (!map.containsKey(key))
            return defaultValue;
        Object val = map.get(key);
        if (val instanceof Number)
            return ((Number) val).intValue();
        try {
            return Integer.parseInt(String.valueOf(val).trim());
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    private String buildQueryString(Map<String, String> params) {
        StringBuilder sb = new StringBuilder();
        for (Map.Entry<String, String> entry : params.entrySet()) {
            if (sb.length() > 0)
                sb.append("&");
            sb.append(URLEncoder.encode(entry.getKey(), StandardCharsets.UTF_8))
                    .append("=")
                    .append(URLEncoder.encode(entry.getValue(), StandardCharsets.UTF_8));
        }
        return sb.toString();
    }

    static String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : hash) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (Exception e) {
            throw new VacademyException("SHA-256 hashing failed");
        }
    }

    private Document parseXml(String xml) {
        if (xml == null || xml.isBlank()) {
            throw new VacademyException("BBB returned empty response");
        }
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            // Prevent XXE attacks
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            return factory.newDocumentBuilder()
                    .parse(new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)));
        } catch (VacademyException ve) {
            throw ve;
        } catch (Exception e) {
            throw new VacademyException("Failed to parse BBB XML response: " + e.getMessage());
        }
    }

    private String getXmlText(Document doc, String tagName) {
        NodeList nodes = doc.getElementsByTagName(tagName);
        return nodes.getLength() > 0 ? nodes.item(0).getTextContent() : "";
    }

    private String getChildText(Element parent, String tagName) {
        return getChildText(parent, tagName, "");
    }

    private String getChildText(Element parent, String tagName, String defaultValue) {
        NodeList nodes = parent.getElementsByTagName(tagName);
        return nodes.getLength() > 0 ? nodes.item(0).getTextContent() : defaultValue;
    }
}

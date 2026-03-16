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
import vacademy.io.admin_core_service.features.live_session.provider.entity.LiveSessionProviderConfig;
import vacademy.io.admin_core_service.features.live_session.provider.dto.ProviderConnectRequestDTO;
import vacademy.io.admin_core_service.features.live_session.provider.repository.LiveSessionProviderConfigRepository;
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
 * Config stored in configJson:
 * {
 *   "apiUrl": "https://meet.vacademy.io/bigbluebutton/api",
 *   "secret": "shared-secret-here"
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

    @Value("${tool.executor.base-url:http://localhost}")
    private String backendBaseUrl;

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

    // -----------------------------------------------------------------------
    // Create meeting
    // -----------------------------------------------------------------------

    @Override
    public CreateMeetingResponseDTO createMeeting(CreateMeetingRequestDTO request, String instituteId) {
        Map<String, Object> cfg = getConfigMap(instituteId);
        String apiUrl = (String) cfg.get("apiUrl");
        String secret = (String) cfg.get("secret");

        String meetingId = UUID.randomUUID().toString();

        // Fetch institute branding
        String instituteName = "Vacademy";
        String themeColor = null;
        String logoUrl = null;
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
                }
            } catch (Exception e) {
                log.warn("[BBB] Failed to fetch institute branding for {}: {}", instituteId, e.getMessage());
            }
        }

        // Read BBB config from request (admin-set options)
        // Keys are snake_case because BbbConfigDTO uses @JsonNaming(SnakeCaseStrategy)
        Map<String, Object> bbbCfg = request.getBbbConfig() != null ? request.getBbbConfig() : Map.of();
        boolean record = boolOrDefault(bbbCfg, "record", true);
        boolean autoStartRec = boolOrDefault(bbbCfg, "auto_start_recording", false);
        boolean muteOnStart = boolOrDefault(bbbCfg, "mute_on_start", true);
        boolean webcamsOnlyForMod = boolOrDefault(bbbCfg, "webcams_only_for_moderator", false);
        String guestPolicy = bbbCfg.containsKey("guest_policy") ? String.valueOf(bbbCfg.get("guest_policy")) : "ALWAYS_ACCEPT";

        Map<String, String> params = new LinkedHashMap<>();
        params.put("name", request.getTopic() != null ? request.getTopic() : instituteName + " Live Class");
        params.put("meetingID", meetingId);
        params.put("record", String.valueOf(record));
        params.put("autoStartRecording", String.valueOf(autoStartRec));
        params.put("allowStartStopRecording", "true");
        params.put("muteOnStart", String.valueOf(muteOnStart));
        params.put("webcamsOnlyForModerator", String.valueOf(webcamsOnlyForMod));
        params.put("guestPolicy", guestPolicy);
        params.put("welcome", "Welcome to <b>" + instituteName + "</b> Live Class!");

        // Institute branding
        if (logoUrl != null) {
            params.put("logo", logoUrl);
        }
        if (themeColor != null) {
            params.put("bannerColor", themeColor);
        }
        params.put("bannerText", instituteName);

        if (request.getDurationMinutes() > 0) {
            params.put("duration", String.valueOf(request.getDurationMinutes()));
        }

        // Set end callback URL so BBB notifies us when the meeting ends
        if (request.getScheduleId() != null) {
            String callbackUrl = backendBaseUrl + "/admin-core-service/live-sessions/provider/meeting/bbb-callback?scheduleId="
                    + request.getScheduleId();
            params.put("meta_endCallbackUrl", callbackUrl);
        }

        String queryString = buildQueryString(params);
        String checksum = sha256("create" + queryString + secret);
        String url = apiUrl + "/create?" + queryString + "&checksum=" + checksum;

        // Use URI.create() to prevent WebClient from re-encoding the already-encoded query string
        String xmlResponse = webClientBuilder.build()
                .get().uri(URI.create(url))
                .retrieve()
                .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(),
                        resp -> resp.bodyToMono(String.class).map(body -> {
                            log.error("[BBB] Create meeting failed: {}", body);
                            return new VacademyException("BBB create meeting error: " + body);
                        }))
                .bodyToMono(String.class)
                .block();

        Document doc = parseXml(xmlResponse);
        String returnCode = getXmlText(doc, "returncode");
        if (!"SUCCESS".equals(returnCode)) {
            String msg = getXmlText(doc, "message");
            throw new VacademyException("BBB create meeting failed: " + msg);
        }

        String bbbMeetingId = getXmlText(doc, "meetingID");
        String internalMeetingId = getXmlText(doc, "internalMeetingID");

        // Generate join URLs
        String moderatorJoinUrl = buildJoinUrl(apiUrl, secret, bbbMeetingId, "Moderator", "moderator-id", "MODERATOR");
        String attendeeJoinUrl = buildJoinUrl(apiUrl, secret, bbbMeetingId, "Attendee", "attendee-id", "VIEWER");

        Map<String, Object> raw = new HashMap<>();
        raw.put("meetingID", bbbMeetingId);
        raw.put("internalMeetingID", internalMeetingId);

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
        params.put("userID", userId);
        params.put("role", role);
        params.put("redirect", "true");

        String queryString = buildQueryString(params);
        String checksum = sha256("join" + queryString + secret);
        return apiUrl + "/join?" + queryString + "&checksum=" + checksum;
    }

    /**
     * Build a personalized join URL using stored config.
     * Public method used by the controller for per-user join URLs.
     */
    public String buildJoinUrlForUser(String meetingId, String fullName,
                                      String userId, String role, String instituteId) {
        Map<String, Object> cfg = getConfigMap(instituteId);
        String apiUrl = (String) cfg.get("apiUrl");
        String secret = (String) cfg.get("secret");
        return buildJoinUrl(apiUrl, secret, meetingId, fullName, userId, role);
    }

    // -----------------------------------------------------------------------
    // Get recordings
    // -----------------------------------------------------------------------

    @Override
    public List<MeetingRecordingDTO> getRecordings(String providerMeetingId, String instituteId) {
        Map<String, Object> cfg = getConfigMap(instituteId);
        String apiUrl = (String) cfg.get("apiUrl");
        String secret = (String) cfg.get("secret");

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

            // Get playback URL
            String playbackUrl = "";
            NodeList formats = rec.getElementsByTagName("format");
            if (formats.getLength() > 0) {
                Element format = (Element) formats.item(0);
                playbackUrl = getChildText(format, "url", "");
            }

            recordings.add(MeetingRecordingDTO.builder()
                    .recordingId(recordId)
                    .playbackUrl(playbackUrl)
                    .downloadUrl(playbackUrl)
                    .durationSeconds(durationSecs)
                    .startTime(new Date(startTimeMs).toInstant().toString())
                    .providerMeetingId(providerMeetingId)
                    .build());
        }
        return recordings;
    }

    // -----------------------------------------------------------------------
    // Get attendance (via getMeetingInfo)
    // -----------------------------------------------------------------------

    @Override
    public List<MeetingAttendeeDTO> getAttendance(String providerMeetingId, String instituteId) {
        Map<String, Object> cfg = getConfigMap(instituteId);
        String apiUrl = (String) cfg.get("apiUrl");
        String secret = (String) cfg.get("secret");

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

        // Try institute-specific first, then fall back to Vacademy-level (null instituteId)
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
                    new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            throw new VacademyException("Failed to read BBB config");
        }
    }

    /**
     * Validates a BBB secret sent by the post-publish script.
     * Compares against the stored BBB config secret.
     */
    public boolean validateBbbSecret(String secret) {
        if (secret == null || secret.isBlank()) return false;
        try {
            var config = configRepository.findByProviderAndStatusIn(
                    MeetingProvider.BBB_MEETING.name(), ACTIVE);
            if (config.isEmpty()) return false;
            Map<String, Object> cfg = objectMapper.readValue(config.get().getConfigJson(),
                    new TypeReference<Map<String, Object>>() {});
            return secret.equals(cfg.get("secret"));
        } catch (Exception e) {
            log.warn("[BBB] Failed to validate secret: {}", e.getMessage());
            return false;
        }
    }

    private static boolean boolOrDefault(Map<String, Object> map, String key, boolean defaultValue) {
        if (!map.containsKey(key)) return defaultValue;
        Object val = map.get(key);
        if (val instanceof Boolean) return (Boolean) val;
        return Boolean.parseBoolean(String.valueOf(val));
    }

    private String buildQueryString(Map<String, String> params) {
        StringBuilder sb = new StringBuilder();
        for (Map.Entry<String, String> entry : params.entrySet()) {
            if (sb.length() > 0) sb.append("&");
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

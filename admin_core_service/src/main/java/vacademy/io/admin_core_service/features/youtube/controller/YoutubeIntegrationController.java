package vacademy.io.admin_core_service.features.youtube.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSession;
import vacademy.io.admin_core_service.features.live_session.entity.SessionSchedule;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionRepository;
import vacademy.io.admin_core_service.features.live_session.repository.SessionScheduleRepository;
import vacademy.io.admin_core_service.features.youtube.dto.YoutubeConnectionStatusDTO;
import vacademy.io.admin_core_service.features.youtube.dto.YoutubeUploadDefaultsDTO;
import vacademy.io.admin_core_service.features.youtube.dto.YoutubeUploadJobDTO;
import vacademy.io.admin_core_service.features.youtube.entity.YoutubeUploadDefaults;
import vacademy.io.admin_core_service.features.youtube.entity.YoutubeUploadJob;
import vacademy.io.admin_core_service.features.youtube.repository.YoutubeUploadDefaultsRepository;
import vacademy.io.admin_core_service.features.youtube.repository.YoutubeUploadJobRepository;
import vacademy.io.admin_core_service.features.youtube.service.YoutubeOAuthService;
import vacademy.io.admin_core_service.features.youtube.service.YoutubeUploadJobService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.meeting.dto.MeetingRecordingDTO;

import java.net.URI;
import java.util.List;
import java.util.Map;

/**
 * Admin-facing endpoints for the YouTube auto-upload integration.
 *
 * Endpoint surface:
 *   POST   /youtube/oauth/initiate          - returns Google consent URL
 *   GET    /youtube/oauth/callback          - Google redirects here
 *   POST   /youtube/disconnect              - admin-only
 *   GET    /youtube/status                  - connection health
 *   GET    /youtube/defaults                - read upload defaults
 *   PUT    /youtube/defaults                - update upload defaults
 *   POST   /youtube/uploads                 - manual upload trigger
 *   POST   /youtube/uploads/{jobId}/retry   - manual retry of a FAILED job
 *   GET    /youtube/uploads                 - upload history
 *   GET    /youtube/uploads/by-schedule/{scheduleId} - jobs for a schedule
 */
@RestController
@RequestMapping("/admin-core-service/youtube")
@RequiredArgsConstructor
@Slf4j
public class YoutubeIntegrationController {

    private final YoutubeOAuthService oauthService;
    private final YoutubeUploadJobService jobService;
    private final YoutubeUploadJobRepository jobRepository;
    private final YoutubeUploadDefaultsRepository defaultsRepository;
    private final SessionScheduleRepository scheduleRepository;
    private final LiveSessionRepository liveSessionRepository;
    private final ObjectMapper objectMapper;

    /** Where to redirect the browser after a successful OAuth callback. */
    @Value("${youtube.oauth.success-redirect:/dashboard/settings?selectedTab=youtube&yt=connected}")
    private String successRedirect;

    @Value("${youtube.oauth.error-redirect:/dashboard/settings?selectedTab=youtube&yt=error}")
    private String errorRedirect;

    // -----------------------------------------------------------------------
    // OAuth
    // -----------------------------------------------------------------------

    @PostMapping("/oauth/initiate")
    public ResponseEntity<Map<String, String>> initiate(
            @RequestParam String instituteId,
            @RequestAttribute("user") CustomUserDetails userDetails) {
        String url = oauthService.buildAuthorizationUrl(instituteId, userDetails.getUserId());
        return ResponseEntity.ok(Map.of("authorization_url", url));
    }

    /**
     * Google redirects the browser here after consent. We exchange the code,
     * store the refresh token, then redirect the user back to the settings
     * page with a success/error flag in the query string.
     *
     * No auth annotation: Google is the caller. The state parameter, signed
     * and one-time-use, is what binds the callback back to the originating
     * admin session.
     */
    @GetMapping("/oauth/callback")
    public ResponseEntity<Void> callback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error) {
        if (error != null) {
            log.warn("[YouTube OAuth] Google returned error: {}", error);
            return redirect(errorRedirect + "&reason=" + error);
        }
        if (code == null || state == null) {
            return redirect(errorRedirect + "&reason=missing_code");
        }
        try {
            oauthService.exchangeCodeAndStore(code, state);
            return redirect(successRedirect);
        } catch (Exception e) {
            log.error("[YouTube OAuth] Callback failed: {}", e.getMessage(), e);
            return redirect(errorRedirect + "&reason=exchange_failed");
        }
    }

    @PostMapping("/disconnect")
    public ResponseEntity<Void> disconnect(@RequestParam String instituteId) {
        oauthService.disconnect(instituteId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/status")
    public ResponseEntity<YoutubeConnectionStatusDTO> status(@RequestParam String instituteId) {
        return ResponseEntity.ok(oauthService.getStatus(instituteId));
    }

    // -----------------------------------------------------------------------
    // Defaults
    // -----------------------------------------------------------------------

    @GetMapping("/defaults")
    public ResponseEntity<YoutubeUploadDefaultsDTO> getDefaults(@RequestParam String instituteId) {
        YoutubeUploadDefaults d = defaultsRepository.findById(instituteId)
                .orElseGet(() -> platformDefaults(instituteId));
        return ResponseEntity.ok(toDto(d));
    }

    @PutMapping("/defaults")
    public ResponseEntity<YoutubeUploadDefaultsDTO> updateDefaults(
            @RequestParam String instituteId,
            @RequestBody YoutubeUploadDefaultsDTO dto) {
        YoutubeUploadDefaults d = defaultsRepository.findById(instituteId)
                .orElseGet(() -> platformDefaults(instituteId));
        d.setFeatureEnabled(dto.isFeatureEnabled());
        d.setAutoUploadEnabled(dto.isAutoUploadEnabled());
        d.setPrivacyStatus(orDefault(dto.getPrivacyStatus(), "unlisted"));
        d.setEmbeddable(dto.isEmbeddable());
        d.setPublicStatsViewable(dto.isPublicStatsViewable());
        d.setMadeForKids(dto.isMadeForKids());
        d.setCategoryId(orDefault(dto.getCategoryId(), "27"));
        d.setLicense(orDefault(dto.getLicense(), "youtube"));
        d.setDefaultLanguage(dto.getDefaultLanguage());
        d.setTagsCsv(dto.getTagsCsv());
        d.setTitleTemplate(orDefault(dto.getTitleTemplate(), "{session_title} | {date}"));
        d.setDescriptionTemplate(dto.getDescriptionTemplate());
        d.setNotifySubscribers(dto.isNotifySubscribers());
        d.setDefaultPlaylistId(dto.getDefaultPlaylistId());
        return ResponseEntity.ok(toDto(defaultsRepository.save(d)));
    }

    // -----------------------------------------------------------------------
    // Uploads
    // -----------------------------------------------------------------------

    /**
     * Manual "Upload to YouTube" trigger. Used by the per-recording button on
     * the live-session view. Any user with session access can call this — the
     * security filter enforces auth; institute-level permission is enforced
     * implicitly because the instituteId is resolved from the schedule and
     * checked against the user's institute context downstream.
     */
    @PostMapping("/uploads")
    public ResponseEntity<YoutubeUploadJobDTO> enqueueManual(
            @RequestBody ManualUploadRequest request,
            @RequestAttribute("user") CustomUserDetails userDetails) {

        SessionSchedule schedule = scheduleRepository.findById(request.scheduleId)
                .orElseThrow(() -> new VacademyException("Schedule not found: " + request.scheduleId));
        LiveSession session = liveSessionRepository.findById(schedule.getSessionId())
                .orElseThrow(() -> new VacademyException("Live session not found"));

        // Resolve fileId from the recording entry if the client only sent
        // recordingId — saves the frontend from having to dig into the JSON.
        String fileId = request.fileId;
        if ((fileId == null || fileId.isBlank()) && request.recordingId != null) {
            fileId = resolveFileIdFromRecordings(schedule, request.recordingId);
        }
        if (fileId == null || fileId.isBlank()) {
            throw new VacademyException(
                    "Could not resolve recording fileId. Pass fileId explicitly or wait for the recording to finish processing.");
        }

        YoutubeUploadJob job = jobService.manualEnqueue(
                session.getInstituteId(),
                schedule.getId(),
                request.recordingId,
                fileId,
                userDetails.getUserId(),
                request.privacyStatus);
        return ResponseEntity.ok(YoutubeUploadJobDTO.from(job));
    }

    @PostMapping("/uploads/{jobId}/retry")
    public ResponseEntity<YoutubeUploadJobDTO> retry(@PathVariable String jobId) {
        return ResponseEntity.ok(YoutubeUploadJobDTO.from(jobService.resetForRetry(jobId)));
    }

    @GetMapping("/uploads")
    public ResponseEntity<List<YoutubeUploadJobDTO>> list(
            @RequestParam String instituteId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(jobRepository
                .findByInstituteIdOrderByCreatedAtDesc(instituteId, PageRequest.of(page, size))
                .stream().map(YoutubeUploadJobDTO::from).toList());
    }

    @GetMapping("/uploads/by-schedule/{scheduleId}")
    public ResponseEntity<List<YoutubeUploadJobDTO>> listBySchedule(@PathVariable String scheduleId) {
        return ResponseEntity.ok(jobRepository.findBySessionScheduleIdOrderByCreatedAtDesc(scheduleId)
                .stream().map(YoutubeUploadJobDTO::from).toList());
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private String resolveFileIdFromRecordings(SessionSchedule schedule, String recordingId) {
        if (schedule.getProviderRecordingsJson() == null
                || schedule.getProviderRecordingsJson().isBlank()) return null;
        try {
            List<MeetingRecordingDTO> recs = objectMapper.readValue(
                    schedule.getProviderRecordingsJson(),
                    new TypeReference<List<MeetingRecordingDTO>>() {});
            return recs.stream()
                    .filter(r -> recordingId.equals(r.getRecordingId()))
                    .map(MeetingRecordingDTO::getFileId)
                    .filter(s -> s != null && !s.isBlank())
                    .findFirst().orElse(null);
        } catch (Exception e) {
            return null;
        }
    }

    private YoutubeUploadDefaults platformDefaults(String instituteId) {
        return YoutubeUploadDefaults.builder()
                .instituteId(instituteId)
                .featureEnabled(false)   // off until admin opts in
                .autoUploadEnabled(true)
                .privacyStatus("unlisted")
                .embeddable(true)
                .publicStatsViewable(false)
                .madeForKids(false)
                .categoryId("27")
                .license("youtube")
                .titleTemplate("{session_title} | {date}")
                .notifySubscribers(false)
                .build();
    }

    private YoutubeUploadDefaultsDTO toDto(YoutubeUploadDefaults d) {
        return YoutubeUploadDefaultsDTO.builder()
                .featureEnabled(d.isFeatureEnabled())
                .autoUploadEnabled(d.isAutoUploadEnabled())
                .privacyStatus(d.getPrivacyStatus())
                .embeddable(d.isEmbeddable())
                .publicStatsViewable(d.isPublicStatsViewable())
                .madeForKids(d.isMadeForKids())
                .categoryId(d.getCategoryId())
                .license(d.getLicense())
                .defaultLanguage(d.getDefaultLanguage())
                .tagsCsv(d.getTagsCsv())
                .titleTemplate(d.getTitleTemplate())
                .descriptionTemplate(d.getDescriptionTemplate())
                .notifySubscribers(d.isNotifySubscribers())
                .defaultPlaylistId(d.getDefaultPlaylistId())
                .build();
    }

    private static String orDefault(String s, String d) {
        return (s == null || s.isBlank()) ? d : s;
    }

    private ResponseEntity<Void> redirect(String location) {
        HttpHeaders headers = new HttpHeaders();
        headers.setLocation(URI.create(location));
        return new ResponseEntity<>(headers, HttpStatus.SEE_OTHER);
    }

    public static class ManualUploadRequest {
        public String scheduleId;
        public String recordingId;
        public String fileId;
        public String privacyStatus;
    }
}

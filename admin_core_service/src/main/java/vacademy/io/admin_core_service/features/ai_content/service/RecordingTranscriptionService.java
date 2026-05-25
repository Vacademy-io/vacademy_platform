package vacademy.io.admin_core_service.features.ai_content.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import vacademy.io.admin_core_service.features.ai_content.dto.TranscriptionCallbackDto;
import vacademy.io.admin_core_service.features.ai_content.dto.TranscriptionStatusDto;
import vacademy.io.admin_core_service.features.ai_content.entity.AiContentExtraction;
import vacademy.io.admin_core_service.features.ai_content.entity.AiContentSource;
import vacademy.io.admin_core_service.features.ai_content.repository.AiContentExtractionRepository;
import vacademy.io.admin_core_service.features.ai_content.repository.AiContentSourceRepository;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSession;
import vacademy.io.admin_core_service.features.live_session.entity.SessionSchedule;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionRepository;
import vacademy.io.admin_core_service.features.live_session.repository.SessionScheduleRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.media.service.FileService;
import vacademy.io.common.meeting.dto.MeetingRecordingDTO;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Orchestrates transcription of a BBB recording: locate the recording,
 * upsert a polymorphic ai_content_source row, create / refresh an
 * ai_content_extraction row, fire off the ai-service /transcription/v1/submit
 * call, and handle the worker callback when the job finishes.
 *
 * v1 constants:
 *   source_type      = 'BBB_RECORDING'
 *   extraction_type  = 'WHISPER_TRANSCRIBE_TRANSLATE'
 *   task             = 'both' (persist source-language AND English transcripts)
 *   model_size       = 'small' (best for Hindi-English mix; default for class recordings)
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class RecordingTranscriptionService {

    static final String SOURCE_TYPE_BBB_RECORDING = "BBB_RECORDING";
    static final String EXTRACTION_WHISPER_TRANSCRIBE_TRANSLATE = "WHISPER_TRANSCRIBE_TRANSLATE";
    static final String WHISPER_TASK_BOTH = "both";
    static final String WHISPER_MODEL_DEFAULT = "small";

    private final AiContentSourceRepository sourceRepo;
    private final AiContentExtractionRepository extractionRepo;
    private final SessionScheduleRepository scheduleRepo;
    private final LiveSessionRepository liveSessionRepo;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;
    private final FileService fileService;
    private final vacademy.io.admin_core_service.features.notification_service.service.NotificationService notificationService;

    @Value("${ai.service.url:http://localhost:8077}")
    private String aiServiceUrl;

    /**
     * Shared secret presented in X-Internal-Service-Token when admin-core
     * calls ai-service's /transcription endpoints on behalf of an institute.
     * Empty string in dev → ai-service falls back to institute-key auth (which
     * admin-core can't provide), so set this in any non-dev environment.
     */
    @Value("${ai.service.internal-token:}")
    private String internalServiceToken;

    /**
     * Base URL the render worker calls back into when a job reaches terminal
     * state. Falls back to the BBB callback base (which already resolves
     * publicly-reachable admin-core).
     */
    @Value("${transcription.callback.base-url:${bbb.callback.base-url:http://localhost}}")
    private String callbackBaseUrl;

    /**
     * Shared secret embedded as a query-param (?token=...) in the callback
     * URL we hand to the worker. The worker doesn't natively forward custom
     * headers, so we tunnel auth in the URL itself (and the worker dutifully
     * preserves query params on its POST). The handler extracts and verifies.
     *
     * Empty string → callback endpoint is open (dev-only fallback). Set in
     * any non-dev environment.
     */
    @Value("${transcription.callback.secret:}")
    private String callbackSecret;

    // ---------------------------------------------------------------------
    // Submit
    // ---------------------------------------------------------------------

    /**
     * Kick off transcription for a recording. Idempotent on the
     * (source, extraction_type) pair:
     *   - COMPLETED → returns the existing status (no-op).
     *   - QUEUED / RUNNING → throws 409.
     *   - FAILED or absent → starts a new job.
     */
    public TranscriptionStatusDto submitForRecording(
            String scheduleId,
            String recordingId,
            CustomUserDetails user) {

        SessionSchedule schedule = scheduleRepo.findById(scheduleId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Schedule not found"));

        MeetingRecordingDTO recording = findRecording(schedule, recordingId);
        if (recording == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "Recording " + recordingId + " not found on schedule " + scheduleId);
        }

        String sourceUrl = resolveSourceUrl(recording);
        if (sourceUrl == null || sourceUrl.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Recording has no downloadable source URL — cannot transcribe");
        }

        LiveSession session = liveSessionRepo.findById(schedule.getSessionId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Live session not found"));
        String instituteId = session.getInstituteId();

        AiContentSource source = upsertSource(
                recordingId, sourceUrl, instituteId,
                user != null ? user.getId() : null,
                schedule, recording);

        Optional<AiContentExtraction> existing = extractionRepo
                .findBySourceIdAndExtractionType(source.getId(), EXTRACTION_WHISPER_TRANSCRIBE_TRANSLATE);

        if (existing.isPresent()) {
            AiContentExtraction row = existing.get();
            if ("COMPLETED".equals(row.getStatus())) {
                return toDto(recordingId, row);
            }
            if ("QUEUED".equals(row.getStatus()) || "RUNNING".equals(row.getStatus())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Transcription already in progress (status=" + row.getStatus() + ")");
            }
            // FAILED → reset and re-submit. If the ai-service call throws,
            // we leave the row in FAILED state (not stuck in QUEUED) so the
            // user can retry from the UI.
            row.setStatus("QUEUED");
            row.setJobId(null);
            row.setErrorMessage(null);
            extractionRepo.save(row);
            return submitToAiService(row, instituteId, sourceUrl, recordingId);
        }

        AiContentExtraction row = AiContentExtraction.builder()
                .sourceId(source.getId())
                .extractionType(EXTRACTION_WHISPER_TRANSCRIBE_TRANSLATE)
                .status("QUEUED")
                .metadataJson(buildExtractionMetadataJson())
                .build();
        row = extractionRepo.save(row);
        return submitToAiService(row, instituteId, sourceUrl, recordingId);
    }

    /**
     * Hand a QUEUED row off to ai-service. On success: row → RUNNING with
     * jobId. On failure: row → FAILED with error message (so the user can
     * retry from the UI rather than being stuck in QUEUED forever).
     */
    private TranscriptionStatusDto submitToAiService(
            AiContentExtraction row, String instituteId, String sourceUrl, String recordingId) {
        try {
            String jobId = callAiServiceSubmit(instituteId, sourceUrl);
            row.setJobId(jobId);
            row.setStatus("RUNNING");
            row = extractionRepo.save(row);
            return toDto(recordingId, row);
        } catch (ResponseStatusException e) {
            row.setStatus("FAILED");
            row.setErrorMessage("ai-service submit failed: "
                    + e.getStatusCode().value() + " "
                    + (e.getReason() == null ? "" : e.getReason()));
            extractionRepo.save(row);
            throw e; // surface the underlying status (429, 502, etc.) to the caller
        } catch (RuntimeException e) {
            row.setStatus("FAILED");
            row.setErrorMessage("ai-service submit failed: " + e.getMessage());
            extractionRepo.save(row);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Could not reach transcription service", e);
        }
    }

    // ---------------------------------------------------------------------
    // Status (UI polling)
    // ---------------------------------------------------------------------

    public TranscriptionStatusDto getStatus(String scheduleId, String recordingId) {
        SessionSchedule schedule = scheduleRepo.findById(scheduleId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Schedule not found"));

        if (findRecording(schedule, recordingId) == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "Recording " + recordingId + " not found on schedule " + scheduleId);
        }

        Optional<AiContentSource> source = sourceRepo
                .findBySourceTypeAndSourceId(SOURCE_TYPE_BBB_RECORDING, recordingId);
        if (source.isEmpty()) {
            // No transcription has ever been requested for this recording.
            return TranscriptionStatusDto.builder().recordingId(recordingId).status(null).build();
        }

        Optional<AiContentExtraction> row = extractionRepo
                .findBySourceIdAndExtractionType(source.get().getId(), EXTRACTION_WHISPER_TRANSCRIBE_TRANSLATE);
        if (row.isEmpty()) {
            return TranscriptionStatusDto.builder().recordingId(recordingId).status(null).build();
        }
        return toDto(recordingId, row.get());
    }

    // ---------------------------------------------------------------------
    // Callback (render worker → admin-core)
    // ---------------------------------------------------------------------

    public void handleCallback(TranscriptionCallbackDto payload, String providedToken) {
        // Token check: the secret is embedded in the callback URL as ?token=...
        // by callAiServiceSubmit. When the server has a secret configured we
        // require a matching token; when it's empty we accept everything
        // (dev-only fallback). In any non-dev environment, configure the secret.
        if (callbackSecret != null && !callbackSecret.isBlank()) {
            if (providedToken == null
                    || !java.security.MessageDigest.isEqual(
                            callbackSecret.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                            providedToken.getBytes(java.nio.charset.StandardCharsets.UTF_8))) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Bad callback token");
            }
        }
        if (payload == null || payload.getJobId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing jobId");
        }
        applyTerminalState(payload, "transcription-callback");
    }

    /**
     * Apply a terminal-state worker payload (completed/failed) to the extraction
     * row keyed by jobId. Caller is responsible for authenticating the payload
     * source — both the public callback endpoint (after token check) and the
     * watchdog reconciliation job (after polling the worker directly) feed in
     * here so the row-update path is shared and stays consistent.
     *
     * @param origin short label included in logs to distinguish callback vs.
     *               watchdog updates, e.g. "transcription-callback" or
     *               "transcription-watchdog".
     */
    public void applyTerminalState(TranscriptionCallbackDto payload, String origin) {
        AiContentExtraction row = extractionRepo.findByJobId(payload.getJobId())
                .orElseThrow(() -> {
                    log.warn("[{}] No extraction row for jobId={}", origin, payload.getJobId());
                    return new ResponseStatusException(HttpStatus.NOT_FOUND, "Unknown jobId");
                });

        String status = payload.getStatus();
        if ("completed".equalsIgnoreCase(status)) {
            row.setStatus("COMPLETED");
            row.setDetectedLanguage(payload.getDetectedLanguage());
            row.setLanguageProbability(payload.getLanguageProbability());
            row.setDurationSeconds(payload.getDurationSeconds());
            row.setSegmentCount(payload.getSegmentCount());
            row.setWordCount(payload.getWordCount());

            Map<String, String> source = payload.getOutputUrlsSource();
            Map<String, String> english = payload.getOutputUrlsEnglish();
            if (source != null) {
                row.setSourceTextUrl(source.get("txt_url"));
            }
            if (english != null) {
                String url = english.get("txt_url");
                row.setEnglishTextUrl(url);
                // Cache the body so downstream consumers (assessment
                // generation) avoid a per-call S3 fetch. If the download
                // fails we still mark the row COMPLETED — the URL fallback
                // path in those consumers will recover.
                if (url != null && !url.isBlank()) {
                    try {
                        ResponseEntity<String> resp = restTemplate.getForEntity(url, String.class);
                        if (resp.getStatusCode().is2xxSuccessful() && resp.getBody() != null) {
                            row.setEnglishTextContent(resp.getBody());
                        }
                    } catch (Exception e) {
                        log.warn("[{}] Could not cache transcript text for jobId={}: {}",
                                origin, payload.getJobId(), e.getMessage());
                    }
                }
            }
            row.setFormatUrlsJson(buildFormatUrlsJson(source, english));
            row.setErrorMessage(null);
        } else if ("failed".equalsIgnoreCase(status)) {
            row.setStatus("FAILED");
            row.setErrorMessage(payload.getError() != null ? payload.getError() : "Worker reported failure");
        } else {
            // Non-terminal — should never reach here from the callback endpoint
            // (worker only calls on terminal states), and the watchdog filters
            // these out before calling. Treat as a bug and bail without touching
            // the row.
            log.warn("[{}] Unexpected status='{}' for jobId={}", origin, status, payload.getJobId());
            return;
        }
        extractionRepo.save(row);
        log.info("[{}] jobId={} → {} (lang={})",
                origin, payload.getJobId(), row.getStatus(), row.getDetectedLanguage());

        // Notify the user who originally submitted the transcribe request. Fire-and-forget:
        // NotificationService.createSystemAlertAnnouncement already swallows downstream
        // failures, so a notification-service blip can't fail the row update.
        dispatchTerminalAlert(row);
    }

    /**
     * Post a system-alert announcement (bell-icon notification in the UI) to the user who
     * triggered the transcription, summarising the terminal state. Looks up
     * {@code AiContentSource} for institute_id + created_by — created_by is set at submit
     * time from the CustomUserDetails of the caller.
     *
     * No-ops if the source row is missing, has no creator (legacy rows / system-triggered
     * jobs), or the row's status is non-terminal — the contract is "called once per
     * terminal transition". Any failure here must not bubble up because the row save
     * has already succeeded.
     */
    private void dispatchTerminalAlert(AiContentExtraction row) {
        try {
            String status = row.getStatus();
            if (!"COMPLETED".equals(status) && !"FAILED".equals(status)) {
                return;
            }
            Optional<AiContentSource> maybeSource = sourceRepo.findById(row.getSourceId());
            if (maybeSource.isEmpty()) {
                return;
            }
            AiContentSource source = maybeSource.get();
            String userId = source.getCreatedBy();
            String instituteId = source.getInstituteId();
            if (userId == null || userId.isBlank() || instituteId == null || instituteId.isBlank()) {
                // Legacy rows without a creator, or system-initiated jobs.
                return;
            }

            String title;
            String body;
            if ("COMPLETED".equals(status)) {
                title = "Transcript ready";
                body = "Your recording transcript has been generated and is ready to view.";
            } else {
                title = "Transcript failed";
                String reason = row.getErrorMessage();
                if (reason == null || reason.isBlank()) {
                    reason = "Unknown error";
                }
                // Truncate to keep the notification body readable; the full error
                // is still on the row for the UI / support to inspect.
                if (reason.length() > 240) {
                    reason = reason.substring(0, 237) + "...";
                }
                body = "Transcript generation failed: " + reason
                        + " You can retry from the Recordings page.";
            }

            // Explicit settings map matches what CounselorAssignmentService /
            // DoubtNotificationService pass — keeps every system alert on this
            // service interchangeable at the recipient end.
            Map<String, Object> alertSettings = Map.of(
                    "priority", 2,
                    "isDismissible", true,
                    "showBadge", true,
                    "isActive", true);

            notificationService.createSystemAlertAnnouncement(
                    instituteId,
                    java.util.List.of(userId),
                    title,
                    body,
                    "system",            // createdBy
                    "System",            // createdByName — matches counselor / doubt convention
                    "ADMIN",             // createdByRole — bypasses approval gate, same as other system alerts
                    alertSettings);

            log.info("[transcription-alert] Dispatched {} alert for jobId={} → user={}",
                    status, row.getJobId(), userId);
        } catch (Exception e) {
            // Notification dispatch must never fail the business flow.
            log.warn("[transcription-alert] Failed to dispatch alert for jobId={}: {}",
                    row.getJobId(), e.getMessage());
        }
    }

    // ---------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------

    private MeetingRecordingDTO findRecording(SessionSchedule schedule, String recordingId) {
        if (schedule.getProviderRecordingsJson() == null || schedule.getProviderRecordingsJson().isBlank()) {
            return null;
        }
        try {
            List<MeetingRecordingDTO> recordings = objectMapper.readValue(
                    schedule.getProviderRecordingsJson(),
                    new TypeReference<List<MeetingRecordingDTO>>() {});
            return recordings.stream()
                    .filter(r -> recordingId.equals(r.getRecordingId()))
                    .findFirst()
                    .orElse(null);
        } catch (Exception e) {
            log.warn("[transcription] Could not parse providerRecordingsJson for schedule={}", schedule.getId());
            return null;
        }
    }

    /**
     * Resolve a downloadable URL for the recording. Priority:
     *   1. downloadUrl (direct S3) — populated for some provider integrations
     *   2. playbackUrl (viewer/embed) — usually a player URL, not directly downloadable
     *   3. fileId → media service public URL — the case for BBB recordings stored
     *      in Vacademy's S3; mirrors the pattern used by YoutubeUploadService.
     */
    private String resolveSourceUrl(MeetingRecordingDTO recording) {
        if (recording.getDownloadUrl() != null && !recording.getDownloadUrl().isBlank()) {
            return recording.getDownloadUrl();
        }
        if (recording.getPlaybackUrl() != null && !recording.getPlaybackUrl().isBlank()) {
            return recording.getPlaybackUrl();
        }
        if (recording.getFileId() != null && !recording.getFileId().isBlank()) {
            try {
                return fileService.getPublicUrlForFileId(recording.getFileId());
            } catch (Exception e) {
                log.warn("[transcription] Failed to resolve public URL for fileId={}: {}",
                        recording.getFileId(), e.getMessage());
            }
        }
        return null;
    }

    private AiContentSource upsertSource(String recordingId, String sourceUrl, String instituteId,
                                         String userId, SessionSchedule schedule, MeetingRecordingDTO recording) {
        Optional<AiContentSource> existing = sourceRepo
                .findBySourceTypeAndSourceId(SOURCE_TYPE_BBB_RECORDING, recordingId);
        if (existing.isPresent()) {
            // Refresh url + metadata in case the recording was re-uploaded.
            AiContentSource s = existing.get();
            s.setSourceUrl(sourceUrl);
            s.setMetadataJson(buildSourceMetadataJson(schedule, recording));
            // Backfill createdBy when the legacy row was inserted without one
            // (predates user tracking, or first transcription was triggered by
            // an automated path). Without this, dispatchTerminalAlert silently
            // bails because it has no user to notify — see the silent-skip
            // guard in that method.
            if ((s.getCreatedBy() == null || s.getCreatedBy().isBlank())
                    && userId != null && !userId.isBlank()) {
                s.setCreatedBy(userId);
            }
            return sourceRepo.save(s);
        }
        AiContentSource fresh = AiContentSource.builder()
                .sourceType(SOURCE_TYPE_BBB_RECORDING)
                .sourceId(recordingId)
                .sourceUrl(sourceUrl)
                .instituteId(instituteId)
                .createdBy(userId)
                .metadataJson(buildSourceMetadataJson(schedule, recording))
                .build();
        return sourceRepo.save(fresh);
    }

    private String buildSourceMetadataJson(SessionSchedule schedule, MeetingRecordingDTO recording) {
        try {
            ObjectNode n = objectMapper.createObjectNode();
            n.put("session_schedule_id", schedule.getId());
            n.put("session_id", schedule.getSessionId());
            if (recording.getFileId() != null) n.put("file_id", recording.getFileId());
            if (recording.getType() != null) n.put("recording_type", recording.getType());
            n.put("duration_seconds", recording.getDurationSeconds());
            return objectMapper.writeValueAsString(n);
        } catch (Exception e) {
            return null;
        }
    }

    private String buildExtractionMetadataJson() {
        try {
            ObjectNode n = objectMapper.createObjectNode();
            n.put("whisper_model", WHISPER_MODEL_DEFAULT);
            n.put("task", WHISPER_TASK_BOTH);
            n.put("submitted_at", java.time.Instant.now().toString());
            return objectMapper.writeValueAsString(n);
        } catch (Exception e) {
            return null;
        }
    }

    private String buildFormatUrlsJson(Map<String, String> source, Map<String, String> english) {
        try {
            ObjectNode n = objectMapper.createObjectNode();
            if (source != null) {
                ObjectNode src = n.putObject("source");
                source.forEach(src::put);
            }
            if (english != null) {
                ObjectNode en = n.putObject("english");
                english.forEach(en::put);
            }
            return objectMapper.writeValueAsString(n);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * POST /ai-service/transcription/v1/submit with task=both.
     *
     * Auth: X-Internal-Service-Token (admin-core ↔ ai-service shared secret).
     * The institute_id and callback_url are passed in the body so ai-service
     * can attribute usage and so the worker knows where to call back.
     *
     * Callback auth: we encode the shared secret as a `?token=` query param
     * on the callback URL (the worker doesn't natively let us set custom
     * outbound headers, but it preserves query params when POSTing back).
     */
    private String callAiServiceSubmit(String instituteId, String sourceUrl) {
        String url = aiServiceUrl + "/ai-service/transcription/v1/submit";
        String callbackUrl = trimTrailingSlash(callbackBaseUrl)
                + "/admin-core-service/live-sessions/transcription/callback";
        if (callbackSecret != null && !callbackSecret.isBlank()) {
            callbackUrl = callbackUrl + "?token=" + java.net.URLEncoder.encode(
                    callbackSecret, java.nio.charset.StandardCharsets.UTF_8);
        }

        Map<String, Object> body = Map.of(
                "source_url", sourceUrl,
                "model_size", WHISPER_MODEL_DEFAULT,
                "word_timestamps", true,
                "task", WHISPER_TASK_BOTH,
                "output_formats", List.of("json", "srt", "vtt", "txt"),
                "callback_url", callbackUrl,
                // institute_id is consumed by the ai-service when X-Internal-Service-Token
                // is presented (server-to-server auth path).
                "institute_id", instituteId
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (internalServiceToken != null && !internalServiceToken.isBlank()) {
            headers.set("X-Internal-Service-Token", internalServiceToken);
        }

        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    url, HttpMethod.POST, new HttpEntity<>(body, headers), Map.class);
            if (response.getBody() == null || response.getBody().get("job_id") == null) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                        "ai-service did not return a job_id");
            }
            return String.valueOf(response.getBody().get("job_id"));
        } catch (HttpStatusCodeException e) {
            int code = e.getStatusCode().value();
            if (code == 429) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                        "Transcription server is busy — try again later");
            }
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "ai-service error " + code + ": " + e.getResponseBodyAsString());
        }
    }

    private String trimTrailingSlash(String s) {
        return s.endsWith("/") ? s.substring(0, s.length() - 1) : s;
    }

    private TranscriptionStatusDto toDto(String recordingId, AiContentExtraction row) {
        return TranscriptionStatusDto.builder()
                .recordingId(recordingId)
                .status(row.getStatus())
                .jobId(row.getJobId())
                .detectedLanguage(row.getDetectedLanguage())
                .languageProbability(row.getLanguageProbability())
                .durationSeconds(row.getDurationSeconds())
                .segmentCount(row.getSegmentCount())
                .wordCount(row.getWordCount())
                .sourceTextUrl(row.getSourceTextUrl())
                .englishTextUrl(row.getEnglishTextUrl())
                .errorMessage(row.getErrorMessage())
                .createdAt(row.getCreatedAt())
                .updatedAt(row.getUpdatedAt())
                .build();
    }
}

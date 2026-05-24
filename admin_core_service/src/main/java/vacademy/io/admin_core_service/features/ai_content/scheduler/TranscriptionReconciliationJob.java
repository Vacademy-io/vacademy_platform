package vacademy.io.admin_core_service.features.ai_content.scheduler;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;
import vacademy.io.admin_core_service.features.ai_content.dto.TranscriptionCallbackDto;
import vacademy.io.admin_core_service.features.ai_content.entity.AiContentExtraction;
import vacademy.io.admin_core_service.features.ai_content.repository.AiContentExtractionRepository;
import vacademy.io.admin_core_service.features.ai_content.service.RecordingTranscriptionService;
import vacademy.io.common.logging.SentryLogger;

import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * Reconciles transcription rows whose terminal-state callback never arrived.
 *
 * Why this exists: the render-worker fires a single fire-and-forget POST when
 * a job completes ({@code _send_callback} in
 * {@code ai_service/render_worker/main.py}). If that POST fails (network blip,
 * DNS, TLS, worker restart between completion and POST), the result is lost —
 * the worker has the transcript on S3 but admin-core's row stays RUNNING
 * forever, and the UI polls indefinitely.
 *
 * What it does: every {@code transcription.reconciliation.poll-interval-ms}
 * (default 5 min), finds rows in RUNNING that haven't been touched for
 * {@code transcription.reconciliation.stale-after-minutes} (default 15) and
 * polls ai-service's status endpoint for each. If the worker reports a
 * terminal state, the row is updated through the same path the live callback
 * uses ({@link RecordingTranscriptionService#applyTerminalState}). If the
 * worker has lost the job (404 / unknown) AND the row is older than
 * {@code transcription.reconciliation.give-up-after-hours} (default 6), the
 * row is marked FAILED so the user can retry from the UI.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class TranscriptionReconciliationJob {

    /**
     * Only RUNNING rows are reconciled. QUEUED rows mean the ai-service submit
     * round-trip is still in flight inside admin-core (sub-second), so they're
     * never stuck for real.
     */
    private static final String STATUS_RUNNING = "RUNNING";

    /**
     * Cap per cycle so a backlog (e.g. after a multi-hour worker outage) can't
     * hammer ai-service in one tick. With a 5-min cycle this drains 30 stuck
     * jobs/min, which matches our worker throughput.
     */
    private static final int MAX_ROWS_PER_CYCLE = 25;

    private final AiContentExtractionRepository extractionRepo;
    private final RecordingTranscriptionService transcriptionService;
    private final RestTemplate restTemplate;

    @Value("${ai.service.url:http://localhost:8077}")
    private String aiServiceUrl;

    @Value("${ai.service.internal-token:}")
    private String internalServiceToken;

    @Value("${transcription.reconciliation.stale-after-minutes:15}")
    private int staleAfterMinutes;

    @Value("${transcription.reconciliation.give-up-after-hours:6}")
    private int giveUpAfterHours;

    @Value("${transcription.reconciliation.enabled:true}")
    private boolean enabled;

    /**
     * Runs every {@code transcription.reconciliation.poll-interval-ms} (default
     * 5 minutes). Skip cycles are cheap — the JPA query is indexed on
     * {@code status} and bounded by {@code updated_at}, so it's O(stuck rows).
     */
    @Scheduled(fixedDelayString = "${transcription.reconciliation.poll-interval-ms:300000}",
            initialDelayString = "${transcription.reconciliation.initial-delay-ms:60000}")
    public void reconcile() {
        if (!enabled) {
            return;
        }
        try {
            Date staleCutoff = new Date(System.currentTimeMillis()
                    - TimeUnit.MINUTES.toMillis(staleAfterMinutes));
            List<AiContentExtraction> stuck = extractionRepo.findStuckByStatus(STATUS_RUNNING, staleCutoff);
            if (stuck.isEmpty()) {
                return;
            }
            log.info("[transcription-watchdog] Found {} stuck RUNNING row(s); reconciling up to {}",
                    stuck.size(), MAX_ROWS_PER_CYCLE);

            int processed = 0;
            for (AiContentExtraction row : stuck) {
                if (processed >= MAX_ROWS_PER_CYCLE) break;
                reconcileOne(row);
                processed++;
            }
        } catch (Exception e) {
            // Don't let a single bad cycle take down the scheduler thread.
            log.error("[transcription-watchdog] Cycle failed", e);
            SentryLogger.logError(e, "TranscriptionReconciliation cycle failed",
                    Map.of("operation", "reconcile"));
        }
    }

    private void reconcileOne(AiContentExtraction row) {
        String jobId = row.getJobId();
        if (jobId == null || jobId.isBlank()) {
            // Row was created but ai-service submit failed before assigning a jobId
            // — submitToAiService already marks these FAILED, so this is defensive.
            log.warn("[transcription-watchdog] Skipping row id={} with null jobId", row.getId());
            return;
        }

        WorkerStatus ws;
        try {
            ws = pollAiServiceStatus(jobId);
        } catch (HttpStatusCodeException e) {
            // 502 from ai-service means the worker is unreachable OR doesn't
            // know this job_id (worker restarted, lost in-memory dict).
            if (e.getStatusCode().value() == 502
                    && isOlderThan(row, TimeUnit.HOURS.toMillis(giveUpAfterHours))) {
                markFailedForeverLost(row);
            } else {
                log.warn("[transcription-watchdog] Polling ai-service for jobId={} returned {}; will retry next cycle",
                        jobId, e.getStatusCode().value());
            }
            return;
        } catch (Exception e) {
            log.warn("[transcription-watchdog] Polling ai-service for jobId={} threw {}: {}",
                    jobId, e.getClass().getSimpleName(), e.getMessage());
            return;
        }

        // Worker still working — leave the row alone, try again next cycle.
        if ("queued".equalsIgnoreCase(ws.status) || "running".equalsIgnoreCase(ws.status)) {
            log.debug("[transcription-watchdog] jobId={} still {} on worker (progress={})",
                    jobId, ws.status, ws.progress);
            return;
        }

        // Terminal state — recover the lost callback by feeding the worker's
        // own status response into the same handler the live callback uses.
        if ("completed".equalsIgnoreCase(ws.status) || "failed".equalsIgnoreCase(ws.status)) {
            try {
                TranscriptionCallbackDto payload = ws.toCallbackDto(jobId);
                transcriptionService.applyTerminalState(payload, "transcription-watchdog");
                log.info("[transcription-watchdog] Recovered jobId={} → {} (callback was lost)",
                        jobId, ws.status);
            } catch (Exception e) {
                log.error("[transcription-watchdog] Failed to apply recovered state for jobId={}", jobId, e);
                SentryLogger.logError(e, "TranscriptionReconciliation apply failed",
                        Map.of("jobId", jobId, "workerStatus", ws.status));
            }
            return;
        }

        log.warn("[transcription-watchdog] Unrecognised worker status='{}' for jobId={}", ws.status, jobId);
    }

    /**
     * Hard-fail a row whose worker job has disappeared (404/unknown) and which
     * is old enough that we won't see it come back. The user can retry from
     * the UI; the submit path treats FAILED as resubmittable.
     *
     * Routes through {@link RecordingTranscriptionService#applyTerminalState} so the
     * system-alert dispatch fires for this path too — otherwise the user would never
     * be told their transcript silently died.
     */
    private void markFailedForeverLost(AiContentExtraction row) {
        TranscriptionCallbackDto syntheticFail = TranscriptionCallbackDto.builder()
                .jobId(row.getJobId())
                .status("failed")
                .error("Worker lost job state (process restarted or memory cleared) before callback could fire. Retry from the UI.")
                .build();
        transcriptionService.applyTerminalState(syntheticFail, "transcription-watchdog");
        log.warn("[transcription-watchdog] Marked jobId={} FAILED — worker has no record after {}h",
                row.getJobId(), giveUpAfterHours);
    }

    private boolean isOlderThan(AiContentExtraction row, long millis) {
        if (row.getUpdatedAt() == null) return false;
        return System.currentTimeMillis() - row.getUpdatedAt().getTime() > millis;
    }

    /**
     * Polls {@code GET /ai-service/transcription/v1/status/{jobId}}. The
     * response shape is documented at
     * {@code ai_service/app/routers/transcription.py :: get_transcription_status}.
     */
    @SuppressWarnings({"rawtypes", "unchecked"})
    private WorkerStatus pollAiServiceStatus(String jobId) {
        String url = trimTrailingSlash(aiServiceUrl)
                + "/ai-service/transcription/v1/status/" + jobId;
        HttpHeaders headers = new HttpHeaders();
        if (internalServiceToken != null && !internalServiceToken.isBlank()) {
            headers.set("X-Internal-Service-Token", internalServiceToken);
        }

        // RestTemplate can't bind a parameterized Map<String,Object> via .class
        // literal — using ParameterizedTypeReference here would just add ceremony
        // for the same unchecked cast at the next layer, so we scope the
        // suppression to this method.
        ResponseEntity<Map> resp = restTemplate.exchange(
                url, HttpMethod.GET, new HttpEntity<>(headers), Map.class);

        Map<String, Object> body = (Map<String, Object>) resp.getBody();
        if (body == null) {
            throw new IllegalStateException("Empty status body from ai-service");
        }
        return WorkerStatus.from(body);
    }

    private static String trimTrailingSlash(String s) {
        return s.endsWith("/") ? s.substring(0, s.length() - 1) : s;
    }

    /** Typed view over the status JSON returned by ai-service. */
    private static final class WorkerStatus {
        String status;
        Double progress;
        Double durationSeconds;
        String detectedLanguage;
        Double languageProbability;
        Integer segmentCount;
        Integer wordCount;
        String error;
        Map<String, String> outputUrlsSource;
        Map<String, String> outputUrlsEnglish;

        @SuppressWarnings("unchecked")
        static WorkerStatus from(Map<String, Object> body) {
            WorkerStatus s = new WorkerStatus();
            s.status = asString(body.get("status"));
            s.progress = asDouble(body.get("progress"));
            s.durationSeconds = asDouble(body.get("duration_seconds"));
            s.detectedLanguage = asString(body.get("detected_language"));
            s.languageProbability = asDouble(body.get("language_probability"));
            s.segmentCount = asInteger(body.get("segment_count"));
            s.wordCount = asInteger(body.get("word_count"));
            s.error = asString(body.get("error"));
            s.outputUrlsSource = (Map<String, String>) body.get("output_urls_source");
            s.outputUrlsEnglish = (Map<String, String>) body.get("output_urls_english");
            return s;
        }

        TranscriptionCallbackDto toCallbackDto(String jobId) {
            return TranscriptionCallbackDto.builder()
                    .jobId(jobId)
                    .status(status)
                    .durationSeconds(durationSeconds)
                    .detectedLanguage(detectedLanguage)
                    .languageProbability(languageProbability)
                    .segmentCount(segmentCount)
                    .wordCount(wordCount)
                    .error(error)
                    .outputUrlsSource(outputUrlsSource)
                    .outputUrlsEnglish(outputUrlsEnglish)
                    .build();
        }

        private static String asString(Object o) {
            return o == null ? null : String.valueOf(o);
        }

        private static Double asDouble(Object o) {
            if (o == null) return null;
            if (o instanceof Number) return ((Number) o).doubleValue();
            try { return Double.parseDouble(o.toString()); } catch (NumberFormatException e) { return null; }
        }

        private static Integer asInteger(Object o) {
            if (o == null) return null;
            if (o instanceof Number) return ((Number) o).intValue();
            try { return Integer.parseInt(o.toString()); } catch (NumberFormatException e) { return null; }
        }
    }
}

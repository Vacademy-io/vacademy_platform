package vacademy.io.admin_core_service.features.telephony.core;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.TelephonyCallLog;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.TelephonyCallLogRepository;
import vacademy.io.admin_core_service.features.telephony.spi.RecordingFetcher;
import vacademy.io.common.media.service.FileService;

import java.io.InputStream;
import java.net.URI;
import java.util.Map;
import java.util.Optional;

/**
 * Provider-agnostic: copies an AI-voice call recording into our storage so it
 * plays from the lead profile's Call History (which streams from
 * {@code recording_storage_key}).
 *
 * <p>The provider's recording is fetched through ITS registered
 * {@link RecordingFetcher} — resolved by the call log's {@code providerType} from
 * {@link TelephonyProviderRegistry}, never hardcoded — then uploaded via a
 * media_service <b>pre-signed S3 PUT URL</b> (not the multipart API). Dropping in a
 * new AI agent only needs its {@code RecordingFetcher} bean; this service is unchanged.
 *
 * <p><b>Why it retries:</b> the provider's end-of-call webhook frequently arrives
 * BEFORE the recording has finished uploading to its public object store, so an
 * immediate single fetch returns 404/empty/non-audio and the recording is lost. In
 * production ~60% of copies missed for exactly this reason. We retry with backoff so
 * the copy lands once the object is available; it runs on a dedicated pool so the
 * webhook never blocks.
 */
@Service
@RequiredArgsConstructor
public class AiCallRecordingService {

    private static final Logger log = LoggerFactory.getLogger(AiCallRecordingService.class);

    /** Attempt schedule (ms to sleep BEFORE each attempt). Covers the provider's
     *  post-webhook upload lag without tying a worker up indefinitely. */
    private static final long[] RETRY_BACKOFF_MS = {0L, 15_000L, 45_000L, 90_000L};

    private final TelephonyProviderRegistry registry;
    private final FileService fileService;
    private final TelephonyCallLogRepository callLogRepo;
    private final RestTemplate restTemplate = new RestTemplate();

    private enum Step { DONE, STOP, RETRY }

    @Async("aiCallRecordingExecutor")
    public void persistAsync(String callLogId) {
        for (int attempt = 0; attempt < RETRY_BACKOFF_MS.length; attempt++) {
            if (RETRY_BACKOFF_MS[attempt] > 0) {
                try {
                    Thread.sleep(RETRY_BACKOFF_MS[attempt]);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    return;
                }
            }
            // DONE (copied) or STOP (no url / already logged / row gone) → finished.
            if (copyOnce(callLogId, attempt + 1, RETRY_BACKOFF_MS.length) != Step.RETRY) return;
        }
        log.warn("ai-call recording: gave up on callLog {} after {} attempts — recording never became "
                + "fetchable (provider likely never finished uploading)", callLogId, RETRY_BACKOFF_MS.length);
    }

    private Step copyOnce(String callLogId, int attempt, int maxAttempts) {
        try {
            TelephonyCallLog row = callLogRepo.findById(callLogId).orElse(null);
            if (row == null || Boolean.TRUE.equals(row.getRecordingLogged())) return Step.STOP;
            String recordingUrl = row.getRecordingUrl();
            if (recordingUrl == null || recordingUrl.isBlank()) return Step.STOP;
            if (attempt == 1) {
                log.info("ai-call recording: copying callLog {} (provider {}) from {}",
                        callLogId, row.getProviderType(), recordingUrl);
            }

            Optional<RecordingFetcher> fetcherOpt = registry.fetcher(row.getProviderType());
            if (fetcherOpt.isEmpty()) {
                log.warn("ai-call recording: no fetcher registered for provider {} — skipping callLog {}",
                        row.getProviderType(), callLogId);
                return Step.STOP;
            }

            byte[] bytes;
            try (InputStream in = fetcherOpt.get().fetch(recordingUrl, null)) {
                bytes = in.readAllBytes();
            }
            if (bytes.length == 0 || !looksLikeAudio(bytes)) {
                // Almost always "not uploaded to the object store yet" — retry.
                log.info("ai-call recording: callLog {} not ready yet ({} bytes, attempt {}/{}) — will retry",
                        callLogId, bytes.length, attempt, maxAttempts);
                return Step.RETRY;
            }

            // 1) pre-signed PUT URL from media_service (creates FileMetadata, returns {id,url})
            Map<String, String> signed = fileService.getPresignedUploadUrl(
                    "call-recording-" + callLogId + ".mp3", "audio/mpeg", "AI_CALL_RECORDING", callLogId);
            String fileId = signed.get("id");
            String putUrl = signed.get("url");
            if (fileId == null || putUrl == null) {
                log.warn("ai-call recording: media_service returned no pre-signed url for callLog {} (attempt {}/{})",
                        callLogId, attempt, maxAttempts);
                return Step.RETRY;
            }

            // 2) PUT the bytes straight to S3 via the pre-signed URL
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType("audio/mpeg"));
            restTemplate.exchange(URI.create(putUrl), HttpMethod.PUT, new HttpEntity<>(bytes, headers), Void.class);

            // 3) stamp the file id onto the call log so the UI can stream it
            TelephonyCallLog fresh = callLogRepo.findById(callLogId).orElse(null);
            if (fresh == null) return Step.STOP;
            fresh.setRecordingStorageKey(fileId);
            fresh.setRecordingLogged(true);
            callLogRepo.save(fresh);
            log.info("ai-call recording: callLog {} uploaded → storageKey {} (attempt {}/{})",
                    callLogId, fileId, attempt, maxAttempts);
            return Step.DONE;

        } catch (Exception e) {
            // Transient fetch/upload failure — retry within the budget.
            log.warn("ai-call recording attempt {}/{} failed for {}: {}",
                    attempt, maxAttempts, callLogId, e.getMessage());
            return Step.RETRY;
        }
    }

    /**
     * Accept any binary audio (mp3 / wav / ogg / m4a / …); reject only obvious
     * text/markup error responses (HTML, XML, JSON). The earlier mp3-only magic
     * check silently dropped non-mp3 provider recordings.
     */
    private static boolean looksLikeAudio(byte[] bytes) {
        if (bytes == null || bytes.length < 4) return false;
        int b0 = bytes[0] & 0xFF;
        return b0 != '<' && b0 != '{' && b0 != '[';
    }
}

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
 */
@Service
@RequiredArgsConstructor
public class AiCallRecordingService {

    private static final Logger log = LoggerFactory.getLogger(AiCallRecordingService.class);

    private final TelephonyProviderRegistry registry;
    private final FileService fileService;
    private final TelephonyCallLogRepository callLogRepo;
    private final RestTemplate restTemplate = new RestTemplate();

    @Async("aiCallRecordingExecutor")
    public void persistAsync(String callLogId) {
        try {
            TelephonyCallLog row = callLogRepo.findById(callLogId).orElse(null);
            if (row == null || Boolean.TRUE.equals(row.getRecordingLogged())) return;
            String recordingUrl = row.getRecordingUrl();
            if (recordingUrl == null || recordingUrl.isBlank()) return;
            // Log the source URL up front: a provider API host (e.g. api.plivo.com) needs
            // the provider's own auth — our unauthenticated fetch would 401 — whereas a
            // public object-store URL (DO Spaces / S3) fetches fine. This one line tells
            // you which case you're in when the copy fails.
            log.info("ai-call recording: copying callLog {} (provider {}) from {}",
                    callLogId, row.getProviderType(), recordingUrl);

            Optional<RecordingFetcher> fetcherOpt = registry.fetcher(row.getProviderType());
            if (fetcherOpt.isEmpty()) {
                log.warn("ai-call recording: no fetcher registered for provider {} — skipping callLog {}",
                        row.getProviderType(), callLogId);
                return;
            }

            byte[] bytes;
            try (InputStream in = fetcherOpt.get().fetch(recordingUrl, null)) {
                bytes = in.readAllBytes();
            }
            if (bytes.length == 0 || !looksLikeAudio(bytes)) {
                log.warn("ai-call recording: callLog {} fetched {} bytes that aren't audio — skipping",
                        callLogId, bytes.length);
                return;
            }

            // 1) ask media_service for a pre-signed PUT URL (the shared client BBB +
            //    Zoom recordings use — creates the FileMetadata and returns {id, url})
            Map<String, String> signed = fileService.getPresignedUploadUrl(
                    "call-recording-" + callLogId + ".mp3", "audio/mpeg", "AI_CALL_RECORDING", callLogId);
            String fileId = signed.get("id");
            String putUrl = signed.get("url");
            if (fileId == null || putUrl == null) {
                log.warn("ai-call recording: media_service returned no pre-signed url for callLog {}", callLogId);
                return;
            }

            // 2) PUT the bytes straight to S3 via the pre-signed URL
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType("audio/mpeg"));
            restTemplate.exchange(URI.create(putUrl), HttpMethod.PUT, new HttpEntity<>(bytes, headers), Void.class);

            // 3) stamp the file id onto the call log so the UI can stream it
            TelephonyCallLog fresh = callLogRepo.findById(callLogId).orElse(null);
            if (fresh == null) return;
            fresh.setRecordingStorageKey(fileId);
            fresh.setRecordingLogged(true);
            callLogRepo.save(fresh);
            log.info("ai-call recording: callLog {} uploaded via pre-signed url → storageKey {}", callLogId, fileId);

        } catch (Exception e) {
            log.warn("ai-call recording persist failed for {}: {}", callLogId, e.getMessage());
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

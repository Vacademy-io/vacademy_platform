package vacademy.io.admin_core_service.features.telephony.core;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.media_service.service.MediaService;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.TelephonyCallLog;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.TelephonyCallLogRepository;
import vacademy.io.admin_core_service.features.telephony.spi.RecordingFetcher;
import vacademy.io.admin_core_service.features.telephony.spi.dto.ProviderCredentials;
import vacademy.io.admin_core_service.features.timeline.enums.LeadJourneyActionType;
import vacademy.io.admin_core_service.features.timeline.service.TimelineEventService;
import vacademy.io.common.media.dto.FileDetailsDTO;

import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Holds the @Transactional methods of the recording-persistence flow in a
 * separate bean from {@link RecordingPersistenceService} so Spring's proxy
 * actually engages — see the comment on {@link CallLifecycleTxOps} for the
 * full rationale on self-invocation.
 *
 * The async dispatch lives in {@link RecordingPersistenceService#persistAsync}.
 * The two transactional units exposed here both run inside their own
 * REQUIRES_NEW transaction so they commit independently — useful because
 * persistAsync runs on a separate thread and we never want a single
 * recording failure to roll back a sibling that succeeded.
 */
@Service
public class RecordingTxOps {

    private static final Logger log = LoggerFactory.getLogger(RecordingTxOps.class);

    @Autowired private TelephonyCallLogRepository callLogRepo;
    @Autowired private TelephonyConfigCache configCache;
    @Autowired private TelephonyProviderRegistry registry;
    @Autowired private MediaService mediaService;
    @Autowired private TimelineEventService timelineEventService;
    @Autowired private UserMobileResolver userMobileResolver;
    @Autowired private vacademy.io.admin_core_service.features.call_intelligence.core.CallIntelligenceEnqueueService callIntelligenceEnqueueService;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void persist(String callLogId) throws Exception {
        TelephonyCallLog row = callLogRepo.findById(callLogId).orElse(null);
        if (row == null) {
            log.warn("recording persist: callLog {} not found", callLogId);
            return;
        }
        if (Boolean.TRUE.equals(row.getRecordingLogged())) return;
        if (row.getRecordingUrl() == null || row.getRecordingUrl().isBlank()) return;

        TelephonyConfigCache.Resolved resolved = configCache.get(row.getInstituteId())
                .orElseThrow(() -> new IllegalStateException(
                        "telephony config missing for institute " + row.getInstituteId()));

        Optional<RecordingFetcher> fetcherOpt = registry.fetcher(row.getProviderType());
        if (fetcherOpt.isEmpty()) {
            log.warn("no recording fetcher for provider {} — skipping", row.getProviderType());
            return;
        }

        ProviderCredentials creds = resolved.getCredentials();

        byte[] bytes;
        try (InputStream in = fetcherOpt.get().fetch(row.getRecordingUrl(), creds)) {
            bytes = in.readAllBytes();
        }
        if (bytes.length == 0) {
            log.warn("recording fetch returned 0 bytes for call {}", callLogId);
            return;
        }

        // Sanity-check the bytes look like an mp3 before we upload to S3 via
        // media_service. Common failure modes when Exotel's CDN hasn't
        // finished publishing the recording yet:
        //   - 200 OK with an HTML error page in the body
        //   - 200 OK with a tiny placeholder body
        // Either of those uploaded as "audio/mpeg" gives us an unplayable
        // S3 object. Fail loudly so the retry path can pick it up next time.
        if (!looksLikeMp3(bytes)) {
            String preview = new String(bytes, 0, Math.min(bytes.length, 64),
                    java.nio.charset.StandardCharsets.US_ASCII)
                    .replaceAll("[^\\p{Print}]", ".");
            log.warn("recording fetch for call {} returned {} bytes but doesn't look like mp3 "
                    + "(starts with: {}). Will retry via failure-counter ladder.",
                    callLogId, bytes.length, preview);
            throw new IllegalStateException(
                    "Recording bytes do not look like a valid mp3 — likely Exotel CDN not ready yet");
        }
        log.info("recording fetch for call {} → {} bytes, mp3 OK", callLogId, bytes.length);

        TelephonyMultipartBytes multipart = new TelephonyMultipartBytes(
                "file",
                "call-recording-" + callLogId + ".mp3",
                "audio/mpeg",
                bytes);
        // Vacademy Voice (Plivo) + Vacademy AI recordings are PII (parents/minors) →
        // store in the private, SSE-encrypted bucket; playback presigns via the
        // private getter. Every other provider keeps the public-bucket path unchanged.
        boolean usePrivate = vacademy.io.admin_core_service.features.telephony.enums.ProviderType.PLIVO
                .equals(row.getProviderType())
                || vacademy.io.admin_core_service.features.telephony.enums.ProviderType.VACADEMY_AI
                        .equals(row.getProviderType());
        FileDetailsDTO uploaded = usePrivate
                ? mediaService.uploadPrivateFileV2(multipart)
                : mediaService.uploadFileV2(multipart);
        if (uploaded == null || uploaded.getId() == null) {
            throw new IllegalStateException("media_service did not return a file id");
        }
        log.info("recording uploaded for call {} → storageKey={} fileName={} private={}",
                callLogId, uploaded.getId(), uploaded.getFileName(), usePrivate);

        row.setRecordingStorageKey(uploaded.getId());
        row.setRecordingPrivate(usePrivate);
        row.setRecordingLogged(true);
        callLogRepo.save(row);

        writeTimelineEvent(row);

        // Recording is now in our storage — kick off transcription + analysis if the
        // institute has call intelligence on. Best-effort, never throws.
        callIntelligenceEnqueueService.enqueueIfEligible(row);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void bumpFailureAndMaybeAlert(String callLogId) {
        TelephonyCallLog row = callLogRepo.findById(callLogId).orElse(null);
        if (row == null) return;
        int attempts = (row.getRecordingFetchAttempts() == null ? 0 : row.getRecordingFetchAttempts()) + 1;
        row.setRecordingFetchAttempts(attempts);
        callLogRepo.save(row);
        if (attempts >= 5) {
            try {
                timelineEventService.logJourneyEvent(
                        "LEAD",
                        row.getResponseId() != null ? row.getResponseId() : row.getUserId(),
                        LeadJourneyActionType.REACHOUT,
                        "SYSTEM", null, "Vacademy",
                        "Call recording fetch failed",
                        "Tried 5 times — recording not available.",
                        Map.of("call_log_id", row.getId(), "status", row.getStatus()),
                        null);
            } catch (Exception ignored) { /* never block on a logging side-effect */ }
        }
    }

    private void writeTimelineEvent(TelephonyCallLog row) {
        boolean isInbound = "INBOUND".equalsIgnoreCase(row.getDirection());

        Map<String, Object> meta = new HashMap<>();
        meta.put("provider_call_id", row.getProviderCallId());
        meta.put("recording_storage_key", row.getRecordingStorageKey());
        meta.put("status", row.getStatus());
        meta.put("duration_seconds", row.getDurationSeconds());
        meta.put("call_log_id", row.getId());
        meta.put("caller_id", row.getCallerId());
        // Direction is the source of truth for "did the lead call us or did we
        // call the lead?" — frontend renderers (icon, accent colour, label)
        // read this off the metadata so a single timeline-event renderer can
        // handle both directions without duplicating logic.
        meta.put("direction", row.getDirection());

        // Actor: for OUTBOUND the counsellor placed the call → show their name.
        // For INBOUND the LEAD initiated; the counsellor still answered, so
        // we keep their name on the "by" line so it's clear who picked up.
        String actorName = userMobileResolver
                .findDisplayName(row.getCounsellorUserId())
                .orElse(null);

        // Title needs to reflect direction so the timeline doesn't mislabel
        // inbound callbacks as outbound calls. action_type stays as CALL_MADE
        // for both — the existing timeline renderer keys on this and we don't
        // want to break it. Direction-specific styling reads `meta.direction`.
        String title = isInbound ? "Inbound call from lead" : "Outbound call";

        try {
            // Use the 10-arg overload so the event row carries student_user_id
            // — some timeline queries filter by it (and the side-view also
            // groups events under the lead's user for cross-response views).
            timelineEventService.logEvent(
                    "LEAD",
                    row.getResponseId() != null ? row.getResponseId() : row.getUserId(),
                    "CALL_MADE",
                    "USER",
                    row.getCounsellorUserId(),
                    actorName,
                    title,
                    describeOutcome(row),
                    meta,
                    row.getUserId());
        } catch (Exception e) {
            log.warn("timeline event write failed for call {}", row.getId(), e);
        }
    }

    private String describeOutcome(TelephonyCallLog row) {
        Integer d = row.getDurationSeconds();
        String pretty = d == null ? "" : formatDuration(d);
        String label = switch (row.getStatus()) {
            case "COMPLETED" -> "Connected";
            case "NO_ANSWER" -> "No answer";
            case "BUSY"      -> "Busy";
            case "CANCELLED" -> "Cancelled";
            case "FAILED"    -> "Failed";
            default          -> row.getStatus();
        };
        return d == null || d == 0 ? label : pretty + " · " + label;
    }

    private String formatDuration(int seconds) {
        int m = seconds / 60;
        int s = seconds % 60;
        return m + "m " + s + "s";
    }

    /**
     * Magic-byte sanity check for mp3 / MPEG audio. Two cases we accept:
     *   - "ID3" tag at the start (ID3v2-tagged mp3, very common)
     *   - MPEG audio sync word (0xFFF...) anywhere in the first 4 bytes
     * Rejects obvious non-audio responses like HTML error pages ("<htm",
     * "<!do", "<?xm") or empty/very small bodies.
     */
    private static boolean looksLikeMp3(byte[] bytes) {
        if (bytes == null || bytes.length < 4) return false;
        if (bytes[0] == 'I' && bytes[1] == 'D' && bytes[2] == '3') return true;
        // MPEG audio frame sync: 11 high bits set (0xFFE or 0xFFF)
        int b0 = bytes[0] & 0xFF;
        int b1 = bytes[1] & 0xFF;
        if (b0 == 0xFF && (b1 & 0xE0) == 0xE0) return true;
        return false;
    }
}

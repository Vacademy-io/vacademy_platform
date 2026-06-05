package vacademy.io.admin_core_service.features.telephony.core;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * Async dispatcher for recording persistence. The actual work happens in
 * {@link RecordingTxOps} — see the comment there for why the @Transactional
 * methods live on a separate bean (Spring AOP doesn't intercept
 * self-invocation).
 *
 * The @Async on persistAsync ensures the webhook controller never blocks on
 * media_service latency or S3 PUT time — Exotel times webhooks out at ~5s.
 *
 * Initial fetch is delayed because Exotel's StatusCallback includes the
 * RecordingUrl as soon as the call ends, but the actual mp3 file takes
 * 20-40 seconds to appear on their CDN. Fetching too early gives us either
 * an empty body or an HTML error page — both of which we'd happily upload
 * to media_service and store an unplayable file in S3.
 */
@Service
public class RecordingPersistenceService {

    private static final Logger log = LoggerFactory.getLogger(RecordingPersistenceService.class);

    /**
     * Delay before each fetch attempt. Exotel's CDN typically has the mp3
     * within ~30s but can take longer for longer calls. We sleep on the
     * async worker thread, not the webhook thread, so user-facing latency
     * is untouched.
     */
    private static final long[] BACKOFF_MS = { 30_000L, 45_000L, 90_000L };

    @Autowired private RecordingTxOps tx;

    @Async("telephonyRecordingExecutor")
    public void persistAsync(String callLogId) {
        Exception lastError = null;
        for (int attempt = 0; attempt < BACKOFF_MS.length; attempt++) {
            try {
                Thread.sleep(BACKOFF_MS[attempt]);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                log.warn("recording persist interrupted at attempt {} for {}", attempt, callLogId);
                return;
            }
            try {
                tx.persist(callLogId);
                if (attempt > 0) {
                    log.info("recording persist succeeded on attempt {} for {}", attempt + 1, callLogId);
                }
                return;             // success — done
            } catch (Exception e) {
                lastError = e;
                log.warn("recording persist attempt {} of {} failed for {}: {}",
                        attempt + 1, BACKOFF_MS.length, callLogId, e.getMessage());
            }
        }
        log.error("recording persist exhausted all {} retries for {}",
                BACKOFF_MS.length, callLogId, lastError);
        try {
            tx.bumpFailureAndMaybeAlert(callLogId);
        } catch (Exception inner) {
            log.error("failure-counter bump also failed for {}", callLogId, inner);
        }
    }
}

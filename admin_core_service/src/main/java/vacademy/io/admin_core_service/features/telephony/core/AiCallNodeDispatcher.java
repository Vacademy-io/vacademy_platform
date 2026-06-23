package vacademy.io.admin_core_service.features.telephony.core;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.telephony.core.dto.AiCallRequestDTO;

import java.util.concurrent.Executor;

/**
 * Enqueues AI calls for the CALL_AI workflow node onto a serial, paced background
 * worker ({@code aiCallQueueExecutor}).
 *
 * <p>Why: workflow runs are synchronous and, for a bulk sheet upload, fire one
 * CALL_AI node per uploaded lead on the request thread. Dialing Aavtaar inline
 * there would block the upload for minutes and burst the provider. Instead the
 * node {@link #enqueue}s (returns instantly) and a single worker drains the queue
 * one call at a time, with a small gap between calls — so big uploads turn into a
 * steady, batched stream of calls instead of a spike.
 *
 * <p>Caveat: the queue is in-memory (per replica, lost on restart). For
 * at-least-once durability across restarts/replicas the robust path is a
 * DB-backed queue + scheduled drainer (same machinery as the timed retry
 * re-dialer) — tracked as a follow-up.
 */
@Component
public class AiCallNodeDispatcher {

    private static final Logger log = LoggerFactory.getLogger(AiCallNodeDispatcher.class);

    private final AiCallService aiCallService;
    private final Executor executor;

    /** Gap between consecutive queued calls — keeps us under Aavtaar's rate limit. */
    @Value("${aavtaar.queue.pace-ms:300}")
    private long paceMs;

    public AiCallNodeDispatcher(AiCallService aiCallService,
                                @Qualifier("aiCallQueueExecutor") Executor executor) {
        this.aiCallService = aiCallService;
        this.executor = executor;
    }

    /** Place this AI call on the paced background worker; returns immediately. */
    public void enqueue(AiCallRequestDTO req) {
        executor.execute(() -> {
            try {
                aiCallService.placeCall(req, null);
            } catch (Exception e) {
                log.warn("ai-call queue: failed to place call for lead {} (response {}): {}",
                        req.getUserId(), req.getResponseId(), e.getMessage());
            }
            if (paceMs > 0) {
                try {
                    Thread.sleep(paceMs);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                }
            }
        });
    }
}

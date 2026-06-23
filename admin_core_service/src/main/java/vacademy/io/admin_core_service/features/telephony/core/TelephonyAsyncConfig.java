package vacademy.io.admin_core_service.features.telephony.core;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

/**
 * Bounded executor for recording fetches. We never want the provider's
 * webhook thread to block on media_service uploads, but we also don't want
 * an unbounded pool — if Exotel sends 1000 callbacks during an outage we'd
 * exhaust connections.
 */
@Configuration
@EnableAsync
public class TelephonyAsyncConfig {

    @Bean(name = "telephonyRecordingExecutor")
    public Executor telephonyRecordingExecutor() {
        ThreadPoolTaskExecutor ex = new ThreadPoolTaskExecutor();
        ex.setCorePoolSize(4);
        ex.setMaxPoolSize(16);
        ex.setQueueCapacity(200);
        ex.setThreadNamePrefix("telephony-rec-");
        ex.setRejectedExecutionHandler((r, executor) -> {
            // Last-resort: log & drop. The Quartz retry job will pick it up
            // on its next pass based on recording_fetch_attempts.
            org.slf4j.LoggerFactory.getLogger(TelephonyAsyncConfig.class)
                    .warn("recording executor saturated — task dropped, will retry");
        });
        ex.initialize();
        return ex;
    }

    /**
     * Runs bulk "AI calls first for an audience" dispatch off the request thread.
     * Each campaign occupies ONE thread for its whole paced run (it sleeps {@code
     * aavtaar.bulk.pace-ms} between calls), so the pool is intentionally small —
     * a few campaigns run concurrently and the rest queue. The default abort
     * policy throws when the queue is full; AiCallCampaignService turns that into
     * a friendly "try again shortly" error.
     */
    @Bean(name = "aiCallDispatchExecutor")
    public Executor aiCallDispatchExecutor() {
        ThreadPoolTaskExecutor ex = new ThreadPoolTaskExecutor();
        ex.setCorePoolSize(2);
        ex.setMaxPoolSize(4);
        ex.setQueueCapacity(25);
        ex.setThreadNamePrefix("ai-call-bulk-");
        ex.initialize();
        return ex;
    }

    /**
     * Serial, paced worker that actually places AI calls enqueued by the CALL_AI
     * workflow node ({@code AiCallNodeDispatcher}). Decouples dialing from workflow
     * execution: a bulk sheet upload fires many CALL_AI nodes, but each only
     * ENQUEUES here and returns — so the request thread / workflow engine aren't
     * blocked on the Aavtaar HTTP hop, and calls go out one-at-a-time (paced)
     * instead of in a burst. Single thread = strict serial rate. CallerRuns
     * backpressure (never drops) throttles the producer if the queue ever fills.
     */
    @Bean(name = "aiCallQueueExecutor")
    public Executor aiCallQueueExecutor() {
        ThreadPoolTaskExecutor ex = new ThreadPoolTaskExecutor();
        ex.setCorePoolSize(1);
        ex.setMaxPoolSize(1);
        ex.setQueueCapacity(1000);
        ex.setThreadNamePrefix("ai-call-queue-");
        ex.setRejectedExecutionHandler(
                new java.util.concurrent.ThreadPoolExecutor.CallerRunsPolicy());
        ex.initialize();
        return ex;
    }

    /**
     * Dedicated pool for AI-call recording copies (fetch + pre-signed PUT). Kept
     * SEPARATE from telephonyRecordingExecutor because the Exotel recording path
     * sleeps a worker thread for up to ~165s between CDN retries — sharing one pool
     * would let those sleeping tasks starve the AI recording fetches.
     */
    @Bean(name = "aiCallRecordingExecutor")
    public Executor aiCallRecordingExecutor() {
        ThreadPoolTaskExecutor ex = new ThreadPoolTaskExecutor();
        ex.setCorePoolSize(2);
        ex.setMaxPoolSize(4);
        ex.setQueueCapacity(100);
        ex.setThreadNamePrefix("ai-call-rec-");
        ex.initialize();
        return ex;
    }
}

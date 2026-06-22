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
}

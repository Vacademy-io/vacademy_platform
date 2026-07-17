package vacademy.io.admin_core_service.features.engagement.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * Dedicated executor for engagement decisions (I/O-bound LLM + internal HTTP calls).
 * Named-executor convention per TelephonyAsyncConfig / announcementDeliveryExecutor —
 * never share the 4-thread scheduler pool with LLM latency.
 */
@Configuration
public class EngagementConfig {

    @Bean(name = "engagementExecutor")
    public ThreadPoolTaskExecutor engagementExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(8);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("engagement-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);
        executor.initialize();
        return executor;
    }
}

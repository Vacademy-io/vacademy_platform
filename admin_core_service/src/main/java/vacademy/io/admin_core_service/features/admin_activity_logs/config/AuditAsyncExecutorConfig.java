package vacademy.io.admin_core_service.features.admin_activity_logs.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;

/**
 * Dedicated executor for {@link vacademy.io.admin_core_service.features.admin_activity_logs.annotation.Auditable}
 * methods marked {@code async = true}. Kept separate from the shared
 * {@code workflowTaskExecutor} so audit can't starve other async work.
 *
 * <p>{@code CallerRunsPolicy} on saturation: rather than dropping audit
 * rows silently when the queue is full, the calling thread writes the
 * audit row itself — same durability cost as a non-async @Auditable for
 * that one call, never a lost event.
 */
@Configuration
public class AuditAsyncExecutorConfig {

    @Bean(name = "auditAsyncExecutor")
    public Executor auditAsyncExecutor(@Autowired AuditProperties properties) {
        AuditProperties.Async.Executor cfg = properties.getAsync().getExecutor();
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(cfg.getCore());
        executor.setMaxPoolSize(cfg.getMax());
        executor.setQueueCapacity(cfg.getQueue());
        executor.setThreadNamePrefix("audit-async-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.initialize();
        return executor;
    }
}

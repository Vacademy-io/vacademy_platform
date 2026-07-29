package vacademy.io.admin_core_service.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;

/**
 * Bounded default executor for unqualified {@code @Async} methods.
 *
 * Because this app defines other {@link Executor} beans (workflow, telephony),
 * Spring Boot's auto-configured {@code applicationTaskExecutor} backs off and
 * unqualified {@code @Async} silently falls back to
 * {@code SimpleAsyncTaskExecutor} — a new unbounded thread per invocation. The
 * learner-tracking progress cascade runs on that path, so a class-wide quiz
 * submission could spawn hundreds of threads each holding a DB connection.
 *
 * Spring resolves unqualified {@code @Async} against a bean named
 * {@code taskExecutor}; defining it here bounds every such call site.
 * CallerRuns keeps work flowing under saturation instead of dropping it —
 * the HTTP thread absorbs the backpressure.
 */
@Configuration
public class DefaultAsyncConfig {

    @Bean(name = "taskExecutor")
    public Executor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(8);
        executor.setMaxPoolSize(16);
        executor.setQueueCapacity(2000);
        executor.setThreadNamePrefix("app-async-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.initialize();
        return executor;
    }
}

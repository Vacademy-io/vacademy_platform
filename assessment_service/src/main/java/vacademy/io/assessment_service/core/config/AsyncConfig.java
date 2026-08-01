package vacademy.io.assessment_service.core.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;

/**
 * Explicit executor for {@code @Async} work.
 *
 * <p>
 * Without this bean Spring Boot supplies its default {@code applicationTaskExecutor}:
 * core-size 8 with an <em>unbounded</em> queue. Because the queue never fills, the
 * max-size is never reached, so the whole service effectively had 8 async threads —
 * and every marks recalculation triggered by a learner's minute-by-minute auto-save
 * ran through them.
 *
 * <p>
 * The unbounded queue was the more dangerous half. When scoring fell behind during a
 * live exam the backlog grew without limit: the API kept returning 200 quickly while
 * marks silently went staler and staler, and the queued tasks kept every DB connection
 * busy so unrelated endpoints starved. Nothing surfaced the problem until memory grew
 * or results came out wrong.
 *
 * <p>
 * {@link ThreadPoolExecutor.CallerRunsPolicy} is the important choice here. When the
 * queue is genuinely full the submitting thread runs the task itself, which throttles
 * intake at the source instead of dropping work. Dropping would be wrong: a rejected
 * task at submit time means a learner's result is never computed.
 */
@Slf4j
@Configuration
public class AsyncConfig {

    // Declared as the concrete type, not Executor: Spring MVC resolves
    // "applicationTaskExecutor" by AsyncTaskExecutor type for async request
    // handling, and Boot's own auto-configuration declares it the same way.
    @Bean(name = "applicationTaskExecutor")
    @Primary
    public ThreadPoolTaskExecutor applicationTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();

        // Sized against the 20-connection Hikari pool: enough threads to keep the
        // pool busy without so many that they simply queue on connection checkout.
        executor.setCorePoolSize(12);
        executor.setMaxPoolSize(24);

        // Bounded, unlike the Boot default. Deep enough to absorb the end-of-exam
        // submit burst, shallow enough that sustained overload applies backpressure
        // via CallerRunsPolicy rather than accumulating silently.
        executor.setQueueCapacity(2000);

        executor.setThreadNamePrefix("assessment-async-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());

        // Let in-flight scoring finish on shutdown so a rolling deploy mid-exam does
        // not lose a learner's marks calculation.
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);

        executor.initialize();
        log.info("Assessment async executor: core={}, max={}, queueCapacity={}, rejection=CallerRuns",
                executor.getCorePoolSize(), executor.getMaxPoolSize(), 2000);
        return executor;
    }
}

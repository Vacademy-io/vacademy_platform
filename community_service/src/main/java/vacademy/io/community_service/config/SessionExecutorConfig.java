package vacademy.io.community_service.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;

/**
 * Shared thread pools for SSE live-session operations.
 *
 * Before this config: each student SSE connection created its own
 * ScheduledExecutorService (1 daemon thread per student). At 1000 concurrent
 * students that is 1000+ threads (~256 MB of stacks) just for heartbeats.
 *
 * After: 4 shared threads handle heartbeats for every connection;
 * 4 shared threads dispatch slide-broadcast I/O off the teacher's request thread.
 */
@Configuration
public class SessionExecutorConfig {

    /**
     * Shared pool for SSE heartbeat pings.
     * Replaces the per-connection Executors.newSingleThreadScheduledExecutor() in
     * ParticipantSessionController and AdminSessionController.
     */
    @Bean(name = "sseHeartbeatScheduler", destroyMethod = "shutdown")
    public ScheduledExecutorService sseHeartbeatScheduler() {
        return Executors.newScheduledThreadPool(4, r -> {
            Thread t = new Thread(r, "sse-heartbeat");
            t.setDaemon(true);
            return t;
        });
    }

    /**
     * Shared pool for broadcasting slide events to all students.
     * sendSlideToStudents() submits work here so the teacher's HTTP response
     * returns immediately instead of blocking for ~N×1ms.
     */
    @Bean(name = "broadcastExecutor", destroyMethod = "shutdown")
    public ExecutorService broadcastExecutor() {
        return Executors.newFixedThreadPool(4, r -> {
            Thread t = new Thread(r, "sse-broadcast");
            t.setDaemon(true);
            return t;
        });
    }
}

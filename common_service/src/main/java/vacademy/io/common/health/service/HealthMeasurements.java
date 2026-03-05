package vacademy.io.common.health.service;

import com.zaxxer.hikari.HikariDataSource;
import com.zaxxer.hikari.HikariPoolMXBean;
import lombok.extern.slf4j.Slf4j;
import vacademy.io.common.health.dto.HealthDbResponse;
import vacademy.io.common.health.dto.HealthPingResponse;

import javax.sql.DataSource;
import java.lang.management.GarbageCollectorMXBean;
import java.lang.management.ManagementFactory;
import java.lang.management.MemoryUsage;
import java.lang.management.ThreadInfo;
import java.lang.management.ThreadMXBean;
import java.sql.Connection;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;

/**
 * Core health measurement logic shared across all Vacademy services.
 *
 * Not a Spring bean — instantiated by {@link HealthDiagnosticsService} which IS
 * a bean. This keeps the logic pure and easily unit-testable.
 */
@Slf4j
public class HealthMeasurements {

    // ── JVM ─────────────────────────────────────────────────────────────────────

    /**
     * Collect current JVM metrics.
     *
     * GC pause tracking: we record the total GC time at the start of the
     * measurement window (i.e. now vs. since JVM start) and compute the delta
     * on successive calls. For a single call we return the last-observed
     * single-GC-collection time from the MXBean if available, otherwise 0.
     */
    public static HealthPingResponse.JvmMetrics collectJvmMetrics() {
        // ── Memory ──────────────────────────────────────────────────────────────
        MemoryUsage heap = ManagementFactory.getMemoryMXBean().getHeapMemoryUsage();
        long usedMb = heap.getUsed() / (1024 * 1024);
        long maxMb = heap.getMax() / (1024 * 1024);
        int pct = maxMb > 0 ? (int) (usedMb * 100 / maxMb) : 0;

        // ── GC ──────────────────────────────────────────────────────────────────
        // Sum collection time across all GC collectors; report the largest
        // single-collection pause we can observe (granularity: one GC cycle).
        long lastPauseMs = 0;
        List<GarbageCollectorMXBean> gcBeans = ManagementFactory.getGarbageCollectorMXBeans();
        for (GarbageCollectorMXBean gc : gcBeans) {
            long count = gc.getCollectionCount();
            long time = gc.getCollectionTime(); // cumulative ms
            if (count > 0) {
                long avgPause = time / count; // average pause per cycle
                if (avgPause > lastPauseMs) {
                    lastPauseMs = avgPause;
                }
            }
        }

        // ── Threads ─────────────────────────────────────────────────────────────
        ThreadMXBean threadMx = ManagementFactory.getThreadMXBean();
        int live = threadMx.getThreadCount();
        int blocked = 0;
        int waiting = 0;

        // Sample up to 500 thread IDs to avoid performance overhead on
        // high-thread-count services
        long[] allIds = threadMx.getAllThreadIds();
        long[] ids = allIds.length > 500 ? java.util.Arrays.copyOf(allIds, 500) : allIds;
        // getThreadInfo(long[], int) — second arg is maxDepth; 0 means no stack trace
        // (fast)
        ThreadInfo[] infos = threadMx.getThreadInfo(ids, 0);
        for (ThreadInfo ti : infos) {
            if (ti == null)
                continue;
            switch (ti.getThreadState()) {
                case BLOCKED -> blocked++;
                case WAITING, TIMED_WAITING -> waiting++;
                default -> {
                }
            }
        }

        return HealthPingResponse.JvmMetrics.builder()
                .heapUsedMb(usedMb)
                .heapMaxMb(maxMb)
                .heapPercent(pct)
                .gcPauseMsLast(lastPauseMs)
                .threadsLive(live)
                .threadsBlocked(blocked)
                .threadsWaiting(waiting)
                .build();
    }

    // ── Database ─────────────────────────────────────────────────────────────────

    /**
     * Measure DB health with full pool breakdown.
     *
     * Works with any {@link DataSource}. If the underlying pool is HikariCP
     * (the Spring Boot default), extra pool metrics are extracted via
     * {@link HikariPoolMXBean}.
     */
    public static HealthDbResponse measureDb(DataSource ds, String serviceName, String dbType) {
        HealthDbResponse.HealthDbResponseBuilder builder = HealthDbResponse.builder()
                .service(serviceName)
                .dbType(dbType)
                .timestamp(Instant.now());

        // ── Pool stats (HikariCP) ────────────────────────────────────────────────
        // Collect BEFORE acquiring a connection so the numbers reflect the
        // true state the caller would experience.
        extractPoolMetrics(ds, builder);

        // ── Connection acquisition ───────────────────────────────────────────────
        long acquireStart = System.currentTimeMillis();
        try (Connection conn = ds.getConnection()) {
            long acquireMs = System.currentTimeMillis() - acquireStart;

            // ── Query validation ─────────────────────────────────────────────────
            long queryStart = System.currentTimeMillis();
            boolean valid = conn.isValid(5);
            long queryMs = System.currentTimeMillis() - queryStart;

            String dbName = safeGetCatalog(conn);

            return builder
                    .status(valid ? "UP" : "DOWN")
                    .connected(valid)
                    .connectionAcquireMs(acquireMs)
                    .queryExecuteMs(queryMs)
                    .totalLatencyMs(acquireMs + queryMs)
                    .databaseName(dbName)
                    .build();

        } catch (SQLException e) {
            long acquireMs = System.currentTimeMillis() - acquireStart;
            log.warn("[health] DB check failed for {}/{}: {}", serviceName, dbType, e.getMessage());
            return builder
                    .status("DOWN")
                    .connected(false)
                    .connectionAcquireMs(acquireMs)
                    .queryExecuteMs(0)
                    .totalLatencyMs(acquireMs)
                    .error(e.getMessage())
                    .build();
        }
    }

    // ── Private helpers ──────────────────────────────────────────────────────────

    private static void extractPoolMetrics(DataSource ds, HealthDbResponse.HealthDbResponseBuilder builder) {
        try {
            // Unwrap HikariCP — works whether ds is itself HikariDataSource
            // or wrapped (e.g. LazyConnectionDataSourceProxy → HikariDataSource)
            DataSource unwrapped = ds;
            if (ds.isWrapperFor(HikariDataSource.class)) {
                unwrapped = ds.unwrap(HikariDataSource.class);
            }

            if (unwrapped instanceof HikariDataSource hikari) {
                HikariPoolMXBean pool = hikari.getHikariPoolMXBean();
                if (pool != null) {
                    builder.poolActive(pool.getActiveConnections())
                            .poolIdle(pool.getIdleConnections())
                            .poolMax(pool.getTotalConnections()) // total = active + idle + pending
                            .poolWaitCount(pool.getThreadsAwaitingConnection())
                            .poolImpl("HikariCP");
                }
            }
        } catch (Exception e) {
            // Not HikariCP or unwrap not supported — pool metrics simply won't appear
            log.debug("[health] Pool metrics unavailable: {}", e.getMessage());
        }
    }

    private static String safeGetCatalog(Connection conn) {
        try {
            return conn.getCatalog();
        } catch (Exception e) {
            return "unknown";
        }
    }
}

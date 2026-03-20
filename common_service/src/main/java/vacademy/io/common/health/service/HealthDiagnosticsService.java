package vacademy.io.common.health.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import vacademy.io.common.health.dto.HealthDbResponse;
import vacademy.io.common.health.dto.HealthPingResponse;
import vacademy.io.common.health.dto.SlowQueryRecord;

import javax.sql.DataSource;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Spring-managed health service available in every service that includes
 * common_service on its classpath.
 *
 * Provides:
 * 1. Ping response with JVM metrics (heap/GC/threads)
 * 2. DB health with full pool breakdown (acquire vs. query latency, pool
 * saturation)
 *
 * A secondary DataSource bean (read-replica) can be wired optionally via
 * constructor parameter in the service-specific controller if needed.
 * See admin-core-service for an example with master + read-replica.
 */
@Slf4j
@Service
public class HealthDiagnosticsService {

    @Value("${spring.application.name:unknown-service}")
    private String serviceName;

    @Autowired
    private DataSource dataSource;

    @Autowired
    private SlowQueryRegistry slowQueryRegistry;

    // ── Ping ─────────────────────────────────────────────────────────────────────

    /**
     * Builds a ping response including live JVM metrics.
     * Keep this endpoint fast — JVM collection is O(thread-count) but typically <
     * 5ms.
     */
    public HealthPingResponse buildPingResponse() {
        return HealthPingResponse.builder()
                .status("OK")
                .service(serviceName)
                .timestampMs(Instant.now().toEpochMilli())
                .jvm(HealthMeasurements.collectJvmMetrics())
                .build();
    }

    // ── Database
    // ──────────────────────────────────────────────────────────────────

    /**
     * Check the primary (master) DataSource.
     * Returns full pool breakdown so callers can diagnose pool-exhaustion vs.
     * slow-query.
     */
    public HealthDbResponse checkPrimaryDb() {
        return HealthMeasurements.measureDb(dataSource, serviceName, "master");
    }

    /**
     * Check a secondary (read-replica) DataSource.
     */
    public HealthDbResponse checkReplicaDb(DataSource replicaDataSource) {
        return HealthMeasurements.measureDb(replicaDataSource, serviceName, "read-replica");
    }

    // ── Slow Queries
    // ──────────────────────────────────────────────────────────────

    /**
     * Returns a summary of slow method calls captured in this JVM process.
     *
     * Interpretation:
     * - "recent" list: last N slow calls, newest first. Shows what just happened.
     * - "top_offenders": methods with the most slow occurrences since startup.
     * A method appearing here repeatedly → structural problem (bad query, N+1,
     * missing index).
     * - "total_slow_calls_since_start": overall health signal. Normal = 0 or
     * near-0.
     */
    public Map<String, Object> getSlowQuerySummary(int recentLimit) {
        List<SlowQueryRecord> recent = slowQueryRegistry.getRecent(recentLimit);
        var topOffenders = slowQueryRegistry.getTopOffenders(10);
        long totalSlowCalls = slowQueryRegistry.getTotalSlowCalls();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("service", serviceName);
        result.put("timestamp", Instant.now());
        result.put("total_slow_calls_since_start", totalSlowCalls);
        result.put("recent", recent);
        result.put("top_offenders", topOffenders.stream()
                .map(e -> Map.of("method", e.getKey(), "count", e.getValue()))
                .toList());
        return result;
    }
}

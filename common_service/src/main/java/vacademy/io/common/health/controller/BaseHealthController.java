package vacademy.io.common.health.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import vacademy.io.common.health.dto.HealthDbResponse;
import vacademy.io.common.health.dto.HealthPingResponse;
import vacademy.io.common.health.service.HealthDiagnosticsService;

/**
 * Base controller providing standard health endpoints.
 *
 * ── How to use (ONE change per service) ────────────────────────────────────
 *
 * Replace the entire existing HealthDiagnosticsController in each service with:
 *
 * <pre>
 * {@code
 * @RestController
 * @RequestMapping("/auth-service/health") // ← change prefix per service
 * public class HealthDiagnosticsController extends BaseHealthController {
 * }
 * }
 * </pre>
 *
 * That's it. The service gets /ping, /db, and /complete for free.
 *
 * ── Adding service-specific endpoints ──────────────────────────────────────
 *
 * Override or add methods in your subclass:
 *
 * <pre>
 * {
 *     &#64;code
 *     &#64;RestController
 *     &#64;RequestMapping("/admin-core-service/health")
 *     public class HealthDiagnosticsController extends BaseHealthController {
 *
 *         @Autowired
 *         &#64;Qualifier("slaveDataSource")
 *         private DataSource replicaDs;
 *
 *         &#64;GetMapping("/db/read-replica")
 *         public ResponseEntity<HealthDbResponse> getReplicaHealth() {
 *             return ResponseEntity.ok(healthService.checkReplicaDb(replicaDs));
 *         }
 *     }
 * }
 * </pre>
 *
 * ── Endpoints provided ──────────────────────────────────────────────────────
 *
 * GET /{service}/health/ping
 * Ultra-lightweight. Returns status + JVM snapshot (heap %, GC pause, threads).
 * Used by: useServiceLatency hook (client-side latency measurement, every 10s).
 *
 * GET /{service}/health/db
 * DB health with full connection pool breakdown.
 * Returns: connection_acquire_ms, query_execute_ms, pool_wait_count,
 * pool_active/idle/max.
 * Used by: useServiceLatency hook (DB status panel).
 *
 * GET /{service}/health/complete
 * Aggregates ping + db into a single call.
 * Used by: DiagnosticsService in community-service for the full infra report.
 */
public abstract class BaseHealthController {

    @Autowired
    protected HealthDiagnosticsService healthService;

    /**
     * Ultra-lightweight ping with JVM metrics snapshot.
     *
     * Interpretation guide (returned in response body under "jvm"):
     * heap_percent > 80 → GC pressure, consider heap increase
     * gc_pause_ms_last > 100 → GC pause is causing request latency spikes
     * threads_blocked > 0 → lock contention or I/O stall
     * threads_waiting > 200 → thread pool may be exhausted
     */
    @GetMapping("/ping")
    public ResponseEntity<HealthPingResponse> ping() {
        return ResponseEntity.ok(healthService.buildPingResponse());
    }

    /**
     * Primary database health with pool breakdown.
     *
     * Interpretation guide:
     * connection_acquire_ms > 10ms → pool is under pressure
     * connection_acquire_ms > 100ms → pool is exhausted (threads queuing)
     * pool_wait_count > 0 → confirmed pool saturation
     * query_execute_ms > 50ms → DB server is slow (disk/lock/index issue)
     */
    @GetMapping("/db")
    public ResponseEntity<HealthDbResponse> db() {
        return ResponseEntity.ok(healthService.checkPrimaryDb());
    }

    /**
     * Aggregated health summary (ping + db in one call).
     */
    @GetMapping("/complete")
    public ResponseEntity<CompleteHealthResponse> complete() {
        HealthPingResponse ping = healthService.buildPingResponse();
        HealthDbResponse db = healthService.checkPrimaryDb();

        String overallStatus;
        if (!"UP".equals(db.getStatus())) {
            overallStatus = "UNHEALTHY";
        } else if (db.getPoolWaitCount() > 0 || ping.getJvm().getHeapPercent() > 85) {
            overallStatus = "DEGRADED";
        } else {
            overallStatus = "HEALTHY";
        }

        return ResponseEntity.ok(new CompleteHealthResponse(ping, db, overallStatus));
    }

    /**
     * In-process slow method tracker — no DB queries, zero extra load.
     *
     * Query param: ?limit=N (default 20, max 100)
     *
     * Response fields:
     * recent[] → last N slow calls, newest first
     * top_offenders[] → methods ranked by number of slow occurrences since startup
     * A method at the top = structural problem, not a spike
     * total_slow_calls_since_start → baseline signal; should normally be 0 or
     * near-0
     *
     * Interpretation:
     * Same method in top_offenders repeatedly → fix that specific query/method
     * Many different methods in recent (burst) → DB server is overloaded
     * Only sporadic entries → likely transient (lock, cold cache)
     */
    @GetMapping("/slow-queries")
    public ResponseEntity<Object> slowQueries(
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "20") int limit) {
        int capped = Math.min(limit, 100);
        return ResponseEntity.ok(healthService.getSlowQuerySummary(capped));
    }

    /** Simple wrapper for the /complete response. */
    public record CompleteHealthResponse(
            HealthPingResponse ping,
            HealthDbResponse db,
            String overallStatus) {
    }
}

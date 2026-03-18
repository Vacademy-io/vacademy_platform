package vacademy.io.common.health.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;

/**
 * Detailed database health response with connection pool breakdown.
 *
 * The split between connection_acquire_ms and query_execute_ms is the critical
 * diagnostic signal:
 *
 * - High connection_acquire_ms + pool_wait_count > 0 → Pool is exhausted.
 * The app is queuing for a free DB connection. Fix: increase pool size or
 * reduce connection-holding time in slow transactions.
 *
 * - High query_execute_ms + low connection_acquire_ms → The DB itself is slow.
 * Could be: disk I/O, missing index, lock contention, or DB server overload.
 *
 * - Both high → The system is under general overload.
 */
@Data
@Builder
public class HealthDbResponse {

    @JsonProperty("service")
    private String service;

    @JsonProperty("db_type")
    private String dbType; // "master" or "read-replica"

    @JsonProperty("status")
    private String status; // UP | DOWN

    @JsonProperty("connected")
    private boolean connected;

    @JsonProperty("timestamp")
    private Instant timestamp;

    // ── Latency breakdown ──────────────────────────────────────────────────────

    /**
     * Time to acquire a JDBC connection from the pool, in ms.
     * If > 10ms consistently → pool is under pressure.
     * If > 100ms → pool is exhausted and requests are queuing.
     */
    @JsonProperty("connection_acquire_ms")
    private long connectionAcquireMs;

    /**
     * Time for the DB to execute a simple validation query (SELECT 1 / isValid), in
     * ms.
     * Isolates pure DB server latency from pool contention.
     */
    @JsonProperty("query_execute_ms")
    private long queryExecuteMs;

    /** Total round-trip = connection_acquire_ms + query_execute_ms */
    @JsonProperty("total_latency_ms")
    private long totalLatencyMs;

    // ── Pool metrics ───────────────────────────────────────────────────────────

    /**
     * Number of threads currently waiting for a connection from the pool.
     * Any value > 0 means pool capacity is temporarily exceeded.
     * Sustained values > 0 means pool is too small.
     */
    @JsonProperty("pool_wait_count")
    private int poolWaitCount;

    /** Number of active (in-use) connections at time of check. */
    @JsonProperty("pool_active")
    private int poolActive;

    /** Number of idle (available) connections at time of check. */
    @JsonProperty("pool_idle")
    private int poolIdle;

    /** Maximum number of connections the pool can hold. */
    @JsonProperty("pool_max")
    private int poolMax;

    /** Pool implementation name (e.g. "HikariCP"). */
    @JsonProperty("pool_impl")
    private String poolImpl;

    // ── Metadata ───────────────────────────────────────────────────────────────

    @JsonProperty("database_name")
    private String databaseName;

    @JsonProperty("error")
    private String error;
}

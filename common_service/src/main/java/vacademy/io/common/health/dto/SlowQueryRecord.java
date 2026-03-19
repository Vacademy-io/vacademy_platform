package vacademy.io.common.health.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;

/**
 * A single slow method/query record captured in-memory.
 *
 * Source: populated by {@link vacademy.io.common.tracing.SlowQueryLogger}
 * whenever a Repository/Service/Manager method exceeds the slow threshold.
 *
 * No database is involved — this is pure JVM-side interception via AOP.
 */
@Data
@Builder
public class SlowQueryRecord {

    /** Epoch ms when the slow call was observed */
    @JsonProperty("timestamp")
    private Instant timestamp;

    /** Full class.method name, e.g. "UserRepository.findByEmailAndStatus" */
    @JsonProperty("method")
    private String method;

    /**
     * Type of intercepted component.
     * Values: "repository" | "service" | "manager"
     */
    @JsonProperty("type")
    private String type;

    /** How long the method took in milliseconds */
    @JsonProperty("duration_ms")
    private long durationMs;

    /**
     * Severity tier.
     * "warning" → exceeded slow threshold (default: 1000ms)
     * "critical" → exceeded critical threshold (default: 10000ms)
     */
    @JsonProperty("severity")
    private String severity;

    /**
     * Error message if the method threw an exception.
     * Null when the method succeeded (just slowly).
     */
    @JsonProperty("error")
    private String error;

    /** Service/application name — set from spring.application.name */
    @JsonProperty("service")
    private String service;
}

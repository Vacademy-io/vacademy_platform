package vacademy.io.common.tracing;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Configuration properties for performance tracing.
 * 
 * These can be overridden via application.properties, environment variables, or
 * any
 * Spring property source.
 * 
 * Example application.properties:
 * 
 * <pre>
 * vacademy.tracing.enabled=true
 * vacademy.tracing.request-filter-enabled=true
 * vacademy.tracing.slow-query-logger-enabled=true
 * vacademy.tracing.slow-request-threshold-ms=3000
 * vacademy.tracing.critical-request-threshold-ms=30000
 * vacademy.tracing.slow-query-threshold-ms=1000
 * vacademy.tracing.critical-query-threshold-ms=10000
 * </pre>
 * 
 * Environment variable equivalents:
 * 
 * <pre>
 * VACADEMY_TRACING_ENABLED=true
 * VACADEMY_TRACING_REQUEST_FILTER_ENABLED=true
 * VACADEMY_TRACING_SLOW_QUERY_LOGGER_ENABLED=true
 * </pre>
 */
@Component
@ConfigurationProperties(prefix = "vacademy.tracing")
@Getter
@Setter
public class TracingProperties {

    /**
     * Master toggle for all tracing features.
     * Default: true (ON)
     */
    private boolean enabled = true;

    /**
     * Toggle for RequestTracingFilter (HTTP request logging).
     * Default: true (ON)
     */
    private boolean requestFilterEnabled = true;

    /**
     * Toggle for SlowQueryLogger (Repository/Service/Manager method logging).
     * Default: true (ON)
     */
    private boolean slowQueryLoggerEnabled = true;

    /**
     * Toggle for @Traced annotation processing.
     * Default: true (ON)
     */
    private boolean tracedAnnotationEnabled = true;

    // ============ Request Tracing Thresholds ============

    /**
     * Threshold in ms for logging slow HTTP requests as WARNING.
     * Default: 3000ms (3 seconds)
     */
    private long slowRequestThresholdMs = 3000;

    /**
     * Threshold in ms for logging critical HTTP requests as ERROR.
     * Default: 30000ms (30 seconds)
     */
    private long criticalRequestThresholdMs = 30000;

    // ============ Query/Method Tracing Thresholds ============

    /**
     * Threshold in ms for logging slow queries/methods as WARNING.
     * Default: 1000ms (1 second)
     */
    private long slowQueryThresholdMs = 1000;

    /**
     * Threshold in ms for logging critical queries/methods as ERROR.
     * Default: 10000ms (10 seconds)
     */
    private long criticalQueryThresholdMs = 10000;

    /**
     * Check if request filter is effectively enabled (master + individual toggle).
     */
    public boolean isRequestFilterEffectivelyEnabled() {
        return enabled && requestFilterEnabled;
    }

    /**
     * Check if slow query logger is effectively enabled (master + individual
     * toggle).
     */
    public boolean isSlowQueryLoggerEffectivelyEnabled() {
        return enabled && slowQueryLoggerEnabled;
    }

    /**
     * Check if @Traced annotation is effectively enabled (master + individual
     * toggle).
     */
    public boolean isTracedAnnotationEffectivelyEnabled() {
        return enabled && tracedAnnotationEnabled;
    }
}

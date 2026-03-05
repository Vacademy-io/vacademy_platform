package vacademy.io.common.health.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;

/**
 * Minimal ping response for client-side latency measurement.
 * Kept intentionally tiny — every byte added increases measured latency.
 */
@Data
@Builder
public class HealthPingResponse {

    @JsonProperty("status")
    private String status;

    @JsonProperty("service")
    private String service;

    @JsonProperty("timestamp_ms")
    private long timestampMs;

    @JsonProperty("jvm")
    private JvmMetrics jvm;

    @Data
    @Builder
    public static class JvmMetrics {

        /** Heap used, in MB */
        @JsonProperty("heap_used_mb")
        private long heapUsedMb;

        /** Heap max, in MB */
        @JsonProperty("heap_max_mb")
        private long heapMaxMb;

        /** Heap usage as a percentage (0-100) */
        @JsonProperty("heap_percent")
        private int heapPercent;

        /**
         * Duration of the last GC pause in ms.
         * High values (e.g. >100ms) directly cause request latency spikes.
         */
        @JsonProperty("gc_pause_ms_last")
        private long gcPauseMsLast;

        /** Number of live threads */
        @JsonProperty("threads_live")
        private int threadsLive;

        /**
         * Number of threads in BLOCKED state.
         * Positive values indicate lock contention or I/O stalls.
         */
        @JsonProperty("threads_blocked")
        private int threadsBlocked;

        /**
         * Number of threads in WAITING/TIMED_WAITING state.
         * Very high values can indicate thread pool exhaustion.
         */
        @JsonProperty("threads_waiting")
        private int threadsWaiting;
    }
}

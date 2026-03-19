package vacademy.io.common.health.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import vacademy.io.common.health.dto.SlowQueryRecord;

import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * In-memory ring buffer of slow method executions.
 *
 * Written to by {@link vacademy.io.common.tracing.SlowQueryLogger} (the AOP
 * aspect).
 * Read by {@link HealthDiagnosticsService} to expose via GET
 * /health/slow-queries.
 *
 * ── Zero DB pressure
 * ──────────────────────────────────────────────────────────
 * All records are captured at the JPA/application layer, not by querying
 * pg_stat_activity or any DB view. The AOP intercept fires regardless.
 *
 * ── Memory safety ────────────────────────────────────────────────────────────
 * The global ring buffer is capped at MAX_GLOBAL entries (default 200).
 * When full, the oldest entry is evicted (FIFO).
 * Writes are synchronized on the Deque. Reads take a snapshot.
 *
 * ── Interpretation ──────────────────────────────────────────────────────────
 * If the same method appears many times:
 * → That specific query path is consistently slow (missing index, N+1, bad
 * join)
 *
 * If many different methods all appear in a short window:
 * → The DB server itself is under load (use pool breakdown to confirm)
 *
 * If only one sporadic entry:
 * → Likely a cold cache miss or a lock collision — probably transient
 */
@Slf4j
@Component
public class SlowQueryRegistry {

    private static final int MAX_GLOBAL = 200;

    /** Global ring buffer across all method types */
    private final Deque<SlowQueryRecord> ring = new ArrayDeque<>(MAX_GLOBAL + 1);

    /** Per-method call count for frequency analysis */
    private final ConcurrentHashMap<String, AtomicLong> frequencyMap = new ConcurrentHashMap<>();

    @Value("${spring.application.name:unknown-service}")
    private String serviceName;

    /**
     * Record a slow method execution.
     * Called by SlowQueryLogger — must be fast (no I/O, no blocking).
     */
    public void record(String method, String type, long durationMs, String severity, String error) {
        SlowQueryRecord rec = SlowQueryRecord.builder()
                .timestamp(Instant.now())
                .method(method)
                .type(type)
                .durationMs(durationMs)
                .severity(severity)
                .error(error)
                .service(serviceName)
                .build();

        synchronized (ring) {
            if (ring.size() >= MAX_GLOBAL) {
                ring.pollFirst(); // evict oldest
            }
            ring.addLast(rec);
        }

        // Track call frequency per method (lock-free increment)
        frequencyMap.computeIfAbsent(method, k -> new AtomicLong(0)).incrementAndGet();
    }

    /**
     * Returns the last {@code limit} slow records, newest first.
     * Returns a snapshot — safe to iterate without holding the lock.
     */
    public List<SlowQueryRecord> getRecent(int limit) {
        List<SlowQueryRecord> snapshot;
        synchronized (ring) {
            snapshot = new ArrayList<>(ring);
        }
        // Reverse so newest is first
        int size = snapshot.size();
        List<SlowQueryRecord> result = new ArrayList<>(Math.min(limit, size));
        for (int i = size - 1; i >= 0 && result.size() < limit; i--) {
            result.add(snapshot.get(i));
        }
        return result;
    }

    /**
     * Returns the top N most frequently slow methods.
     * Useful for finding the "usual suspects" regardless of recency.
     */
    public List<Map.Entry<String, Long>> getTopOffenders(int limit) {
        return frequencyMap.entrySet().stream()
                .sorted((a, b) -> Long.compare(b.getValue().get(), a.getValue().get()))
                .limit(limit)
                .map(e -> Map.entry(e.getKey(), e.getValue().get()))
                .toList();
    }

    /** Total number of slow calls captured since service start */
    public long getTotalSlowCalls() {
        return frequencyMap.values().stream().mapToLong(AtomicLong::get).sum();
    }

    /** Clear the ring buffer and frequency map (for debugging) */
    public void clear() {
        synchronized (ring) {
            ring.clear();
        }
        frequencyMap.clear();
    }
}

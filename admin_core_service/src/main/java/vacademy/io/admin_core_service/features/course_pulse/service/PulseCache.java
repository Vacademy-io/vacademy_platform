package vacademy.io.admin_core_service.features.course_pulse.service;

import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

/**
 * Tiny in-memory TTL cache so that many teachers polling the SAME batch every ~15s share
 * one query result instead of each hitting the database. Keys are batch-scoped (not
 * teacher-scoped) because every Pulse payload is identical for a given batch — there is no
 * per-teacher personalization — so sharing is safe.
 *
 * Deliberately simple: a short TTL (seconds) means staleness is bounded and the value is
 * recomputed constantly, so there is nothing to invalidate. A cold-key race may compute
 * twice; that is cheaper than the locking needed to prevent it.
 */
@Component
public class PulseCache {

    private record Entry(Object value, long expiresAtMs) {}

    private final Map<String, Entry> store = new ConcurrentHashMap<>();

    /** Guardrail so a long tail of stale keys can't grow unbounded. */
    private static final int SWEEP_THRESHOLD = 1000;

    /**
     * Return the cached value for {@code key} if still fresh, else compute via {@code loader},
     * store it for {@code ttlMillis}, and return it. A non-positive TTL bypasses the cache.
     */
    @SuppressWarnings("unchecked")
    public <T> T get(String key, long ttlMillis, Supplier<T> loader) {
        if (ttlMillis <= 0) {
            return loader.get();
        }
        long now = System.currentTimeMillis();
        Entry hit = store.get(key);
        if (hit != null && hit.expiresAtMs() > now) {
            return (T) hit.value();
        }
        T fresh = loader.get();
        if (store.size() > SWEEP_THRESHOLD) {
            store.entrySet().removeIf(e -> e.getValue().expiresAtMs() <= now);
        }
        store.put(key, new Entry(fresh, now + ttlMillis));
        return fresh;
    }
}

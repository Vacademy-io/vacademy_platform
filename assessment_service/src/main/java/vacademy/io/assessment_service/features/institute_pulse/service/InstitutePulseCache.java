package vacademy.io.assessment_service.features.institute_pulse.service;

import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

/**
 * Tiny in-memory TTL cache so that many admins polling the SAME institute share one query result.
 * Port of {@code PulseCache} in admin_core_service; keys are institute-scoped (not admin-scoped)
 * because the payload is identical for every admin of an institute — there is no
 * per-admin personalization — so sharing is safe.
 *
 * <p><b>Why the cache lives here rather than in the caller.</b> The binding constraint on this
 * rail is this service's 5-connection Hikari pool. A cache in admin_core_service would be
 * per-JVM: N replicas would mean N misses against that pool, and any other caller would bypass
 * it entirely. Caching at the source means every caller shares one entry and the pool is
 * defended by the service that owns it.
 *
 * <p>Deliberately simple: a short TTL means staleness is bounded and the value is recomputed
 * constantly, so there is nothing to invalidate. A cold-key race may compute twice; that is
 * cheaper than the locking needed to prevent it.
 */
@Component
public class InstitutePulseCache {

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

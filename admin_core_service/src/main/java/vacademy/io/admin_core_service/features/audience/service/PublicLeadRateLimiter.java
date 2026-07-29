package vacademy.io.admin_core_service.features.audience.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Abuse cap for the ANONYMOUS website lead endpoints.
 *
 * The open {@code /open/v1/audience/lead/**} routes are unauthenticated by
 * design — that is what lets a visitor submit a form. Until now they had no
 * server-side ceiling at all: the only defence was a client-side honeypot and
 * a minimum time-to-submit, both trivially skipped by anything posting
 * directly. A single script could flood an institute's CRM (and, because each
 * lead creates an auth user, the user table with it).
 *
 * Deliberately simple: an in-memory sliding window per key. It is NOT a
 * distributed limiter — with N replicas the effective ceiling is N x the
 * limit — but it turns "unbounded" into "bounded and noisy", which is the
 * gap that matters. A Redis-backed counter is the upgrade if abuse is ever
 * seen in practice.
 *
 * Limits are per-minute and per-hour on two independent keys:
 *   - the caller's IP (stops one script hammering many institutes)
 *   - the institute (stops one institute's forms being used as a flood vector)
 */
@Service
public class PublicLeadRateLimiter {

    private static final Logger logger = LoggerFactory.getLogger(PublicLeadRateLimiter.class);

    // Per-IP: a human filling forms never approaches this; a script does at once.
    private static final int IP_PER_MINUTE = 8;
    private static final int IP_PER_HOUR = 60;

    // Per-institute: a SAFETY CEILING, not a spam filter. Deliberately far above
    // any real demand — a successful ad campaign can legitimately produce dozens
    // of enquiries an hour, and rejecting a genuine lead is worse than accepting
    // a spam one. This only catches an outright flood; per-IP does the real work.
    private static final int INSTITUTE_PER_MINUTE = 120;
    private static final int INSTITUTE_PER_HOUR = 2_000;

    private static final Duration MINUTE = Duration.ofMinutes(1);
    private static final Duration HOUR = Duration.ofHours(1);

    /** Stop the maps growing without bound on a long-lived pod. */
    private static final int MAX_TRACKED_KEYS = 50_000;

    private final Map<String, Window> minuteWindows = new ConcurrentHashMap<>();
    private final Map<String, Window> hourWindows = new ConcurrentHashMap<>();

    private static final class Window {
        private volatile Instant startedAt;
        private final AtomicInteger count;

        private Window(Instant startedAt) {
            this.startedAt = startedAt;
            this.count = new AtomicInteger(0);
        }
    }

    /**
     * @return true when this submission is within limits; false when it should
     *         be rejected.
     */
    public boolean tryAcquire(String ip, String instituteId) {
        boolean ok = true;
        if (ip != null && !ip.isBlank()) {
            ok &= allow("ip:" + ip, IP_PER_MINUTE, IP_PER_HOUR);
        }
        if (instituteId != null && !instituteId.isBlank()) {
            ok &= allow("inst:" + instituteId, INSTITUTE_PER_MINUTE, INSTITUTE_PER_HOUR);
        }
        return ok;
    }

    private boolean allow(String key, int perMinute, int perHour) {
        return within(minuteWindows, key, MINUTE, perMinute)
                && within(hourWindows, key, HOUR, perHour);
    }

    private boolean within(Map<String, Window> windows, String key, Duration span, int limit) {
        if (windows.size() > MAX_TRACKED_KEYS) {
            // Cheap pressure valve: drop windows that have already rolled over.
            Instant now = Instant.now();
            windows.entrySet().removeIf(e -> e.getValue().startedAt.plus(span).isBefore(now));
        }
        Window w = windows.computeIfAbsent(key, k -> new Window(Instant.now()));
        synchronized (w) {
            Instant now = Instant.now();
            if (w.startedAt.plus(span).isBefore(now)) {
                w.startedAt = now;
                w.count.set(0);
            }
            int used = w.count.incrementAndGet();
            if (used > limit) {
                logger.warn("Public lead rate limit hit for {} ({} in {})", key, used, span);
                return false;
            }
            return true;
        }
    }
}

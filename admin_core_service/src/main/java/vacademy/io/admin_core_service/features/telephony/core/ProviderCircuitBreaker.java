package vacademy.io.admin_core_service.features.telephony.core;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import vacademy.io.common.exceptions.VacademyException;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Lightweight per-provider circuit breaker. Keeps it dependency-free
 * (Resilience4j would be a much bigger surface for a one-purpose guard).
 *
 * State machine per providerType:
 *   CLOSED       - normal. Calls go through.
 *   OPEN         - after N consecutive failures, reject for `coolDown` so we
 *                  don't pile blocked threads onto a dead provider.
 *   HALF_OPEN    - one probe call allowed; success → CLOSED, failure → OPEN.
 *
 * The win: during a provider outage, instead of 1000 connect requests each
 * waiting 8s for a Connect timeout (using up tomcat worker threads), 999 of
 * them fail fast and the user sees a clear "try again in a moment" message.
 */
@Component
public class ProviderCircuitBreaker {

    private static final Logger log = LoggerFactory.getLogger(ProviderCircuitBreaker.class);

    private static final int CONSECUTIVE_FAILURES_TO_OPEN = 5;
    private static final Duration COOLDOWN = Duration.ofSeconds(30);

    private enum State { CLOSED, OPEN, HALF_OPEN }

    private static final class Box {
        final AtomicInteger failures = new AtomicInteger();
        volatile State state = State.CLOSED;
        volatile Instant openedAt;
    }

    private final ConcurrentHashMap<String, Box> byProvider = new ConcurrentHashMap<>();

    public void assertAvailable(String providerType) {
        Box b = byProvider.computeIfAbsent(providerType, k -> new Box());
        if (b.state == State.OPEN) {
            if (b.openedAt != null && Instant.now().isAfter(b.openedAt.plus(COOLDOWN))) {
                b.state = State.HALF_OPEN;
                log.info("circuit half-open for {}", providerType);
            } else {
                throw new VacademyException("Calling provider is temporarily unavailable. Try again in a moment.");
            }
        }
    }

    public void recordSuccess(String providerType) {
        Box b = byProvider.get(providerType);
        if (b == null) return;
        b.failures.set(0);
        if (b.state != State.CLOSED) {
            log.info("circuit closed for {}", providerType);
            b.state = State.CLOSED;
        }
    }

    public void recordFailure(String providerType, Throwable t) {
        Box b = byProvider.computeIfAbsent(providerType, k -> new Box());
        int n = b.failures.incrementAndGet();
        if (b.state == State.HALF_OPEN || n >= CONSECUTIVE_FAILURES_TO_OPEN) {
            b.state = State.OPEN;
            b.openedAt = Instant.now();
            log.warn("circuit OPEN for {} after {} consecutive failures ({}). "
                    + "Subsequent calls fast-fail for {}s.",
                    providerType, n, t.getClass().getSimpleName(), COOLDOWN.getSeconds());
        }
    }
}

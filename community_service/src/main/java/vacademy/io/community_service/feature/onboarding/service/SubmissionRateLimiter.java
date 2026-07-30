package vacademy.io.community_service.feature.onboarding.service;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import vacademy.io.common.exceptions.VacademyException;

import java.time.Duration;
import java.time.Instant;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;

/**
 * Caps how often one caller can hit the unauthenticated onboarding and pricing endpoints.
 *
 * Every submission writes a row and emails the whole team, so an unthrottled loop is both a
 * mailbox flood and a junk-data problem. Deliberately in-memory and per-replica: it is a blunt
 * abuse brake, not an exact quota, and keeping it dependency-free means it cannot itself fail.
 * A determined attacker rotating IPs still gets through — Cloudflare is the right place for that.
 */
@Component
@Slf4j
public class SubmissionRateLimiter {

    @Value("${ONBOARDING_RATE_LIMIT_PER_HOUR:8}")
    private int maxPerHour;

    private static final Duration WINDOW = Duration.ofHours(1);
    /** Bound the map so a flood of distinct IPs can't grow it without limit. */
    private static final int MAX_TRACKED_CALLERS = 10_000;

    private final Map<String, Deque<Instant>> hits = new ConcurrentHashMap<>();

    /** @throws VacademyException 429 when this caller has exceeded the hourly allowance. */
    public void check(HttpServletRequest request, String action) {
        String caller = clientIp(request);
        if (!StringUtils.hasText(caller)) {
            return;
        }
        if (hits.size() > MAX_TRACKED_CALLERS) {
            hits.clear();
        }

        Deque<Instant> window = hits.computeIfAbsent(caller, k -> new ConcurrentLinkedDeque<>());
        Instant cutoff = Instant.now().minus(WINDOW);
        synchronized (window) {
            while (!window.isEmpty() && window.peekFirst().isBefore(cutoff)) {
                window.pollFirst();
            }
            if (window.size() >= maxPerHour) {
                log.warn("Rate limit hit on {} from {} ({} in the last hour)", action, caller, window.size());
                throw new VacademyException(HttpStatus.TOO_MANY_REQUESTS,
                        "That's a lot of submissions in a short time. Please try again later, "
                                + "or email hello@vacademy.io and we'll help directly.");
            }
            window.addLast(Instant.now());
        }
    }

    /** Behind Cloudflare and nginx the socket address is the proxy, so trust the forwarded chain. */
    private static String clientIp(HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        String cf = request.getHeader("CF-Connecting-IP");
        if (StringUtils.hasText(cf)) {
            return cf.trim();
        }
        String forwarded = request.getHeader("X-Forwarded-For");
        if (StringUtils.hasText(forwarded)) {
            // Left-most entry is the original client.
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}

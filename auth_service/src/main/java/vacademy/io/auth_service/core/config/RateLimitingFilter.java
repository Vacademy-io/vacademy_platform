package vacademy.io.auth_service.core.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Rate limiting filter for authentication endpoints.
 * Limits login attempts to prevent brute force attacks.
 *
 * Allows {@value #MAX_ATTEMPTS} requests per IP per {@value #WINDOW_SECONDS}-second window.
 * Returns HTTP 429 (Too Many Requests) with Retry-After header when exceeded.
 */
@Component
public class RateLimitingFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitingFilter.class);

    private static final int MAX_ATTEMPTS = 5;
    private static final int WINDOW_SECONDS = 60;

    /**
     * Endpoints subject to rate limiting.
     */
    private static final String[] RATE_LIMITED_PATHS = {
            "/auth-service/v1/login-root",
            "/auth-service/v1/login-otp",
            "/auth-service/v1/login-whatsapp-otp",
            "/auth-service/v1/request-otp",
            "/auth-service/v1/request-whatsapp-otp",
            "/auth-service/v1/verify-generic-whatsapp-otp-login",
    };

    private final Map<String, RateLimitEntry> requestCounts = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String path = request.getRequestURI();

        if (!isRateLimitedPath(path)) {
            filterChain.doFilter(request, response);
            return;
        }

        String clientIp = getClientIp(request);
        String key = clientIp + ":" + path;

        RateLimitEntry entry = requestCounts.compute(key, (k, existing) -> {
            long now = System.currentTimeMillis();
            if (existing == null || now - existing.windowStart > WINDOW_SECONDS * 1000L) {
                return new RateLimitEntry(now, new AtomicInteger(1));
            }
            existing.count.incrementAndGet();
            return existing;
        });

        if (entry.count.get() > MAX_ATTEMPTS) {
            long elapsedMs = System.currentTimeMillis() - entry.windowStart;
            int retryAfter = Math.max(1, WINDOW_SECONDS - (int) (elapsedMs / 1000));

            log.warn("Rate limit exceeded for IP {} on path {}", clientIp, path);
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setHeader("Retry-After", String.valueOf(retryAfter));
            response.setContentType("application/json");
            String safeRetryAfter = String.valueOf(retryAfter);
            String body = String.format(
                    "{\"error\":\"Too many requests. Please try again after %s seconds.\"}", safeRetryAfter);
            response.getWriter().write(body);
            return;
        }

        filterChain.doFilter(request, response);
    }

    private boolean isRateLimitedPath(String path) {
        for (String limitedPath : RATE_LIMITED_PATHS) {
            if (path.equals(limitedPath)) {
                return true;
            }
        }
        return false;
    }

    private String getClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private static class RateLimitEntry {
        final long windowStart;
        final AtomicInteger count;

        RateLimitEntry(long windowStart, AtomicInteger count) {
            this.windowStart = windowStart;
            this.count = count;
        }
    }
}

package vacademy.io.admin_core_service.features.live_session.controller;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.catalogue_analytics.service.CatalogueAnalyticsRateLimiter;
import vacademy.io.admin_core_service.features.live_session.service.PublicLiveSessionService;

import java.util.Map;

/**
 * Upcoming PUBLIC live classes of an institute, for anonymous visitors of its website
 * (docs/site-assistant/SPEC.md 3.1). No auth: {@code /admin-core-service/open/**} is permitAll in
 * ApplicationSecurityConfig. Rate-limited per IP and per institute with the reader-sized limiter
 * the other open catalogue reads share; cacheable for 60 s. Rules in {@link PublicLiveSessionService}.
 *
 * <p>Server-side callers (ai_service) use the internal mirror
 * {@code /admin-core-service/internal/site-assistant/v1/live-sessions}, which has no per-IP limit.
 */
@RestController
@RequestMapping("/admin-core-service/open/v1/live-sessions")
@RequiredArgsConstructor
public class PublicLiveSessionController {

    private final PublicLiveSessionService service;
    private final CatalogueAnalyticsRateLimiter rateLimiter;

    @GetMapping("/public")
    public ResponseEntity<Map<String, Object>> publicSessions(HttpServletRequest request,
            @RequestParam(value = "instituteId", required = false) String instituteId,
            @RequestParam(value = "from", required = false) String from,
            @RequestParam(value = "days", required = false) String days,
            @RequestParam(value = "limit", required = false) String limit) {
        PublicLiveSessionService.Query query;
        try {
            query = service.parse(instituteId, from, days, limit);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().header("Cache-Control", "no-store")
                    .body(Map.of("error", e.getMessage()));
        }
        if (!rateLimiter.tryAcquire(clientIp(request), query.instituteId())) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).header("Retry-After", "60")
                    .header("Cache-Control", "no-store")
                    .body(Map.of("error", "Too many requests. Try again in a minute."));
        }
        return ResponseEntity.ok()
                .header("Cache-Control", "public, max-age=60")
                .body(service.list(query));
    }

    /** Real client IP behind the ingress/CDN: XFF is a chain, take the first. */
    static String clientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            int comma = xff.indexOf(',');
            return (comma > 0 ? xff.substring(0, comma) : xff).trim();
        }
        String real = request.getHeader("X-Real-IP");
        return (real != null && !real.isBlank()) ? real.trim() : request.getRemoteAddr();
    }
}

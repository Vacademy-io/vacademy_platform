package vacademy.io.common.tracing;

import io.sentry.Breadcrumb;
import io.sentry.ISpan;
import io.sentry.Sentry;
import io.sentry.SentryLevel;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

/**
 * A filter that automatically traces all HTTP requests and logs slow APIs.
 * This filter:
 * - Records request timing information
 * - Logs slow requests (configurable threshold)
 * - Adds breadcrumbs to Sentry for debugging
 * - Tags requests with useful metadata
 * 
 * Can be disabled via:
 * - vacademy.tracing.enabled=false (master toggle)
 * - vacademy.tracing.request-filter-enabled=false (individual toggle)
 * 
 * Add this filter to any Spring Boot service for automatic API latency
 * tracking.
 */
@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestTracingFilter implements Filter {

    @Autowired
    private TracingProperties tracingProperties;

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        // Check if tracing is enabled
        if (!tracingProperties.isRequestFilterEffectivelyEnabled()) {
            chain.doFilter(request, response);
            return;
        }

        if (!(request instanceof HttpServletRequest httpRequest)) {
            chain.doFilter(request, response);
            return;
        }

        HttpServletResponse httpResponse = (HttpServletResponse) response;

        // Extract request info
        String method = httpRequest.getMethod();
        String uri = httpRequest.getRequestURI();
        String queryString = httpRequest.getQueryString();
        String fullPath = queryString != null ? uri + "?" + queryString : uri;
        String clientIp = getClientIp(httpRequest);

        // Start timing
        long startTime = System.nanoTime();

        // Add start breadcrumb to Sentry
        addRequestStartBreadcrumb(method, fullPath, clientIp);

        // Tag the current Sentry span
        tagCurrentSpan(method, uri, clientIp);

        try {
            // Execute the actual request
            chain.doFilter(request, response);
        } finally {
            // Calculate duration
            long durationNanos = System.nanoTime() - startTime;
            long durationMs = TimeUnit.NANOSECONDS.toMillis(durationNanos);

            // Get response status
            int status = httpResponse.getStatus();

            // Log based on duration and status
            logRequestCompletion(method, fullPath, status, durationMs, clientIp);

            // Add completion breadcrumb to Sentry
            addRequestCompleteBreadcrumb(method, fullPath, status, durationMs);
        }
    }

    /**
     * Extract client IP, handling proxies and load balancers
     */
    private String getClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            // Take the first IP if there are multiple
            return xForwardedFor.split(",")[0].trim();
        }
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isEmpty()) {
            return xRealIp;
        }
        return request.getRemoteAddr();
    }

    /**
     * Add request start breadcrumb for Sentry debugging
     */
    private void addRequestStartBreadcrumb(String method, String path, String clientIp) {
        try {
            Breadcrumb breadcrumb = new Breadcrumb();
            breadcrumb.setCategory("http.request");
            breadcrumb.setLevel(SentryLevel.INFO);
            breadcrumb.setMessage(method + " " + path);
            breadcrumb.setData("client_ip", clientIp);
            breadcrumb.setData("phase", "start");
            Sentry.addBreadcrumb(breadcrumb);
        } catch (Exception e) {
            // Silently ignore Sentry errors to not affect the request
        }
    }

    /**
     * Add request completion breadcrumb with timing
     */
    private void addRequestCompleteBreadcrumb(String method, String path, int status, long durationMs) {
        try {
            Breadcrumb breadcrumb = new Breadcrumb();
            breadcrumb.setCategory("http.request");
            breadcrumb.setMessage(method + " " + path + " completed");
            breadcrumb.setData("status", status);
            breadcrumb.setData("duration_ms", durationMs);
            breadcrumb.setData("phase", "complete");

            // Set level based on duration and status
            if (status >= 500 || durationMs >= tracingProperties.getCriticalRequestThresholdMs()) {
                breadcrumb.setLevel(SentryLevel.ERROR);
            } else if (status >= 400 || durationMs >= tracingProperties.getSlowRequestThresholdMs()) {
                breadcrumb.setLevel(SentryLevel.WARNING);
            } else {
                breadcrumb.setLevel(SentryLevel.INFO);
            }

            Sentry.addBreadcrumb(breadcrumb);
        } catch (Exception e) {
            // Silently ignore Sentry errors
        }
    }

    /**
     * Tag the current Sentry span with request metadata
     */
    private void tagCurrentSpan(String method, String uri, String clientIp) {
        try {
            ISpan span = Sentry.getSpan();
            if (span != null) {
                span.setTag("http.method", method);
                span.setTag("http.url", uri);
                span.setTag("client.ip", clientIp);
            }
        } catch (Exception e) {
            // Silently ignore
        }
    }

    /**
     * Log request completion with appropriate log level based on duration
     */
    private void logRequestCompletion(String method, String path, int status, long durationMs, String clientIp) {
        String logMessage = String.format(
                "%s %s | Status: %d | Duration: %dms | Client: %s",
                method, truncatePath(path), status, durationMs, clientIp);

        if (durationMs >= tracingProperties.getCriticalRequestThresholdMs()) {
            // Critical slowness - log as ERROR with full details
            log.error("🔴 CRITICAL SLOW REQUEST: {} | Consider investigating immediately!", logMessage);

            // Also capture in Sentry as a specific event
            captureSentrySlowRequestEvent(method, path, status, durationMs, "critical");

        } else if (durationMs >= tracingProperties.getSlowRequestThresholdMs()) {
            // Slow request - log as WARNING
            log.warn("🟡 SLOW REQUEST: {}", logMessage);

            // Capture in Sentry
            captureSentrySlowRequestEvent(method, path, status, durationMs, "warning");

        } else if (status >= 500) {
            // Server error
            log.error("🔴 SERVER ERROR: {}", logMessage);

        } else if (status >= 400) {
            // Client error - log at debug level (expected behavior)
            log.debug("🟠 CLIENT ERROR: {}", logMessage);

        } else {
            // Normal request
            log.debug("✅ {}", logMessage);
        }
    }

    /**
     * Capture slow request as a Sentry event for alerting
     */
    private void captureSentrySlowRequestEvent(String method, String path, int status, long durationMs,
            String severity) {
        try {
            Sentry.configureScope(scope -> {
                scope.setTag("slow_request", "true");
                scope.setTag("slow_request_severity", severity);
                scope.setExtra("request_duration_ms", String.valueOf(durationMs));
                scope.setExtra("request_method", method);
                scope.setExtra("request_path", path);
                scope.setExtra("response_status", String.valueOf(status));
            });
        } catch (Exception e) {
            // Silently ignore
        }
    }

    /**
     * Truncate long paths for logging (e.g., remove long query strings)
     */
    private String truncatePath(String path) {
        if (path == null)
            return "";
        if (path.length() <= 150)
            return path;
        return path.substring(0, 147) + "...";
    }

    @Override
    public void init(FilterConfig filterConfig) throws ServletException {
        log.info("RequestTracingFilter initialized - Enabled: {}, Slow threshold: {}ms, Critical threshold: {}ms",
                tracingProperties.isRequestFilterEffectivelyEnabled(),
                tracingProperties.getSlowRequestThresholdMs(),
                tracingProperties.getCriticalRequestThresholdMs());
    }

    @Override
    public void destroy() {
        log.info("RequestTracingFilter destroyed");
    }
}

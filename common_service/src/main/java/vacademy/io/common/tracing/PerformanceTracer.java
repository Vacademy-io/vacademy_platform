package vacademy.io.common.tracing;

import io.sentry.*;
import lombok.extern.slf4j.Slf4j;

import java.util.HashMap;
import java.util.Map;
import java.util.function.Supplier;

/**
 * Utility class for performance tracing with Sentry.
 * Use this to create custom spans within transactions to understand
 * exactly where time is being spent in your API calls.
 * 
 * Usage example:
 * 
 * <pre>
 * PerformanceTracer.trace("db.query", "findById", () -> {
 *     return repository.findById(id);
 * });
 * </pre>
 */
@Slf4j
public class PerformanceTracer {

    /**
     * Trace a synchronous operation and return its result.
     * Creates a child span under the current transaction.
     *
     * @param operation   The operation type (e.g., "db.query", "http.client",
     *                    "cache.get")
     * @param description Human-readable description of what's being traced
     * @param action      The code to execute and trace
     * @return The result of the action
     */
    public static <T> T trace(String operation, String description, Supplier<T> action) {
        ISpan parentSpan = Sentry.getSpan();
        if (parentSpan == null) {
            // No active transaction, just execute without tracing
            return action.get();
        }

        ISpan childSpan = parentSpan.startChild(operation, description);
        try {
            T result = action.get();
            childSpan.setStatus(SpanStatus.OK);
            return result;
        } catch (Exception e) {
            childSpan.setStatus(SpanStatus.INTERNAL_ERROR);
            childSpan.setThrowable(e);
            throw e;
        } finally {
            childSpan.finish();
        }
    }

    /**
     * Trace a synchronous operation that doesn't return a value.
     *
     * @param operation   The operation type
     * @param description Human-readable description
     * @param action      The code to execute and trace
     */
    public static void trace(String operation, String description, Runnable action) {
        trace(operation, description, () -> {
            action.run();
            return null;
        });
    }

    /**
     * Trace a database query operation.
     *
     * @param queryName Name of the query (e.g., "findById", "findAllByInstituteId")
     * @param action    The code to execute
     * @return The result of the query
     */
    public static <T> T traceDbQuery(String queryName, Supplier<T> action) {
        return trace("db.query", queryName, action);
    }

    /**
     * Trace an HTTP client call to another service.
     *
     * @param method HTTP method (GET, POST, etc.)
     * @param url    The URL being called
     * @param action The code to execute
     * @return The result
     */
    public static <T> T traceHttpCall(String method, String url, Supplier<T> action) {
        return trace("http.client", method + " " + url, action);
    }

    /**
     * Trace a cache operation.
     *
     * @param operation "get", "set", "delete", etc.
     * @param key       The cache key
     * @param action    The code to execute
     * @return The result
     */
    public static <T> T traceCache(String operation, String key, Supplier<T> action) {
        return trace("cache." + operation, key, action);
    }

    /**
     * Start a custom transaction if none exists.
     * Useful for background jobs or async processing.
     *
     * @param name      Transaction name
     * @param operation Operation type
     * @return The started transaction (remember to finish it!)
     */
    public static ITransaction startTransaction(String name, String operation) {
        TransactionContext context = new TransactionContext(name, operation);
        return Sentry.startTransaction(context);
    }

    /**
     * Log a slow operation warning with timing information.
     * This is useful for identifying slow operations without Sentry dashboard.
     *
     * @param operationName Name of the operation
     * @param startTime     Start time in milliseconds
     * @param thresholdMs   Threshold in milliseconds to trigger warning
     */
    public static void logSlowOperation(String operationName, long startTime, long thresholdMs) {
        long duration = System.currentTimeMillis() - startTime;
        if (duration > thresholdMs) {
            log.warn("SLOW OPERATION: {} took {}ms (threshold: {}ms)",
                    operationName, duration, thresholdMs);

            // Also send to Sentry as a breadcrumb
            Breadcrumb breadcrumb = new Breadcrumb();
            breadcrumb.setCategory("performance");
            breadcrumb.setLevel(SentryLevel.WARNING);
            breadcrumb.setMessage(String.format("Slow operation: %s took %dms", operationName, duration));
            breadcrumb.setData("duration_ms", duration);
            breadcrumb.setData("threshold_ms", thresholdMs);
            Sentry.addBreadcrumb(breadcrumb);
        }
    }

    /**
     * Builder for complex tracing scenarios with tags and data.
     */
    public static class TraceBuilder<T> {
        private final String operation;
        private final String description;
        private final Supplier<T> action;
        private final Map<String, String> tags = new HashMap<>();
        private final Map<String, Object> data = new HashMap<>();

        private TraceBuilder(String operation, String description, Supplier<T> action) {
            this.operation = operation;
            this.description = description;
            this.action = action;
        }

        public static <T> TraceBuilder<T> of(String operation, String description, Supplier<T> action) {
            return new TraceBuilder<>(operation, description, action);
        }

        public TraceBuilder<T> withTag(String key, String value) {
            this.tags.put(key, value);
            return this;
        }

        public TraceBuilder<T> withData(String key, Object value) {
            this.data.put(key, value);
            return this;
        }

        public T execute() {
            ISpan parentSpan = Sentry.getSpan();
            if (parentSpan == null) {
                return action.get();
            }

            ISpan childSpan = parentSpan.startChild(operation, description);
            tags.forEach(childSpan::setTag);
            data.forEach(childSpan::setData);

            try {
                T result = action.get();
                childSpan.setStatus(SpanStatus.OK);
                return result;
            } catch (Exception e) {
                childSpan.setStatus(SpanStatus.INTERNAL_ERROR);
                childSpan.setThrowable(e);
                throw e;
            } finally {
                childSpan.finish();
            }
        }
    }
}

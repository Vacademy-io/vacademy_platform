package vacademy.io.common.tracing;

import io.sentry.Breadcrumb;
import io.sentry.Sentry;
import io.sentry.SentryLevel;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.concurrent.TimeUnit;

/**
 * Aspect that automatically logs slow database queries from Spring Data JPA
 * repositories.
 * 
 * This intercepts all methods in Repository classes and logs timing
 * information.
 * Slow queries are logged as warnings and sent to Sentry for analysis.
 * 
 * Can be disabled via:
 * - vacademy.tracing.enabled=false (master toggle)
 * - vacademy.tracing.slow-query-logger-enabled=false (individual toggle)
 * 
 * Enable by adding @EnableAspectJAutoProxy to your Spring configuration.
 */
@Aspect
@Component
@Slf4j
public class SlowQueryLogger {

    @Autowired
    private TracingProperties tracingProperties;

    /**
     * Intercept all Repository methods (Spring Data JPA) in vacademy.io packages
     * only
     */
    @Around("execution(* vacademy.io..*..*Repository.*(..))")
    public Object logRepositoryMethods(ProceedingJoinPoint joinPoint) throws Throwable {
        if (!tracingProperties.isSlowQueryLoggerEffectivelyEnabled()) {
            return joinPoint.proceed();
        }
        return logMethodExecution(joinPoint, "repository");
    }

    /**
     * Intercept all methods in Service classes in vacademy.io packages only
     * Excludes Spring framework services to prevent conflicts
     */
    @Around("execution(* vacademy.io..*..*Service.*(..))")
    public Object logServiceMethods(ProceedingJoinPoint joinPoint) throws Throwable {
        if (!tracingProperties.isSlowQueryLoggerEffectivelyEnabled()) {
            return joinPoint.proceed();
        }
        return logMethodExecution(joinPoint, "service");
    }

    /**
     * Intercept all methods in Manager classes in vacademy.io packages only
     * Excludes Spring framework managers (like AuthorizationManager) to prevent
     * conflicts
     */
    @Around("execution(* vacademy.io..*..*Manager.*(..))")
    public Object logManagerMethods(ProceedingJoinPoint joinPoint) throws Throwable {
        if (!tracingProperties.isSlowQueryLoggerEffectivelyEnabled()) {
            return joinPoint.proceed();
        }
        return logMethodExecution(joinPoint, "manager");
    }

    /**
     * Common method execution logging logic
     */
    private Object logMethodExecution(ProceedingJoinPoint joinPoint, String type) throws Throwable {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        String className = signature.getDeclaringType().getSimpleName();
        String methodName = signature.getName();
        String fullMethodName = className + "." + methodName;

        long startTime = System.nanoTime();

        try {
            // Execute the actual method
            Object result = joinPoint.proceed();

            // Calculate duration
            long durationNanos = System.nanoTime() - startTime;
            long durationMs = TimeUnit.NANOSECONDS.toMillis(durationNanos);

            // Log if slow
            logIfSlow(fullMethodName, type, durationMs, joinPoint.getArgs(), null);

            return result;

        } catch (Throwable throwable) {
            // Calculate duration even for errors
            long durationNanos = System.nanoTime() - startTime;
            long durationMs = TimeUnit.NANOSECONDS.toMillis(durationNanos);

            // Log the error with timing
            logIfSlow(fullMethodName, type, durationMs, joinPoint.getArgs(), throwable);

            throw throwable;
        }
    }

    /**
     * Log method execution if it exceeded the slow threshold
     */
    private void logIfSlow(String methodName, String type, long durationMs, Object[] args, Throwable error) {
        if (durationMs < tracingProperties.getSlowQueryThresholdMs() && error == null) {
            // Fast and successful - no need to log
            return;
        }

        String argsString = formatArgs(args);

        if (error != null) {
            log.error("❌ {} [{}] FAILED after {}ms | Args: {} | Error: {}",
                    type.toUpperCase(), methodName, durationMs, argsString, error.getMessage());
            addSentryBreadcrumb(methodName, type, durationMs, true, error.getMessage());

        } else if (durationMs >= tracingProperties.getCriticalQueryThresholdMs()) {
            log.error("🔴 CRITICAL SLOW {} [{}] took {}ms | Args: {}",
                    type.toUpperCase(), methodName, durationMs, argsString);
            addSentryBreadcrumb(methodName, type, durationMs, false, null);
            captureSlowMethodEvent(methodName, type, durationMs, argsString, "critical");

        } else if (durationMs >= tracingProperties.getSlowQueryThresholdMs()) {
            log.warn("🟡 SLOW {} [{}] took {}ms | Args: {}",
                    type.toUpperCase(), methodName, durationMs, argsString);
            addSentryBreadcrumb(methodName, type, durationMs, false, null);
            captureSlowMethodEvent(methodName, type, durationMs, argsString, "warning");
        }
    }

    /**
     * Format method arguments for logging (truncated to avoid huge logs)
     */
    private String formatArgs(Object[] args) {
        if (args == null || args.length == 0) {
            return "[]";
        }

        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < args.length; i++) {
            if (i > 0)
                sb.append(", ");
            sb.append(formatArg(args[i]));

            // Limit total length
            if (sb.length() > 200) {
                sb.append("...(truncated)");
                break;
            }
        }
        sb.append("]");
        return sb.toString();
    }

    /**
     * Format a single argument, truncating if necessary
     */
    private String formatArg(Object arg) {
        if (arg == null)
            return "null";

        String str;
        if (arg instanceof String) {
            str = "\"" + arg + "\"";
        } else if (arg.getClass().isArray()) {
            str = Arrays.toString((Object[]) arg);
        } else if (arg instanceof java.util.Collection) {
            java.util.Collection<?> col = (java.util.Collection<?>) arg;
            str = "Collection(size=" + col.size() + ")";
        } else {
            str = arg.toString();
        }

        // Truncate long values
        if (str.length() > 50) {
            return str.substring(0, 47) + "...";
        }
        return str;
    }

    /**
     * Add a breadcrumb to Sentry for slow method execution
     */
    private void addSentryBreadcrumb(String methodName, String type, long durationMs, boolean isError,
            String errorMessage) {
        try {
            Breadcrumb breadcrumb = new Breadcrumb();
            breadcrumb.setCategory(type + ".slow");
            breadcrumb.setMessage(methodName + " took " + durationMs + "ms");
            breadcrumb.setData("method", methodName);
            breadcrumb.setData("duration_ms", durationMs);
            breadcrumb.setData("type", type);

            if (isError) {
                breadcrumb.setLevel(SentryLevel.ERROR);
                breadcrumb.setData("error", errorMessage);
            } else if (durationMs >= tracingProperties.getCriticalQueryThresholdMs()) {
                breadcrumb.setLevel(SentryLevel.ERROR);
            } else {
                breadcrumb.setLevel(SentryLevel.WARNING);
            }

            Sentry.addBreadcrumb(breadcrumb);
        } catch (Exception e) {
            // Silently ignore Sentry errors
        }
    }

    /**
     * Capture slow method as a Sentry event for alerting
     */
    private void captureSlowMethodEvent(String methodName, String type, long durationMs, String args, String severity) {
        try {
            Sentry.configureScope(scope -> {
                scope.setTag("slow_" + type, "true");
                scope.setTag("slow_" + type + "_severity", severity);
                scope.setExtra(type + "_duration_ms", String.valueOf(durationMs));
                scope.setExtra(type + "_method", methodName);
                scope.setExtra(type + "_args", args);
            });
        } catch (Exception e) {
            // Silently ignore
        }
    }
}

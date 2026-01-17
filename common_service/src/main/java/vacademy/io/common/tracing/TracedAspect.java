package vacademy.io.common.tracing;

import io.sentry.ISpan;
import io.sentry.Sentry;
import io.sentry.SpanStatus;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;

/**
 * Aspect that handles the @Traced annotation for explicit method tracing.
 * 
 * Can be disabled via:
 * - vacademy.tracing.enabled=false (master toggle)
 * - vacademy.tracing.traced-annotation-enabled=false (individual toggle)
 */
@Aspect
@Component
@Slf4j
public class TracedAspect {

    @Autowired
    private TracingProperties tracingProperties;

    @Around("@annotation(traced)")
    public Object traceMethod(ProceedingJoinPoint joinPoint, Traced traced) throws Throwable {
        // Check if tracing is enabled
        if (!tracingProperties.isTracedAnnotationEffectivelyEnabled()) {
            return joinPoint.proceed();
        }

        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        String className = signature.getDeclaringType().getSimpleName();
        String methodName = signature.getName();

        // Determine the description
        String description = traced.description().isEmpty()
                ? className + "." + methodName
                : traced.description();

        // Get the parent span (if any)
        ISpan parentSpan = Sentry.getSpan();
        ISpan childSpan = null;

        if (parentSpan != null) {
            childSpan = parentSpan.startChild(traced.operation(), description);
        }

        long startTime = System.nanoTime();

        try {
            Object result = joinPoint.proceed();

            if (childSpan != null) {
                childSpan.setStatus(SpanStatus.OK);
            }

            return result;

        } catch (Throwable throwable) {
            if (childSpan != null) {
                childSpan.setStatus(SpanStatus.INTERNAL_ERROR);
                childSpan.setThrowable(throwable);
            }
            throw throwable;

        } finally {
            long durationMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startTime);

            if (childSpan != null) {
                childSpan.finish();
            }

            // Log if slow
            if (durationMs >= traced.slowThresholdMs()) {
                log.warn("🟡 SLOW @Traced [{}] {} took {}ms (threshold: {}ms)",
                        traced.operation(), description, durationMs, traced.slowThresholdMs());
            }
        }
    }
}

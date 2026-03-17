package vacademy.io.common.tracing;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Annotation to explicitly trace a method with Sentry performance monitoring.
 * 
 * Use this when you want to:
 * - Create a named span for a specific method
 * - Override the automatic tracing with custom naming
 * - Add a method that isn't in a Repository/Service/Manager class
 * 
 * Example usage:
 * 
 * <pre>
 * {@literal @}Traced(operation = "payment.process", description = "Process payment for order")
 * public PaymentResult processPayment(Order order) {
 *     // ...
 * }
 * </pre>
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Traced {

    /**
     * The operation type for Sentry categorization.
     * Examples: "db.query", "http.client", "cache.get", "compute.heavy"
     * Default: "function"
     */
    String operation() default "function";

    /**
     * Human-readable description of what this method does.
     * If empty, the method name will be used.
     */
    String description() default "";

    /**
     * Threshold in milliseconds. If the method takes longer than this,
     * it will be logged as a warning. Default: 1000ms (1 second)
     */
    long slowThresholdMs() default 1000;
}

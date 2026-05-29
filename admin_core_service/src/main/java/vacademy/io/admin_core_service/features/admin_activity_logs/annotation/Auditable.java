package vacademy.io.admin_core_service.features.admin_activity_logs.annotation;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marks a controller (or service) method as an admin-auditable action.
 *
 * <p>Default path: the {@code AuditableAspect} writes one row into
 * {@code admin_activity_log} <em>inside</em> the same transaction as the
 * annotated method, so the audit entry exists if and only if the underlying
 * mutation also committed (transactional outbox).
 *
 * <p>For very high-volume endpoints where the in-transaction INSERT is a
 * proven bottleneck, set {@link #async() async = true} to dispatch the write
 * to a dedicated background executor. This loses atomicity with the business
 * commit; use sparingly.
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Auditable {

    /** Logical entity type, e.g. {@code "COURSE"}, {@code "LEARNER"}. */
    String entityType();

    /** Logical action, e.g. {@code "CREATE"}, {@code "UPDATE"}, {@code "DELETE"}. */
    String action();

    /**
     * Optional SpEL evaluated against method args + {@code #user} + {@code #result}
     * to resolve the affected entity's id. Example: {@code "#req.courseId"}.
     */
    String entityIdExpr() default "";

    /**
     * Optional SpEL producing a human-readable description for the log row.
     */
    String descriptionExpr() default "";

    /**
     * Optional SpEL evaluated <em>before</em> the wrapped method runs, returning
     * the current state of the entity. The result is serialized to JSON and
     * stored in the {@code before_payload} column. Combined with the request
     * body (the "after"), this lets the audit UI show a before/after diff.
     *
     * <p>SpEL bean references are enabled — use {@code @beanName.method(args)}
     * to call into a Spring-managed service, e.g.
     * {@code "@instituteSettingManager.getSettingData(#userDetails, #instituteId, 'NAMING_SETTING').body"}.
     *
     * <p>Failure is non-fatal: a SpEL throw or null return leaves
     * {@code before_payload} as null and the audit row still records normally.
     */
    String captureBefore() default "";

    /** Payload capture mode — see {@link PayloadMode}. */
    PayloadMode payload() default PayloadMode.REDACTED;

    /**
     * Cap on the serialized JSON payload size, in bytes. Bodies above this
     * are truncated with a sentinel marker so JSONB never balloons.
     */
    int maxPayloadBytes() default 64_000;

    /**
     * If {@code true}, the audit row is written by the async dispatcher in a
     * separate transaction. Default {@code false} = atomic in-txn write.
     */
    boolean async() default false;

    enum PayloadMode {
        /** Capture the request body verbatim (still subject to {@code maxPayloadBytes}). */
        FULL,
        /** Capture the body with PII / secret keys masked. (default) */
        REDACTED,
        /** Do not capture the body at all. */
        NONE
    }
}

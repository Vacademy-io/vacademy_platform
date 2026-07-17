package vacademy.io.admin_core_service.features.admin_activity_logs.aspect;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import vacademy.io.admin_core_service.features.admin_activity_logs.annotation.Auditable;
import vacademy.io.admin_core_service.features.admin_activity_logs.async.AsyncAuditDispatcher;
import vacademy.io.admin_core_service.features.admin_activity_logs.config.AuditProperties;
import vacademy.io.admin_core_service.features.admin_activity_logs.entity.AdminActivityLog;
import vacademy.io.admin_core_service.features.admin_activity_logs.repository.AdminActivityLogRepository;
import vacademy.io.admin_core_service.features.admin_activity_logs.service.PayloadRedactor;
import vacademy.io.admin_core_service.features.admin_activity_logs.util.AuditSpelEvaluator;
import vacademy.io.admin_core_service.features.admin_activity_logs.util.RequestContextSnapshot;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.Arrays;
import java.util.Set;

/**
 * Writes one row to {@code admin_activity_log} for each call into a method
 * annotated with {@link Auditable}.
 *
 * <p><strong>Default path (sync, atomic):</strong> the around-advice runs
 * inside the same transaction as the wrapped business call. The audit
 * {@code INSERT} commits with the mutation; a rolled-back mutation rolls
 * back the audit too. This is the transactional outbox guarantee.
 *
 * <p><strong>Async path:</strong> when the annotation sets {@code async = true},
 * the row is built and dispatched to {@link AsyncAuditDispatcher} from the
 * request thread; the business call proceeds without an outer transaction
 * from us. Atomicity is lost — use only for documented bulk endpoints.
 *
 * <p>Order is set to {@code LOWEST_PRECEDENCE - 10} so this advice wraps
 * Spring's own {@code @Transactional} advice on the wrapped method/service.
 */
@Aspect
@Component
@Order(Ordered.LOWEST_PRECEDENCE - 10)
public class AuditableAspect {

    private static final Logger logger = LoggerFactory.getLogger(AuditableAspect.class);

    /** Methods we never log a body for, even if mode = FULL. */
    private static final Set<String> BODYLESS_METHODS = Set.of("GET", "HEAD", "OPTIONS", "DELETE");

    @Autowired
    private AdminActivityLogRepository repository;

    @Autowired
    private AsyncAuditDispatcher asyncDispatcher;

    @Autowired
    private PayloadRedactor payloadRedactor;

    @Autowired
    private AuditSpelEvaluator spelEvaluator;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AuditProperties properties;

    @Around("@annotation(auditable)")
    @Transactional(propagation = Propagation.REQUIRED)
    public Object audit(ProceedingJoinPoint joinPoint, Auditable auditable) throws Throwable {
        long startNanos = System.nanoTime();

        // Snapshot is best-effort. If we can't read the request context we
        // still let the business call run — never break a customer mutation
        // because an audit precondition is missing.
        RequestContextSnapshot snapshot = snapshotRequestContext();

        // If the annotation requested a before-state snapshot, evaluate the
        // SpEL loader *before* proceed(). Done up front so the wrapped call
        // can mutate the underlying row without us re-reading it after.
        // We keep both the raw object (for #before in descriptionExpr) and
        // its JSON serialization (for the before_payload column).
        BeforeSnapshot before = captureBefore(joinPoint, auditable, snapshot);

        if (auditable.async()) {
            return runAsyncPath(joinPoint, auditable, snapshot, startNanos, before);
        }
        return runSyncPath(joinPoint, auditable, snapshot, startNanos, before);
    }

    /** Pair of raw evaluation result + serialized JSON for the audit row. */
    private record BeforeSnapshot(Object raw, String json) {
        static final BeforeSnapshot EMPTY = new BeforeSnapshot(null, null);
    }

    private BeforeSnapshot captureBefore(ProceedingJoinPoint joinPoint,
            Auditable auditable,
            RequestContextSnapshot snapshot) {
        if (auditable.captureBefore() == null || auditable.captureBefore().isBlank()) {
            return BeforeSnapshot.EMPTY;
        }
        if (snapshot == null) {
            return BeforeSnapshot.EMPTY;
        }
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Object[] args = joinPoint.getArgs();
        CustomUserDetails user = findUserArg(args);

        Object before = spelEvaluator.evaluateObject(
                auditable.captureBefore(), signature, args, user, null);
        if (before == null) {
            return BeforeSnapshot.EMPTY;
        }
        try {
            Object tree = objectMapper.convertValue(before, Object.class);
            if (auditable.payload() == Auditable.PayloadMode.REDACTED) {
                tree = payloadRedactor.redact(tree);
            }
            String json = objectMapper.writeValueAsString(tree);
            int cap = auditable.maxPayloadBytes() > 0
                    ? auditable.maxPayloadBytes()
                    : properties.getPayload().getDefaultMaxBytes();
            String capped = json.length() > cap ? json.substring(0, cap) + "...[truncated]" : json;
            return new BeforeSnapshot(before, capped);
        } catch (Exception e) {
            logger.warn("Failed to serialize captureBefore snapshot: {}", e.getMessage());
            // Keep the raw value so #before still works for descriptionExpr,
            // even if JSON serialization failed.
            return new BeforeSnapshot(before, null);
        }
    }

    // ── Default path: in-transaction write ────────────────────────────────

    private Object runSyncPath(ProceedingJoinPoint joinPoint,
            Auditable auditable,
            RequestContextSnapshot snapshot,
            long startNanos,
            BeforeSnapshot before) throws Throwable {
        Object result = joinPoint.proceed();
        long elapsedMs = (System.nanoTime() - startNanos) / 1_000_000L;

        if (snapshot == null || snapshot.getInstituteId() == null) {
            // Missing institute id (no clientId header / no request context).
            // Skip audit; the business call already succeeded.
            logger.debug("Skipping audit for {} — no institute context",
                    joinPoint.getSignature().toShortString());
            return result;
        }

        try {
            AdminActivityLog log = buildLog(joinPoint, auditable, snapshot, result, elapsedMs, before);
            if (log != null) {
                repository.save(log);
            }
        } catch (Exception e) {
            // We're inside the business transaction. A throw here would
            // roll back the customer's mutation, which is too costly for
            // an audit issue. Swallow and log loudly.
            logger.error("Audit write failed for {} — business transaction left intact",
                    joinPoint.getSignature().toShortString(), e);
        }
        return result;
    }

    // ── Async path: fire-and-forget on a separate executor ────────────────

    private Object runAsyncPath(ProceedingJoinPoint joinPoint,
            Auditable auditable,
            RequestContextSnapshot snapshot,
            long startNanos,
            BeforeSnapshot before) throws Throwable {
        Object result = joinPoint.proceed();
        long elapsedMs = (System.nanoTime() - startNanos) / 1_000_000L;

        if (snapshot == null || snapshot.getInstituteId() == null) {
            return result;
        }

        try {
            AdminActivityLog log = buildLog(joinPoint, auditable, snapshot, result, elapsedMs, before);
            if (log != null) {
                asyncDispatcher.dispatch(log);
            }
        } catch (Exception e) {
            logger.error("Async audit dispatch failed for {}",
                    joinPoint.getSignature().toShortString(), e);
        }
        return result;
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private AdminActivityLog buildLog(ProceedingJoinPoint joinPoint,
            Auditable auditable,
            RequestContextSnapshot snapshot,
            Object result,
            long elapsedMs,
            BeforeSnapshot before) {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Object[] args = joinPoint.getArgs();

        CustomUserDetails user = findUserArg(args);
        Object beforeRaw = before == null ? null : before.raw();
        String beforeJson = before == null ? null : before.json();

        if (!passesCondition(auditable, signature, args, user, result, beforeRaw)) {
            return null;
        }

        String action = resolveAction(auditable, signature, args, user, result, beforeRaw);
        if (action == null) {
            // `action` is NOT NULL — a row without one would fail the insert.
            logger.warn("Skipping audit for {} — actionExpr '{}' yielded nothing and no static action() fallback",
                    signature.toShortString(), auditable.actionExpr());
            return null;
        }

        String entityId = spelEvaluator.evaluateString(
                auditable.entityIdExpr(), signature, args, user, result, beforeRaw);
        String description = spelEvaluator.evaluateString(
                auditable.descriptionExpr(), signature, args, user, result, beforeRaw);

        String payloadJson = serializePayload(auditable, snapshot.getHttpMethod(), args);

        return AdminActivityLog.builder()
                .instituteId(snapshot.getInstituteId())
                .actorId(snapshot.getActorId())
                .actorName(snapshot.getActorName())
                .actorEmail(snapshot.getActorEmail())
                .entityType(auditable.entityType())
                .entityId(entityId)
                .action(action)
                .httpMethod(snapshot.getHttpMethod())
                .endpoint(truncate(snapshot.getEndpoint(), 512))
                .description(description)
                .requestPayload(payloadJson)
                .beforePayload(beforeJson)
                .ipAddress(snapshot.getIpAddress())
                .userAgent(truncate(snapshot.getUserAgent(), 512))
                .responseStatus(200) // We're past proceed() — exception path doesn't reach here
                .responseTimeMs(elapsedMs)
                .build();
    }

    /**
     * Resolves the row's action: {@code actionExpr} first, falling back to the
     * static {@code action()}. Returns null when neither yields a value, which
     * tells the caller to skip the row rather than fail the insert.
     */
    private String resolveAction(Auditable auditable,
            MethodSignature signature,
            Object[] args,
            CustomUserDetails user,
            Object result,
            Object beforeRaw) {
        if (auditable.actionExpr() != null && !auditable.actionExpr().isBlank()) {
            String resolved = spelEvaluator.evaluateString(
                    auditable.actionExpr(), signature, args, user, result, beforeRaw);
            if (resolved != null && !resolved.isBlank()) {
                return truncate(resolved.trim(), 64);
            }
        }
        String fallback = auditable.action();
        return fallback == null || fallback.isBlank() ? null : fallback;
    }

    /**
     * A blank {@code conditionExpr} means "always audit". Otherwise the row is
     * written only on an explicit true — a null (failed eval) skips, so we never
     * record an action we are not sure happened.
     */
    private boolean passesCondition(Auditable auditable,
            MethodSignature signature,
            Object[] args,
            CustomUserDetails user,
            Object result,
            Object beforeRaw) {
        if (auditable.conditionExpr() == null || auditable.conditionExpr().isBlank()) {
            return true;
        }
        Object value = spelEvaluator.evaluateObject(
                auditable.conditionExpr(), signature, args, user, result, beforeRaw);
        return Boolean.TRUE.equals(value);
    }

    private String serializePayload(Auditable auditable, String httpMethod, Object[] args) {
        if (auditable.payload() == Auditable.PayloadMode.NONE) {
            return null;
        }
        if (httpMethod != null && BODYLESS_METHODS.contains(httpMethod.toUpperCase())) {
            return null;
        }
        Object body = findBodyArg(args);
        if (body == null) {
            return null;
        }
        try {
            // Convert DTO -> generic tree; redact (if needed); serialize.
            Object tree = objectMapper.convertValue(body, Object.class);
            if (auditable.payload() == Auditable.PayloadMode.REDACTED) {
                tree = payloadRedactor.redact(tree);
            }
            String json = objectMapper.writeValueAsString(tree);
            int cap = auditable.maxPayloadBytes() > 0
                    ? auditable.maxPayloadBytes()
                    : properties.getPayload().getDefaultMaxBytes();
            if (json.length() > cap) {
                return json.substring(0, cap) + "...[truncated]";
            }
            return json;
        } catch (Exception e) {
            logger.warn("Failed to serialize audit payload: {}", e.getMessage());
            return null;
        }
    }

    private Object findBodyArg(Object[] args) {
        if (args == null) {
            return null;
        }
        // First non-primitive, non-framework arg — the @RequestBody DTO.
        // Skip CustomUserDetails (injected via @RequestAttribute) and known
        // Spring-bound types like MultipartFile etc.
        for (Object arg : args) {
            if (arg == null) continue;
            if (arg instanceof CustomUserDetails) continue;
            if (arg instanceof String) continue;
            if (arg instanceof Number) continue;
            if (arg instanceof Boolean) continue;
            if (arg.getClass().getName().startsWith("org.springframework.")) continue;
            if (arg.getClass().getName().startsWith("jakarta.servlet.")) continue;
            return arg;
        }
        return null;
    }

    private CustomUserDetails findUserArg(Object[] args) {
        if (args == null) return null;
        return Arrays.stream(args)
                .filter(a -> a instanceof CustomUserDetails)
                .map(a -> (CustomUserDetails) a)
                .findFirst()
                .orElse(null);
    }

    private RequestContextSnapshot snapshotRequestContext() {
        RequestAttributes attrs = RequestContextHolder.getRequestAttributes();
        if (!(attrs instanceof ServletRequestAttributes servletAttrs)) {
            return null;
        }
        HttpServletRequest request = servletAttrs.getRequest();
        String instituteId = request.getHeader("clientId");

        Object userAttr = request.getAttribute("user");
        CustomUserDetails user = userAttr instanceof CustomUserDetails u ? u : null;

        return RequestContextSnapshot.builder()
                .instituteId(instituteId)
                .actorId(user != null ? user.getUserId() : null)
                .actorName(user != null ? user.getFullName() : null)
                .actorEmail(user != null ? user.getUsername() : null)
                .httpMethod(request.getMethod())
                .endpoint(request.getRequestURI())
                .ipAddress(extractIp(request))
                .userAgent(request.getHeader("User-Agent"))
                .build();
    }

    private String extractIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        String real = request.getHeader("X-Real-IP");
        if (real != null && !real.isBlank()) {
            return real;
        }
        return request.getRemoteAddr();
    }

    private String truncate(String value, int max) {
        if (value == null || value.length() <= max) return value;
        return value.substring(0, max);
    }
}

package vacademy.io.admin_core_service.features.admin_activity_logs.util;

import org.aspectj.lang.reflect.MethodSignature;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.context.expression.BeanFactoryResolver;
import org.springframework.core.DefaultParameterNameDiscoverer;
import org.springframework.core.ParameterNameDiscoverer;
import org.springframework.expression.Expression;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.spel.SpelCompilerMode;
import org.springframework.expression.spel.SpelParserConfiguration;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.StandardEvaluationContext;
import org.springframework.stereotype.Component;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.lang.reflect.Method;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Parses and caches SpEL expressions used by the {@code @Auditable} annotation.
 *
 * <p>Compilation in MIXED mode promotes hot expressions to bytecode after a few
 * invocations, dropping per-call cost to single-digit microseconds.
 *
 * <p>The evaluation context supports:
 * <ul>
 *   <li>Method parameters by name ({@code #paramName})</li>
 *   <li>{@code #user} — the resolved {@link CustomUserDetails} if any</li>
 *   <li>{@code #result} — the wrapped method's return value (null pre-call)</li>
 *   <li>{@code @beanName.method(args)} — Spring bean references for loaders</li>
 * </ul>
 */
@Component
public class AuditSpelEvaluator {

    private static final Logger logger = LoggerFactory.getLogger(AuditSpelEvaluator.class);

    private final ExpressionParser parser = new SpelExpressionParser(
            new SpelParserConfiguration(SpelCompilerMode.MIXED, getClass().getClassLoader()));
    private final ConcurrentHashMap<String, Expression> cache = new ConcurrentHashMap<>();
    private final ParameterNameDiscoverer parameterNameDiscoverer = new DefaultParameterNameDiscoverer();

    @Autowired
    private ApplicationContext applicationContext;

    /**
     * Evaluate {@code expression} against the method's args and return its
     * value as a String. Returns {@code null} on parse/eval failure.
     */
    public String evaluateString(String expression,
            MethodSignature signature,
            Object[] args,
            CustomUserDetails user,
            Object result,
            Object before) {
        Object value = evaluateObject(expression, signature, args, user, result, before);
        return value == null ? null : value.toString();
    }

    /** Convenience overload — no {@code #before} value available. */
    public String evaluateString(String expression,
            MethodSignature signature,
            Object[] args,
            CustomUserDetails user,
            Object result) {
        return evaluateString(expression, signature, args, user, result, null);
    }

    /**
     * Evaluate {@code expression} and return the raw value (any Object). Used
     * by {@code captureBefore} where we want a real domain object to serialize,
     * not its {@code toString()}. Returns {@code null} on parse/eval failure
     * — audit must never crash a request.
     */
    public Object evaluateObject(String expression,
            MethodSignature signature,
            Object[] args,
            CustomUserDetails user,
            Object result,
            Object before) {
        if (expression == null || expression.isBlank()) {
            return null;
        }
        try {
            StandardEvaluationContext ctx = buildContext(signature, args, user, result, before);
            Expression expr = cache.computeIfAbsent(expression, parser::parseExpression);
            return expr.getValue(ctx);
        } catch (Exception e) {
            logger.warn("SpEL evaluation failed for expression '{}': {}", expression, e.getMessage());
            return null;
        }
    }

    /** Convenience overload — no {@code #before} value available. */
    public Object evaluateObject(String expression,
            MethodSignature signature,
            Object[] args,
            CustomUserDetails user,
            Object result) {
        return evaluateObject(expression, signature, args, user, result, null);
    }

    private StandardEvaluationContext buildContext(MethodSignature signature,
            Object[] args,
            CustomUserDetails user,
            Object result,
            Object before) {
        StandardEvaluationContext ctx = new StandardEvaluationContext();
        // Enables `@beanName.method()` references in SpEL.
        ctx.setBeanResolver(new BeanFactoryResolver(applicationContext));

        Method method = signature.getMethod();
        String[] paramNames = parameterNameDiscoverer.getParameterNames(method);
        if (paramNames != null) {
            for (int i = 0; i < paramNames.length && i < args.length; i++) {
                ctx.setVariable(paramNames[i], args[i]);
            }
        }
        ctx.setVariable("user", user);
        ctx.setVariable("result", result);
        // `#before` exposes the result of @Auditable(captureBefore="..."). Lets
        // descriptionExpr reference data that only existed before the mutation
        // (e.g. names of rows about to be deleted).
        ctx.setVariable("before", before);
        return ctx;
    }
}

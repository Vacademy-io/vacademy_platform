package vacademy.io.admin_core_service.features.workflow.spel;

import lombok.extern.slf4j.Slf4j;
import org.springframework.expression.Expression;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.TypeLocator;
import org.springframework.expression.spel.SpelEvaluationException;
import org.springframework.expression.spel.SpelParseException;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.StandardEvaluationContext;
import org.springframework.expression.spel.support.StandardTypeLocator;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Set;

/**
 * SpEL (Spring Expression Language) evaluator with enhanced error tracking.
 * Tracks evaluation failures for workflow execution logging.
 */
@Slf4j
@Component
public class SpelEvaluator {

    /**
     * Evaluates a SpEL expression with the given context variables.
     *
     * @param expressionString The SpEL expression to evaluate
     * @param contextVars      Context variables available to the expression
     * @return The evaluated result, or null if evaluation fails
     * @throws SpelEvaluationError if evaluation fails (for error tracking)
     */
    public Object evaluate(String expressionString, Map<String, Object> contextVars) {
        if (expressionString == null || expressionString.isBlank()) {
            return null;
        }

        String exprStr = expressionString.trim();

        ExpressionParser parser = new SpelExpressionParser();
        StandardEvaluationContext context = new StandardEvaluationContext(contextVars);
        context.setTypeLocator(new SafeTypeLocator());
        context.setVariable("ctx", contextVars);

        try {
            Expression expr = parser.parseExpression(exprStr);
            Object result = expr.getValue(context);
            log.debug("Successfully evaluated SpEL expression: {}", exprStr);
            return result;
        } catch (SpelEvaluationException e) {
            log.error("SpEL evaluation failed for expression: '{}'. Context keys: {}. Error: {}",
                    exprStr, contextVars != null ? contextVars.keySet() : "null", e.getMessage());

            // Throw custom exception for error tracking
            throw new SpelEvaluationError(
                    "Failed to evaluate SpEL expression: " + exprStr,
                    exprStr,
                    contextVars,
                    e);
        } catch (SpelParseException e) {
            log.error("SpEL parse failed for expression: '{}'. Error: {}", exprStr, e.getMessage());

            throw new SpelEvaluationError(
                    "Failed to parse SpEL expression: " + exprStr,
                    exprStr,
                    contextVars,
                    e);
        } catch (Exception e) {
            log.error("Unexpected error evaluating SpEL expression: '{}'. Error: {}", exprStr, e.getMessage(), e);

            throw new SpelEvaluationError(
                    "Unexpected error evaluating SpEL expression: " + exprStr,
                    exprStr,
                    contextVars,
                    e);
        }
    }

    /**
     * Evaluates a SpEL expression and returns null on failure instead of throwing
     * exception.
     * Useful for optional expressions where failure should not stop execution.
     *
     * @param expressionString The SpEL expression to evaluate
     * @param contextVars      Context variables available to the expression
     * @return The evaluated result, or null if evaluation fails
     */
    public Object evaluateSafe(String expressionString, Map<String, Object> contextVars) {
        try {
            return evaluate(expressionString, contextVars);
        } catch (SpelEvaluationError e) {
            log.warn("SpEL evaluation failed (safe mode): {}", e.getMessage());
            return null;
        }
    }

    /**
     * Type locator that allows safe JDK types but blocks dangerous ones
     * like Runtime, ProcessBuilder, Class, etc.
     */
    private static class SafeTypeLocator implements TypeLocator {
        private static final Set<String> BLOCKED_PACKAGES = Set.of(
                "java.lang.Runtime", "java.lang.ProcessBuilder", "java.lang.System",
                "java.lang.Class", "java.lang.ClassLoader", "java.lang.Thread",
                "java.lang.reflect", "java.io.File", "java.nio.file",
                "javax.script", "java.net.URL", "java.net.URI"
        );

        private final StandardTypeLocator delegate = new StandardTypeLocator();

        @Override
        public Class<?> findType(String typeName) {
            for (String blocked : BLOCKED_PACKAGES) {
                if (typeName.startsWith(blocked)) {
                    throw new IllegalStateException("Type access denied for security: " + typeName);
                }
            }
            return delegate.findType(typeName);
        }
    }

    /**
     * Custom exception for SpEL evaluation errors.
     * Includes expression and context for detailed error logging.
     */
    public static class SpelEvaluationError extends RuntimeException {
        private final String expression;
        private final Map<String, Object> context;

        public SpelEvaluationError(String message, String expression, Map<String, Object> context, Throwable cause) {
            super(message, cause);
            this.expression = expression;
            this.context = context;
        }

        public String getExpression() {
            return expression;
        }

        public Map<String, Object> getContext() {
            return context;
        }

        public String getDetailedMessage() {
            return String.format("Expression: '%s', Context keys: %s, Error: %s",
                    expression,
                    context != null ? context.keySet() : "null",
                    getMessage());
        }
    }
}

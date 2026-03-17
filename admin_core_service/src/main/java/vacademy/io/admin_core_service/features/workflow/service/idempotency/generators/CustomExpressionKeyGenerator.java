package vacademy.io.admin_core_service.features.workflow.service.idempotency.generators;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.workflow.dto.IdempotencySettings;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowTrigger;
import vacademy.io.admin_core_service.features.workflow.enums.IdempotencyStrategy;
import vacademy.io.admin_core_service.features.workflow.service.idempotency.IdempotencyKeyGenerator;
import vacademy.io.admin_core_service.features.workflow.spel.SpelEvaluator;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * Generates idempotency keys using custom SpEL expressions.
 * Provides maximum flexibility for complex key generation logic.
 * Supports optional time-window component for temporal deduplication.
 * 
 * Available variables in expression:
 * - triggerId: The workflow trigger ID
 * - eventName: The event name
 * - eventId: The event ID
 * - ctx: The context map with all available data
 * 
 * Example expression: "#{ctx['user']['email']}"
 * With ttlMinutes: Result appends time window (e.g.,
 * "john@example.com_1704211200000")
 * Without ttlMinutes: Result is just the evaluated expression (e.g.,
 * "john@example.com")
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CustomExpressionKeyGenerator implements IdempotencyKeyGenerator {

    private final SpelEvaluator spelEvaluator;

    @Override
    public String generateKey(WorkflowTrigger trigger, String eventName, String eventId,
            Map<String, Object> context, IdempotencySettings settings) {

        if (settings.getCustomExpression() == null || settings.getCustomExpression().isBlank()) {
            throw new IllegalArgumentException("CUSTOM_EXPRESSION strategy requires customExpression to be configured");
        }

        // Build evaluation context with available variables
        Map<String, Object> evalContext = new HashMap<>();
        evalContext.put("triggerId", trigger.getId());
        evalContext.put("eventName", eventName);
        evalContext.put("eventId", eventId);
        context.putAll(evalContext);

        try {
            Object result = spelEvaluator.evaluate(settings.getCustomExpression(), context);

            if (result == null) {
                throw new IllegalArgumentException("Custom expression evaluated to null");
            }

            String baseKey = result.toString();

            // If ttlMinutes is configured, append time window component
            if (settings.getTtlMinutes() != null && settings.getTtlMinutes() > 0) {
                long currentTimeMillis = Instant.now().toEpochMilli();
                long windowMillis = (long) (settings.getTtlMinutes() * 60 * 1000);
                long roundedTimestamp = (currentTimeMillis / windowMillis) * windowMillis;

                String key = baseKey + "_" + roundedTimestamp;
                log.debug("Generated CUSTOM_EXPRESSION strategy key with time window: {} (expression: {}, ttl: {} min)",
                        key, settings.getCustomExpression(), settings.getTtlMinutes());
                return key;
            }

            log.debug("Generated CUSTOM_EXPRESSION strategy key: {} (expression: {})",
                    baseKey, settings.getCustomExpression());
            return baseKey;

        } catch (Exception e) {
            log.error("Error evaluating custom expression: {}", settings.getCustomExpression(), e);
            throw new IllegalArgumentException(
                    "Failed to evaluate custom expression: " + settings.getCustomExpression(), e);
        }
    }

    @Override
    public boolean supports(IdempotencySettings settings) {
        return settings != null && IdempotencyStrategy.CUSTOM_EXPRESSION.equals(settings.getStrategy());
    }
}

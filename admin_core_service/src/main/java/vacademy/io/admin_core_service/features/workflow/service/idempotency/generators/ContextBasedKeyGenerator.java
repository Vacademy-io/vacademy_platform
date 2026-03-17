package vacademy.io.admin_core_service.features.workflow.service.idempotency.generators;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.workflow.dto.IdempotencySettings;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowTrigger;
import vacademy.io.admin_core_service.features.workflow.enums.IdempotencyStrategy;
import vacademy.io.admin_core_service.features.workflow.service.idempotency.IdempotencyKeyGenerator;

import java.util.List;
import java.util.Map;

/**
 * Generates idempotency keys based on specific context fields.
 * Prevents duplicate executions for the same context values (e.g., userId,
 * packageId).
 * 
 * Key format:
 * trigger_{triggerId}_{field1Name}_{field1Value}_{field2Name}_{field2Value}
 * Example: trigger_abc123_userId_user456_packageId_pkg789
 */
@Slf4j
@Component
public class ContextBasedKeyGenerator implements IdempotencyKeyGenerator {

    @Override
    public String generateKey(WorkflowTrigger trigger, String eventName, String eventId,
            Map<String, Object> context, IdempotencySettings settings) {

        List<String> contextFields = settings.getContextFields();
        if (contextFields == null || contextFields.isEmpty()) {
            throw new IllegalArgumentException("CONTEXT_BASED strategy requires contextFields to be configured");
        }

        StringBuilder keyBuilder = new StringBuilder();

        if (settings.getIncludeTriggerId() != null && settings.getIncludeTriggerId()) {
            keyBuilder.append("trigger_").append(trigger.getId()).append("_");
        }

        // Add each context field and its value
        for (String fieldName : contextFields) {
            Object fieldValue = context != null ? context.get(fieldName) : null;

            if (fieldValue == null) {
                if (settings.getFailOnMissingContext() != null && settings.getFailOnMissingContext()) {
                    throw new IllegalArgumentException(
                            String.format("Required context field '%s' is missing in context", fieldName));
                }
                fieldValue = "null";
            }

            keyBuilder.append(fieldName).append("_").append(fieldValue).append("_");
        }

        // Remove trailing underscore
        if (keyBuilder.length() > 0 && keyBuilder.charAt(keyBuilder.length() - 1) == '_') {
            keyBuilder.setLength(keyBuilder.length() - 1);
        }

        String key = keyBuilder.toString();
        log.debug("Generated CONTEXT_BASED strategy key: {} (fields: {})", key, contextFields);
        return key;
    }

    @Override
    public boolean supports(IdempotencySettings settings) {
        return settings != null && IdempotencyStrategy.CONTEXT_BASED.equals(settings.getStrategy());
    }
}

package vacademy.io.admin_core_service.features.workflow.service.idempotency.generators;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.workflow.dto.IdempotencySettings;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowTrigger;
import vacademy.io.admin_core_service.features.workflow.enums.IdempotencyStrategy;
import vacademy.io.admin_core_service.features.workflow.service.idempotency.IdempotencyKeyGenerator;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Combines context fields with time window for idempotency.
 * Prevents duplicate executions for same context within time window.
 * 
 * Key format: trigger_{triggerId}_{field1Name}_{field1Value}_{roundedTimestamp}
 * Example: trigger_abc123_userId_user456_1735707000000
 * 
 * Use case: "Max one execution per user per 15 minutes"
 */
@Slf4j
@Component
public class ContextTimeWindowKeyGenerator implements IdempotencyKeyGenerator {

    @Override
    public String generateKey(WorkflowTrigger trigger, String eventName, String eventId,
            Map<String, Object> context, IdempotencySettings settings) {

        List<String> contextFields = settings.getContextFields();
        if (contextFields == null || contextFields.isEmpty()) {
            throw new IllegalArgumentException("CONTEXT_TIME_WINDOW strategy requires contextFields to be configured");
        }

        if (settings.getTtlMinutes() == null || settings.getTtlMinutes() <= 0) {
            throw new IllegalArgumentException("CONTEXT_TIME_WINDOW strategy requires ttlMinutes to be configured");
        }

        long currentTimeMillis = Instant.now().toEpochMilli();
        long windowMillis = (long) (settings.getTtlMinutes() * 60 * 1000);
        long roundedTimestamp = (currentTimeMillis / windowMillis) * windowMillis;

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

        // Add rounded timestamp
        keyBuilder.append(roundedTimestamp);

        String key = keyBuilder.toString();
        log.debug("Generated CONTEXT_TIME_WINDOW strategy key: {} (fields: {}, window: {} minutes)",
                key, contextFields, settings.getTtlMinutes());
        return key;
    }

    @Override
    public boolean supports(IdempotencySettings settings) {
        return settings != null && IdempotencyStrategy.CONTEXT_TIME_WINDOW.equals(settings.getStrategy());
    }
}

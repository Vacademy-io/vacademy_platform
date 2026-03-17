package vacademy.io.admin_core_service.features.workflow.service.idempotency.generators;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.workflow.dto.IdempotencySettings;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowTrigger;
import vacademy.io.admin_core_service.features.workflow.enums.IdempotencyStrategy;
import vacademy.io.admin_core_service.features.workflow.service.idempotency.IdempotencyKeyGenerator;

import java.util.Map;

/**
 * Generates idempotency keys based on event type and/or event ID.
 * Prevents duplicate executions for the same event.
 * 
 * Key format: trigger_{triggerId}_{eventType}_{eventId}
 * Example: trigger_abc123_LEARNER_BATCH_ENROLLMENT_evt456
 */
@Slf4j
@Component
public class EventBasedKeyGenerator implements IdempotencyKeyGenerator {

    @Override
    public String generateKey(WorkflowTrigger trigger, String eventName, String eventId,
            Map<String, Object> context, IdempotencySettings settings) {

        StringBuilder keyBuilder = new StringBuilder();

        if (settings.getIncludeTriggerId() != null && settings.getIncludeTriggerId()) {
            keyBuilder.append("trigger_").append(trigger.getId()).append("_");
        }

        if (settings.getIncludeEventType() != null && settings.getIncludeEventType()) {
            keyBuilder.append("eventType_").append(eventName != null ? eventName : "null").append("_");
        }

        if (settings.getIncludeEventId() != null && settings.getIncludeEventId()) {
            keyBuilder.append("eventId_").append(eventId != null ? eventId : "null").append("_");
        }

        // Remove trailing underscore
        if (keyBuilder.length() > 0 && keyBuilder.charAt(keyBuilder.length() - 1) == '_') {
            keyBuilder.setLength(keyBuilder.length() - 1);
        }

        // Ensure we have at least something in the key
        if (keyBuilder.length() == 0) {
            throw new IllegalArgumentException(
                    "EVENT_BASED strategy requires at least one of includeEventType or includeEventId to be true");
        }

        String key = keyBuilder.toString();
        log.debug("Generated EVENT_BASED strategy key: {}", key);
        return key;
    }

    @Override
    public boolean supports(IdempotencySettings settings) {
        return settings != null && IdempotencyStrategy.EVENT_BASED.equals(settings.getStrategy());
    }
}

package vacademy.io.admin_core_service.features.workflow.service.idempotency.generators;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.workflow.dto.IdempotencySettings;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowTrigger;
import vacademy.io.admin_core_service.features.workflow.enums.IdempotencyStrategy;
import vacademy.io.admin_core_service.features.workflow.service.idempotency.IdempotencyKeyGenerator;

import java.time.Instant;
import java.util.Map;

/**
 * Generates time-based idempotency keys with configurable window.
 * Prevents duplicate executions within the specified time window (e.g., 15
 * minutes).
 * 
 * Key format: trigger_{triggerId}_{roundedTimestamp}
 */
@Slf4j
@Component
public class TimeWindowKeyGenerator implements IdempotencyKeyGenerator {

    @Override
    public String generateKey(WorkflowTrigger trigger, String eventName, String eventId,
            Map<String, Object> context, IdempotencySettings settings) {

        if (settings.getTtlMinutes() == null || settings.getTtlMinutes() <= 0) {
            throw new IllegalArgumentException("TIME_WINDOW strategy requires ttlMinutes to be configured");
        }

        long currentTimeMillis = Instant.now().toEpochMilli();
        long windowMillis = (long) (settings.getTtlMinutes() * 60 * 1000);

        // Round down to the nearest time window
        long roundedTimestamp = (currentTimeMillis / windowMillis) * windowMillis;

        StringBuilder keyBuilder = new StringBuilder();

        if (settings.getIncludeTriggerId() != null && settings.getIncludeTriggerId()) {
            keyBuilder.append("trigger_").append(trigger.getId()).append("_");
        }

        keyBuilder.append(roundedTimestamp);

        String key = keyBuilder.toString();
        log.debug("Generated TIME_WINDOW strategy key: {} (window: {} minutes)", key, settings.getTtlMinutes());
        return key;
    }

    @Override
    public boolean supports(IdempotencySettings settings) {
        return settings != null && IdempotencyStrategy.TIME_WINDOW.equals(settings.getStrategy());
    }
}

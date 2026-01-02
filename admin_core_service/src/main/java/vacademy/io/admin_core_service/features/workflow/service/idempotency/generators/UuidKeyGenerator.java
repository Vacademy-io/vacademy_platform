package vacademy.io.admin_core_service.features.workflow.service.idempotency.generators;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.workflow.dto.IdempotencySettings;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowTrigger;
import vacademy.io.admin_core_service.features.workflow.enums.IdempotencyStrategy;
import vacademy.io.admin_core_service.features.workflow.service.idempotency.IdempotencyKeyGenerator;

import java.util.Map;
import java.util.UUID;

/**
 * Generates unique UUID for each execution.
 * Similar to NONE but creates execution tracking record.
 */
@Slf4j
@Component
public class UuidKeyGenerator implements IdempotencyKeyGenerator {

    @Override
    public String generateKey(WorkflowTrigger trigger, String eventName, String eventId,
            Map<String, Object> context, IdempotencySettings settings) {
        String key = UUID.randomUUID().toString();
        log.debug("Generated UUID strategy key: {}", key);
        return key;
    }

    @Override
    public boolean supports(IdempotencySettings settings) {
        return settings != null && IdempotencyStrategy.UUID.equals(settings.getStrategy());
    }
}

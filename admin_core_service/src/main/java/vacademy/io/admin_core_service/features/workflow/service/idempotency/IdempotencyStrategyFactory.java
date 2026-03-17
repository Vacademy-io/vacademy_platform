package vacademy.io.admin_core_service.features.workflow.service.idempotency;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.workflow.dto.IdempotencySettings;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowTrigger;
import vacademy.io.admin_core_service.features.workflow.enums.IdempotencyStrategy;

import java.util.List;
import java.util.Map;

/**
 * Factory service for creating appropriate idempotency key generators.
 * Selects the correct generator based on the configured strategy.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class IdempotencyStrategyFactory {

    private final List<IdempotencyKeyGenerator> generators;
    private final ObjectMapper objectMapper;

    /**
     * Parse idempotency settings from workflow trigger.
     *
     * @param trigger The workflow trigger
     * @return Parsed settings or default UUID strategy if not configured
     */
    public IdempotencySettings parseSettings(WorkflowTrigger trigger) {
        String settingsJson = trigger.getIdempotencyGenerationSetting();

        if (settingsJson == null || settingsJson.isBlank()) {
            log.debug("No idempotency settings configured for trigger {}, using default UUID strategy",
                    trigger.getId());
            return IdempotencySettings.builder()
                    .strategy(IdempotencyStrategy.UUID)
                    .build();
        }

        try {
            IdempotencySettings settings = objectMapper.readValue(settingsJson, IdempotencySettings.class);
            log.debug("Parsed idempotency settings for trigger {}: strategy={}",
                    trigger.getId(), settings.getStrategy());
            return settings;
        } catch (Exception e) {
            log.error("Failed to parse idempotency settings for trigger {}: {}",
                    trigger.getId(), settingsJson, e);
            // Fall back to UUID strategy
            return IdempotencySettings.builder()
                    .strategy(IdempotencyStrategy.UUID)
                    .build();
        }
    }

    /**
     * Generate idempotency key using the appropriate generator.
     *
     * @param trigger   The workflow trigger
     * @param eventName The event name
     * @param eventId   The event ID
     * @param context   The context data
     * @return Generated idempotency key
     */
    public String generateKey(WorkflowTrigger trigger, String eventName, String eventId,
            Map<String, Object> context) {

        IdempotencySettings settings = parseSettings(trigger);

        // Find the appropriate generator
        IdempotencyKeyGenerator generator = generators.stream()
                .filter(g -> g.supports(settings))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException(
                        "No generator found for strategy: " + settings.getStrategy()));

        log.debug("Using generator {} for strategy {}",
                generator.getClass().getSimpleName(), settings.getStrategy());

        return generator.generateKey(trigger, eventName, eventId, context, settings);
    }

    /**
     * Validate idempotency settings configuration.
     *
     * @param settings The settings to validate
     * @throws IllegalArgumentException if settings are invalid
     */
    public void validateSettings(IdempotencySettings settings) {
        if (settings == null || settings.getStrategy() == null) {
            throw new IllegalArgumentException("Idempotency strategy must be specified");
        }

        switch (settings.getStrategy()) {
            case TIME_WINDOW:
                if (settings.getTtlMinutes() == null || settings.getTtlMinutes() <= 0) {
                    throw new IllegalArgumentException("TIME_WINDOW strategy requires ttlMinutes > 0");
                }
                break;

            case CONTEXT_BASED:
                if (settings.getContextFields() == null || settings.getContextFields().isEmpty()) {
                    throw new IllegalArgumentException("CONTEXT_BASED strategy requires contextFields");
                }
                break;

            case CONTEXT_TIME_WINDOW:
                if (settings.getTtlMinutes() == null || settings.getTtlMinutes() <= 0) {
                    throw new IllegalArgumentException("CONTEXT_TIME_WINDOW strategy requires ttlMinutes > 0");
                }
                if (settings.getContextFields() == null || settings.getContextFields().isEmpty()) {
                    throw new IllegalArgumentException("CONTEXT_TIME_WINDOW strategy requires contextFields");
                }
                break;

            case EVENT_BASED:
                if ((settings.getIncludeEventType() == null || !settings.getIncludeEventType())
                        && (settings.getIncludeEventId() == null || !settings.getIncludeEventId())) {
                    throw new IllegalArgumentException(
                            "EVENT_BASED strategy requires at least one of includeEventType or includeEventId");
                }
                break;

            case CUSTOM_EXPRESSION:
                if (settings.getCustomExpression() == null || settings.getCustomExpression().isBlank()) {
                    throw new IllegalArgumentException("CUSTOM_EXPRESSION strategy requires customExpression");
                }
                break;

            case NONE:
            case UUID:
                // No additional validation needed
                break;

            default:
                throw new IllegalArgumentException("Unknown strategy: " + settings.getStrategy());
        }
    }
}

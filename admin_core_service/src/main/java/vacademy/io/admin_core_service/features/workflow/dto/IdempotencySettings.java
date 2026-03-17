package vacademy.io.admin_core_service.features.workflow.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.workflow.enums.IdempotencyStrategy;

import java.util.List;

/**
 * Configuration for idempotency key generation in trigger-based workflows.
 * Defines how unique keys are generated to prevent duplicate executions.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class IdempotencySettings {

    /**
     * The idempotency strategy to use.
     * Required field. Defaults to UUID if not specified.
     */
    @JsonProperty("strategy")
    @Builder.Default
    private IdempotencyStrategy strategy = IdempotencyStrategy.UUID;

    /**
     * Time window in minutes for time-based strategies.
     * Used by TIME_WINDOW and CONTEXT_TIME_WINDOW strategies.
     * Supports decimal values (e.g., 0.5 for 30 seconds, 1.5 for 90 seconds).
     * Example: 15 means "max one execution per 15-minute window"
     */
    @JsonProperty("ttlMinutes")
    private Double ttlMinutes;

    /**
     * Context field names to include in key generation.
     * Used by CONTEXT_BASED and CONTEXT_TIME_WINDOW strategies.
     * Example: ["userId", "packageId"] creates key with those field values
     */
    @JsonProperty("contextFields")
    private List<String> contextFields;

    /**
     * Whether to include trigger ID in the key.
     * Default: true (recommended to scope keys per trigger)
     */
    @JsonProperty("includeTriggerId")
    @Builder.Default
    private Boolean includeTriggerId = true;

    /**
     * Whether to include event type in the key.
     * Used by EVENT_BASED strategy.
     * Default: false
     */
    @JsonProperty("includeEventType")
    @Builder.Default
    private Boolean includeEventType = false;

    /**
     * Whether to include event ID in the key.
     * Used by EVENT_BASED strategy.
     * Default: false
     */
    @JsonProperty("includeEventId")
    @Builder.Default
    private Boolean includeEventId = false;

    /**
     * SpEL expression for custom key generation.
     * Used by CUSTOM_EXPRESSION strategy.
     * Available variables: triggerId, eventName, eventId, ctx (context map)
     * Example: "#{triggerId}_#{ctx['userId']}_#{ctx['roleId']}"
     */
    @JsonProperty("customExpression")
    private String customExpression;

    /**
     * Whether to fail workflow if required context fields are missing.
     * If false, missing fields use "null" as value in key.
     * Default: false (lenient mode)
     */
    @JsonProperty("failOnMissingContext")
    @Builder.Default
    private Boolean failOnMissingContext = false;
}

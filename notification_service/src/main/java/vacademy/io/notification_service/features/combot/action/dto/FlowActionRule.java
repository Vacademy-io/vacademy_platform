package vacademy.io.notification_service.features.combot.action.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;

/**
 * A single rule that maps a trigger to a list of actions.
 */
@Data
public class FlowActionRule {

    /**
     * Trigger text to match against user input.
     * For regex match_type, this is a regex pattern.
     */
    @JsonProperty("trigger")
    private String trigger;

    /**
     * How to match the trigger:
     * - "exact": User input must exactly match (case-insensitive)
     * - "contains": User input must contain the trigger (case-insensitive)
     * - "regex": User input must match the regex pattern
     * 
     * Default: "contains"
     */
    @JsonProperty("match_type")
    private String matchType = "contains";

    /**
     * List of actions to execute when trigger matches
     */
    @JsonProperty("actions")
    private List<FlowAction> actions;
}

package vacademy.io.notification_service.features.combot.action.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;

/**
 * Root configuration object for action_template_config column.
 */
@Data
public class FlowActionConfig {

    /**
     * List of rules to evaluate
     */
    @JsonProperty("rules")
    private List<FlowActionRule> rules;
}

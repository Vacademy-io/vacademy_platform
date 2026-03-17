package vacademy.io.notification_service.features.combot.action.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import lombok.Data;

/**
 * Base class for flow actions.
 * Supports polymorphic deserialization based on "type" field.
 */
@Data
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.PROPERTY, property = "type")
@JsonSubTypes({
        @JsonSubTypes.Type(value = WorkflowAction.class, name = "WORKFLOW"),
        @JsonSubTypes.Type(value = VerificationAction.class, name = "VERIFICATION"),
        @JsonSubTypes.Type(value = TemplateAction.class, name = "TEMPLATE")
})
public abstract class FlowAction {

    /**
     * Action type: WORKFLOW, VERIFICATION, TEMPLATE
     */
    @JsonProperty("type")
    private String type;
}

package vacademy.io.notification_service.features.combot.action.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.util.List;

/**
 * Template action - sends a WhatsApp template message.
 * For backward compatibility, this allows specifying templates in the new
 * action format.
 */
@Data
@EqualsAndHashCode(callSuper = true)
public class TemplateAction extends FlowAction {

    /**
     * Template name to send
     */
    @JsonProperty("templateName")
    private String templateName;

    /**
     * Optional template body parameters.
     * Supports {{placeholder}} syntax for dynamic values from context.
     */
    @JsonProperty("params")
    private List<String> params;
}

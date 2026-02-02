package vacademy.io.admin_core_service.features.enrollment_policy.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Value;
import lombok.experimental.SuperBuilder;
import lombok.extern.jackson.Jacksonized;

/**
 * DTO for frontend action configuration.
 * Used for user-facing interactive elements like WhatsApp buttons, links, etc.
 * These are typically displayed in the frontend during workflow execution.
 */
@Value
@Jacksonized
@SuperBuilder
@JsonIgnoreProperties(ignoreUnknown = true)
public class FrontendActionDTO {
    /**
     * Type of the action.
     * Example: "whatsapp", "button", "link"
     */
    String type;

    /**
     * Description text explaining what this action does.
     * Example: "Open your WhatsApp and verify it"
     */
    String description;

    /**
     * Button text to display in the UI.
     * Example: "Verify on WhatsApp"
     */
    String buttonText;

    /**
     * URL for the action (WhatsApp link, redirect URL, etc.)
     * Example: "https://wa.me/447466551586?text=VERIFY"
     */
    String actionUrl;
}

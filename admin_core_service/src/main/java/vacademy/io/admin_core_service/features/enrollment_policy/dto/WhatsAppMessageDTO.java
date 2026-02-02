package vacademy.io.admin_core_service.features.enrollment_policy.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Value;
import lombok.experimental.SuperBuilder;
import lombok.extern.jackson.Jacksonized;

/**
 * DTO for WhatsApp message configuration.
 * Used for actions like verification, upgrade inquiries, support, etc.
 */
@Value
@Jacksonized
@SuperBuilder
@JsonIgnoreProperties(ignoreUnknown = true)
public class WhatsAppMessageDTO {
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
     * Pre-generated WhatsApp URL with phone number and pre-filled message.
     * Example: "https://wa.me/447466551586?text=VERIFY"
     */
    String generatedUrl;
}

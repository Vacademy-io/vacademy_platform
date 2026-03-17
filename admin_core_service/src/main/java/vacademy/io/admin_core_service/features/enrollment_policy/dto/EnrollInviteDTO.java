package vacademy.io.admin_core_service.features.enrollment_policy.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Value;
import lombok.experimental.SuperBuilder;
import lombok.extern.jackson.Jacksonized;

/**
 * DTO for enrollment invite configuration.
 * Used for enrollment links with customizable button text and type.
 */
@Value
@Jacksonized
@SuperBuilder
@JsonIgnoreProperties(ignoreUnknown = true)
public class EnrollInviteDTO {
    /**
     * Type of the invite element.
     * Example: "button", "link", "card"
     */
    String type;

    /**
     * Display text for the invite.
     * Example: "Enroll Now", "Upgrade to Premium"
     */
    String text;

    /**
     * URL for the enrollment action.
     * Example: "https://your-domain.com/enroll/paid-package?session_id=xyz"
     */
    String url;
}

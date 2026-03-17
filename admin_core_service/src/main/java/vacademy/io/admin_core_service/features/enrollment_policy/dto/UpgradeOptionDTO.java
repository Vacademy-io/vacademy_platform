package vacademy.io.admin_core_service.features.enrollment_policy.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Value;
import lombok.experimental.SuperBuilder;
import lombok.extern.jackson.Jacksonized;

/**
 * DTO for upgrade option configuration.
 * Used for enrollment/upgrade links displayed after demo expiry or in
 * reenrollment scenarios.
 */
@Value
@Jacksonized
@SuperBuilder
@JsonIgnoreProperties(ignoreUnknown = true)
public class UpgradeOptionDTO {
    /**
     * Type of the UI element.
     * Example: "button", "link", "card"
     */
    String type;

    /**
     * Display text for the upgrade option.
     * Example: "Upgrade Now", "Go Premium"
     */
    String text;

    /**
     * URL for the upgrade/enrollment action.
     * Example: "https://your-domain.com/enroll/paid-package?session_id=xyz"
     */
    String url;
}

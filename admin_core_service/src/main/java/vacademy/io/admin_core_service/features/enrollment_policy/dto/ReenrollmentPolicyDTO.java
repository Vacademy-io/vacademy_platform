package vacademy.io.admin_core_service.features.enrollment_policy.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Value;
import lombok.experimental.SuperBuilder;
import lombok.extern.jackson.Jacksonized;
import vacademy.io.admin_core_service.features.enrollment_policy.enums.ActiveRepurchaseBehavior;

import java.util.Map;

@Value
@Jacksonized
@SuperBuilder
@JsonIgnoreProperties(ignoreUnknown = true)
public class ReenrollmentPolicyDTO {
    ActiveRepurchaseBehavior activeRepurchaseBehavior;
    Boolean allowReenrollmentAfterExpiry;
    Integer reenrollmentGapInDays;

    /**
     * Custom message shown when user is already actively enrolled in this package.
     * If not provided, a default message will be used.
     * Example: "You are already enrolled in this demo. Please complete your current
     * trial first."
     */
    String alreadyEnrolledMessage;

    /**
     * Custom message shown when re-enrollment is blocked due to gap period.
     * Supports placeholder {{allowed_date}} for the date when re-enrollment will be
     * allowed.
     * If not provided, a default message will be used.
     * Example: "Demo re-enrollment is not allowed. Please try again after
     * {{allowed_date}}."
     */
    String reenrollmentBlockedMessage;

    /**
     * Map of upgrade options for frontend display.
     * Key: identifier (e.g., "paid_upgrade", "premium_upgrade")
     * Value: UpgradeOptionDTO with type, text, and url
     */
    Map<String, UpgradeOptionDTO> upgradeOptions;
}

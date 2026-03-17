package vacademy.io.admin_core_service.features.enrollment_policy.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Value;
import lombok.experimental.SuperBuilder;
import lombok.extern.jackson.Jacksonized;

import java.util.List;

@Value
@Jacksonized
@SuperBuilder
@JsonIgnoreProperties(ignoreUnknown = true)
public class EnrollmentPolicySettingsDTO {
    OnExpiryPolicyDTO onExpiry;
    List<NotificationPolicyDTO> notifications;

    /**
     * Reenrollment policy with upgrade options.
     * upgradeOptions inside contains enrollment invite links for frontend display.
     */
    ReenrollmentPolicyDTO reenrollmentPolicy;

    OnEnrollmentPolicyDTO onEnrollment;

    /**
     * Workflow configuration with frontend actions.
     * frontendActions inside contains WhatsApp buttons and other interactive
     * elements.
     */
    WorkflowConfigDTO workflow;
}

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
    ReenrollmentPolicyDTO reenrollmentPolicy;
    OnEnrollmentPolicyDTO onEnrollment;
}

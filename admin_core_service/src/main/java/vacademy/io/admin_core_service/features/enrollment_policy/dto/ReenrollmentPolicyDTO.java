package vacademy.io.admin_core_service.features.enrollment_policy.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Value;
import lombok.experimental.SuperBuilder;
import lombok.extern.jackson.Jacksonized;
import vacademy.io.admin_core_service.features.enrollment_policy.enums.ActiveRepurchaseBehavior;

@Value
@Jacksonized
@SuperBuilder
@JsonIgnoreProperties(ignoreUnknown = true)
public class ReenrollmentPolicyDTO {
    ActiveRepurchaseBehavior activeRepurchaseBehavior;
    Boolean allowReenrollmentAfterExpiry;
    Integer reenrollmentGapInDays;
}

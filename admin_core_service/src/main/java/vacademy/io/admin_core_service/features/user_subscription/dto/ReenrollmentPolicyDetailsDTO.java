package vacademy.io.admin_core_service.features.user_subscription.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

/**
 * Details about re-enrollment policy for a package session.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ReenrollmentPolicyDetailsDTO {

    /**
     * Whether user can re-enroll after expiry
     */
    private Boolean allowReenrollmentAfterExpiry;

    /**
     * Required gap in days before re-enrollment
     */
    private Integer reenrollmentGapInDays;

    /**
     * Next date when user can enroll again (calculated based on gap)
     * Null if no gap or re-enrollment not allowed
     */
    private LocalDate nextEligibleEnrollmentDate;
}

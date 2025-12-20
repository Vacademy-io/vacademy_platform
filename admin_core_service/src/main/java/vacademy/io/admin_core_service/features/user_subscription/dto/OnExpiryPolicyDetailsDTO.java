package vacademy.io.admin_core_service.features.user_subscription.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

/**
 * Details about what happens on expiry for a package session.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class OnExpiryPolicyDetailsDTO {

    /**
     * Waiting period in days before final expiry
     */
    private Integer waitingPeriodInDays;

    /**
     * Whether automatic payment renewal is enabled
     */
    private Boolean enableAutoRenewal;

    /**
     * Next payment attempt date (on expiry date if auto-renewal enabled)
     * Null if auto-renewal disabled or payment not applicable
     */
    private LocalDate nextPaymentAttemptDate;

    /**
     * Final expiry date (after waiting period)
     * Null if no waiting period
     */
    private LocalDate finalExpiryDate;
}

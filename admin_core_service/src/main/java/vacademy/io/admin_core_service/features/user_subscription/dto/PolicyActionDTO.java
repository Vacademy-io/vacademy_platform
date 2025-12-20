package vacademy.io.admin_core_service.features.user_subscription.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.Map;

/**
 * Represents a single future action that will be taken based on enrollment
 * policy.
 * Examples: payment attempt, notification, final expiry, etc.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class PolicyActionDTO {

    /**
     * Type of action: PAYMENT_ATTEMPT, NOTIFICATION, EXPIRY, FINAL_EXPIRY
     */
    private String actionType;

    /**
     * When this action will occur (date only, no time)
     */
    private LocalDate scheduledDate;

    /**
     * Human-readable description of what will happen
     */
    private String description;

    /**
     * Additional details specific to this action type
     * For notifications: {channels: ["EMAIL", "WHATSAPP"], templateName: "..."}
     * For payments: {paymentAmount: 199.0, currency: "USD"}
     */
    private Map<String, Object> details;

    /**
     * Days before expiry (negative for past expiry)
     * Null if not applicable
     */
    private Integer daysPastOrBeforeExpiry;
}

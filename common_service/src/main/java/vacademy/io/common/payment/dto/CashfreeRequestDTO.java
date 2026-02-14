package vacademy.io.common.payment.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Gateway-specific request data for Cashfree payments.
 * This mirrors the pattern used for Stripe/PhonePe DTOs and can be
 * extended as needed based on frontend and Cashfree requirements.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.LowerCamelCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
@com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
public class CashfreeRequestDTO {

    /**
     * URL where the user should be redirected after payment
     * (Cashfree hosted checkout return URL).
     */
    private String returnUrl;

    /**
     * Optional custom notify URL override.
     * If not provided, backend will use the default Cashfree webhook URL
     * based on the institute context.
     */
    private String notifyUrl;
}


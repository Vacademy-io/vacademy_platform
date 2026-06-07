package vacademy.io.admin_core_service.features.credits.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CreditPackPurchaseRequestDTO {
    private String instituteId;
    private String packId;
    /**
     * Where Razorpay should send the browser back after the hosted payment
     * completes — the originating admin domain (e.g.
     * {@code https://admin.shikshanation.com/settings?selectedTab=aiSettings}).
     * The service appends {@code topup_pp=<platformPaymentId>} so the page can
     * resume polling. Optional; falls back to a configured default.
     */
    private String returnUrl;
}

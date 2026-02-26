package vacademy.io.admin_core_service.features.admission.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.common.payment.dto.ManualPaymentDTO;

import java.math.BigDecimal;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class SchoolPaymentDTO {
    /**
     * "OFFLINE" or "ONLINE" (online = future implementation)
     */
    private String paymentMode;

    /**
     * The amount the parent actually paid right now
     */
    private BigDecimal amount;

    /**
     * Present ONLY for offline payments.
     * Contains fileId (receipt), transactionId, etc.
     */
    private ManualPaymentDTO manualPayment;
}

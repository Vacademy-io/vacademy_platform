package vacademy.io.admin_core_service.features.user_subscription.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.invoice.dto.PaymentLogInvoiceDTO;
import vacademy.io.common.auth.dto.UserDTO;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class PaymentLogWithUserPlanDTO {
    private PaymentLogDTO paymentLog;
    private UserPlanDTO userPlan;
    /**
     * PAID, FAILED, PAYMENT_PENDING, NOT_INITIATED — or CANCELLED for a row that stands for a
     * voided invoice, which must be visible but never counted toward collected/due.
     */
    private String currentPaymentStatus;
    private UserDTO user;
    /**
     * Set only on rows that ARE an invoice rather than a payment (an invoice raised but never paid
     * against). Rows backed by a real payment leave this null and have their invoice resolved by
     * the separate bulk lookup, which the optional Invoice column drives.
     */
    private PaymentLogInvoiceDTO invoice;
}

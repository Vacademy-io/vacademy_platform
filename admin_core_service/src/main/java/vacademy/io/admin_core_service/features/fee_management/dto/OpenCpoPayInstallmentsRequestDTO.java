package vacademy.io.admin_core_service.features.fee_management.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;

import java.util.List;

/**
 * Request body for the open (unauthenticated) CPO installment payment endpoint.
 * {@code POST /admin-core-service/open/v1/fee/cpo-pay-installments}
 *
 * <p>Because this endpoint has no JWT, the caller must supply {@code userId} and
 * {@code userPlanId}. The service validates that every {@code studentFeePaymentId}
 * belongs to the given userId/userPlanId combination before routing to the payment
 * gateway.</p>
 */
@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class OpenCpoPayInstallmentsRequestDTO {
    private String userId;
    private String userPlanId;
    private String instituteId;
    /** Learner's full name — required by Razorpay/Stripe customer creation. */
    private String name;
    private List<String> studentFeePaymentIds;
    /**
     * Optional: if set, overrides the computed outstanding amount.
     * Used for custom/partial payments where the learner wants to pay
     * a specific amount rather than the full outstanding balance.
     */
    private Double customAmount;
    private PaymentInitiationRequestDTO paymentInitiationRequest;
}

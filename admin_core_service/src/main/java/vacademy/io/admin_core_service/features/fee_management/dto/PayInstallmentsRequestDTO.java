package vacademy.io.admin_core_service.features.fee_management.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;

import java.util.List;

/**
 * Request body for {@code POST /admin-core-service/learner/v1/fee/pay-installments}.
 *
 * The learner picks one or more StudentFeePayment ids from their pending dues
 * (via {@code GET /learner/v1/fee/my-dues}) and submits them here to pay online.
 * The endpoint validates ownership, sums outstanding amounts, and routes the
 * total through {@code PaymentService.handlePayment} with
 * {@code paymentType=SCHOOL} so the existing webhook → FIFO allocation flow
 * marks the SFP rows PAID and generates the invoice.
 */
@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class PayInstallmentsRequestDTO {
    private String instituteId;
    private List<String> studentFeePaymentIds;
    private PaymentInitiationRequestDTO paymentInitiationRequest;
}

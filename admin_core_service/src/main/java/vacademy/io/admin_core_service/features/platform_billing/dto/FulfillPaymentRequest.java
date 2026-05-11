package vacademy.io.admin_core_service.features.platform_billing.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

/**
 * Body for the manual fulfillment endpoint
 * ({@code POST /super-admin/v1/platform-billing/fulfill-payment/{platformPaymentId}}).
 *
 * Use case: Razorpay captured the payment but the webhook never reached us
 * (misconfigured URL, network blip, our service was down) so the order is
 * stuck at INITIATED. Ops looks up the {@code pay_*} id in the Razorpay
 * dashboard and feeds it here; we run the same fulfillment chain the webhook
 * would have run.
 *
 * {@code vendorPaymentId} is optional only if the platform_payment row
 * already has it populated (e.g. a previous webhook attempt set it but
 * subsequent steps failed). In the common stuck-payment case it's required.
 */
@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class FulfillPaymentRequest {
    /** Razorpay payment id (e.g. {@code pay_SnESFjlv8ySb2y}). */
    private String vendorPaymentId;
}

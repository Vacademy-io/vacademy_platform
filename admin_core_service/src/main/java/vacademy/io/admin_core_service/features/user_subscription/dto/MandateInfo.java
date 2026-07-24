package vacademy.io.admin_core_service.features.user_subscription.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * A single recurring-payment mandate, stored (keyed by userPlanId) inside
 * user_institute_payment_gateway_mapping.payment_gateway_customer_data JSON —
 * NOT a table. Provider-agnostic: {@code providerRef} is the token that gets
 * charged off-session (Razorpay token_id, eWay TokenCustomerID, Stripe
 * payment_method id, …). {@code maxAmount} is enforced app-side before every
 * recurring charge (some providers have no native limit).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MandateInfo {

    /** Mandate lifecycle: PENDING | ACTIVE | PAUSED | REVOKED | FAILED. */
    public static final String STATUS_PENDING = "PENDING";
    public static final String STATUS_ACTIVE = "ACTIVE";
    public static final String STATUS_REVOKED = "REVOKED";
    public static final String STATUS_FAILED = "FAILED";

    private String vendor;            // RAZORPAY | EWAY | STRIPE | ...
    private String customerId;        // provider customer id (cus_…, TokenCustomerID, …)
    private String providerRef;       // the chargeable token / mandate reference
    private Double maxAmount;         // app-enforced cap (derived from plan amount)
    private String currency;
    private String frequency;         // as_presented | monthly | ...
    private String status;
    private String updatedAt;         // ISO-8601
}

package vacademy.io.admin_core_service.features.migration.dto.v2;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Payment gateway configuration for import (for auto-deduction)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentGatewayImportDTO {

    /**
     * Payment gateway vendor: EWAY, STRIPE, RAZORPAY, etc.
     */
    @JsonProperty("vendor")
    private String vendor;

    /**
     * Customer ID/Token from the payment gateway
     * For eWay: the customer token for recurring payments
     */
    @JsonProperty("customer_id")
    private String customerId;

    /**
     * Institute Payment Gateway Mapping ID
     * If not provided, will try to find default for institute + vendor
     */
    @JsonProperty("institute_payment_gateway_mapping_id")
    private String institutePaymentGatewayMappingId;

    /**
     * Country code (may be required by some gateways)
     */
    @JsonProperty("country_code")
    private String countryCode;
}

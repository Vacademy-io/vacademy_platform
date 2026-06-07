package vacademy.io.admin_core_service.features.institute.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * Request body for creating or updating an institute payment gateway mapping.
 * On UPDATE, any field in {@code paymentGatewaySpecificData} whose value equals
 * the masked placeholder is preserved as-is (the admin didn't re-enter the secret).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PaymentGatewayMappingUpsertRequest {

    /** Required on CREATE, ignored on UPDATE (vendor is immutable per row). */
    private String vendor;

    /** Optional status override. Defaults to ACTIVE on create. */
    private String status;

    /** Vendor-specific credentials. Keys depend on vendor (see service for schema). */
    @JsonProperty("payment_gateway_specific_data")
    private Map<String, Object> paymentGatewaySpecificData;
}

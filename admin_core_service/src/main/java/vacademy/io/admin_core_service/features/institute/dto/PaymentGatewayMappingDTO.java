package vacademy.io.admin_core_service.features.institute.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * Response DTO for listing payment gateway mappings to the admin UI.
 * Secret values inside {@code paymentGatewaySpecificData} are masked
 * (e.g. {@code sk_live_••••1234}) so the full secret never leaves the server.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentGatewayMappingDTO {

    private String id;
    private String vendor;

    @JsonProperty("institute_id")
    private String instituteId;

    private String status;

    @JsonProperty("created_at")
    private String createdAt;

    @JsonProperty("updated_at")
    private String updatedAt;

    /** Masked credentials safe to render in the admin UI. */
    @JsonProperty("payment_gateway_specific_data")
    private Map<String, Object> paymentGatewaySpecificData;
}

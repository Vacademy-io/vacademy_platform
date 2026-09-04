package vacademy.io.admin_core_service.features.user_subscription.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@Builder
public class PaymentOptionDTO {
    private String id;
    private String name;
    private String status;
    private String source;
    private String sourceId;
    private String tag;
    private String type;
    private boolean requireApproval;
    private String unit;
    /**
     * Master switch for plan change — members on another option of the same package
     * session may switch INTO this option. Boxed so a partial edit payload that omits it
     * leaves the stored value alone instead of silently turning the feature off.
     */
    private Boolean planChangeAllowed;
    /** Set when type='CPO'. Points at the underlying ComplexPaymentOption row. */
    private String complexPaymentOptionId;
    private List<PaymentPlanDTO> paymentPlans;
    private String paymentOptionMetadataJson;
}

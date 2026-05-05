package vacademy.io.admin_core_service.features.user_subscription.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class PaymentOptionFilterDTO {
    private List<String>types;
    /**
     * Types to exclude from the result. When null/empty, the service layer applies a
     * default exclusion of ['CPO'] so that CPO-mirror PaymentOptions stay out of the
     * generic admin "Payment Options" listing. Pass an empty list ([]) to disable
     * the default exclusion entirely (useful when the caller explicitly wants to see
     * CPO mirrors mixed with regular options).
     */
    private List<String> excludeTypes;
    private String source;
    private String sourceId;
    private boolean requireApproval;
    private boolean notRequireApproval;
}

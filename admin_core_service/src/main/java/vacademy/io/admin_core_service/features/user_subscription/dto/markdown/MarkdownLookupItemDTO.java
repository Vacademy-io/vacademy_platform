package vacademy.io.admin_core_service.features.user_subscription.dto.markdown;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class MarkdownLookupItemDTO {
    private String packageSessionId;

    private String paymentOptionId;
    private String paymentOptionType;
    private String paymentOptionSource;

    private String paymentPlanId;
    private Double actualPrice;
    private Double elevatedPrice;
    private String currency;

    private boolean discountable;
    private String ineligibleReason;
    private List<String> sharedWithPackageSessionIds;
}

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
public class MarkdownResultDTO {
    private String packageSessionId;
    private boolean success;
    private String errorCode;
    private String errorMessage;

    private String paymentOptionId;
    private String paymentPlanId;

    private Double oldActualPrice;
    private Double newActualPrice;
    private Double elevatedPrice;
    private String currency;

    private List<String> conflictingPackageSessionIds;
}

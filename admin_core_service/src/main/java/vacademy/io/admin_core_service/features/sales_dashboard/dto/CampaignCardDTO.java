package vacademy.io.admin_core_service.features.sales_dashboard.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CampaignCardDTO {
    private String campaignId;
    private String campaignName;
    private String campaignType;
    private Long leadsInWindow;
    private Long conversionsInWindow;
    private BigDecimal conversionRate;
    private String topCounsellorUserId;
    private String topCounsellorName;
    private Long topCounsellorConversions;
}

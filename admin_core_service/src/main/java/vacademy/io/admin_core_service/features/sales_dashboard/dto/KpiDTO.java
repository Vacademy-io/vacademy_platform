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
public class KpiDTO {
    private Long totalLeads;
    private Long openLeads;
    private Long conversions;
    private BigDecimal conversionRate;       // percent 0..100
    private Long activeCounsellors;
    private Long overdueFollowups;
}

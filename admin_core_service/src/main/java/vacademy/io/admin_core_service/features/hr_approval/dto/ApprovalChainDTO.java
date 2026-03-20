package vacademy.io.admin_core_service.features.hr_approval.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ApprovalChainDTO {

    private String id;
    private String instituteId;
    private String entityType;
    private Integer approvalLevels;
    private List<Map<String, Object>> levelConfig;
    private Integer autoApproveAfterDays;
    private String status;
}

package vacademy.io.admin_core_service.features.audience.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Timestamp;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CenterHeatmapDTO {
    
    private String audienceId;
    private String campaignName;
    private String campaignType;
    private String description;
    private String campaignObjective;
    private String status;
    private Timestamp startDate;
    private Timestamp endDate;
    private Long uniqueUsers;
    private Long totalResponses;
    private Double avgResponsesPerUser;
}

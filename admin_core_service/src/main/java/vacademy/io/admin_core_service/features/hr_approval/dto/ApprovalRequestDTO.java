package vacademy.io.admin_core_service.features.hr_approval.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ApprovalRequestDTO {

    private String id;
    private String instituteId;
    private String entityType;
    private String entityId;
    private String requesterId;
    private String requesterName;
    private Integer currentLevel;
    private Integer totalLevels;
    private String status;
    private List<ApprovalActionDTO> actions;
}

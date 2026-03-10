package vacademy.io.admin_core_service.features.hr_approval.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ApprovalActionDTO {

    private String id;
    private Integer level;
    private String action;
    private String actorId;
    private String actorName;
    private String comments;
    private LocalDateTime actedAt;
}

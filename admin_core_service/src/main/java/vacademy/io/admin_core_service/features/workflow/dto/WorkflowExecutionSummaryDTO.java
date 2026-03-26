package vacademy.io.admin_core_service.features.workflow.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class WorkflowExecutionSummaryDTO {
    private long totalExecutions;
    private long completed;
    private long failed;
    private long processing;
    private long pending;
    private double avgExecutionTimeMs;
    private double successRate;
}

package vacademy.io.admin_core_service.features.workflow.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class WorkflowScheduleResponseDTO {

    private String id;

    private String workflowId;

    private String workflowName;

    private String scheduleType;

    private String cronExpression;

    private Integer intervalMinutes;

    private Integer dayOfMonth;

    private String timezone;

    private LocalDateTime startDate;

    private LocalDateTime endDate;

    private String status;

    private LocalDateTime lastRunAt;

    private LocalDateTime nextRunAt;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}

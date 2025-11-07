package vacademy.io.admin_core_service.features.workflow.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Date;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class WorkflowWithScheduleRowDTO {

    private String workflowId;

    private String workflowName;

    private String workflowDescription;

    private String workflowStatus;

    private String workflowType;

    private String createdByUserId;

    private String instituteId;

    private Date workflowCreatedAt;

    private Date workflowUpdatedAt;

    private String scheduleId;

    private String scheduleType;

    private String cronExpression;

    private Integer intervalMinutes;

    private Integer dayOfMonth;

    private String timezone;

    private LocalDateTime scheduleStartDate;

    private LocalDateTime scheduleEndDate;

    private String scheduleStatus;

    private LocalDateTime lastRunAt;

    private LocalDateTime nextRunAt;

    private LocalDateTime scheduleCreatedAt;

    private LocalDateTime scheduleUpdatedAt;
}

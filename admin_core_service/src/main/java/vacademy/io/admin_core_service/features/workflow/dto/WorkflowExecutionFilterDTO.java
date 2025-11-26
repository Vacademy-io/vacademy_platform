package vacademy.io.admin_core_service.features.workflow.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.admin_core_service.features.workflow.enums.WorkflowExecutionStatus;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class WorkflowExecutionFilterDTO {

    private String instituteId;

    private List<String> workflowIds;

    private List<WorkflowExecutionStatus> statuses;

    private Map<String, String> sortColumns;

    private Instant startDate;

    private Instant endDate;
}

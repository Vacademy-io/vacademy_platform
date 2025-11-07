package vacademy.io.admin_core_service.features.workflow.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class WorkflowWithSchedulesFilterDTO {

    private String instituteId;

    private List<String> workflowStatuses;

    private List<String> scheduleStatuses;

    private String searchName;
}

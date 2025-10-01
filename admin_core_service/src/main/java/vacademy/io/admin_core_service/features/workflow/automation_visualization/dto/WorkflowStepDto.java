package vacademy.io.admin_core_service.features.workflow.automation_visualization.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class WorkflowStepDto {
    private String title;
    private String description;
    private String type; // 'START', 'ACTION', 'LOGIC', 'EMAIL', 'END'
    private Map<String, Object> details;
    private List<Branch> branches; // This will now be null/empty

    @Data
    @Builder
    public static class Branch {
        private String condition;
        private List<WorkflowStepDto> steps;
    }
}
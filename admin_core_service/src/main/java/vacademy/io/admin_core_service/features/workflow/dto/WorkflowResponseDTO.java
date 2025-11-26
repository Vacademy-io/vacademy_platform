package vacademy.io.admin_core_service.features.workflow.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class WorkflowResponseDTO {

    private String id;
    private String name;
    private String description;
    private String status;
    private String workflowType;
    private String createdByUserId;
    private String instituteId;
    private Date createdAt;
    private Date updatedAt;

    private List<WorkflowScheduleResponseDTO> schedules;

    /**
     * Convert Workflow entity to WorkflowResponseDTO
     * 
     * @param workflow The workflow entity
     * @return WorkflowResponseDTO
     */
    public static WorkflowResponseDTO fromEntity(
            vacademy.io.admin_core_service.features.workflow.entity.Workflow workflow) {
        return WorkflowResponseDTO.builder()
                .id(workflow.getId())
                .name(workflow.getName())
                .description(workflow.getDescription())
                .status(workflow.getStatus())
                .workflowType(workflow.getWorkflowType())
                .createdByUserId(workflow.getCreatedByUserId())
                .instituteId(workflow.getInstituteId())
                .createdAt(workflow.getCreatedAt())
                .updatedAt(workflow.getUpdatedAt())
                .schedules(null)
                .build();
    }
}

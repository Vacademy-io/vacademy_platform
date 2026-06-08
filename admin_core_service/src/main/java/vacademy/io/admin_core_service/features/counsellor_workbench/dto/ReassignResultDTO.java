package vacademy.io.admin_core_service.features.counsellor_workbench.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Response from /reassign and /reassign/preview. Same shape for both — preview
 * sets {@code dry_run = true} and skips persistence.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ReassignResultDTO {
    private Boolean dryRun;
    private Integer totalLeads;
    private List<AssignmentResult> assignments;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class AssignmentResult {
        private String leadId;
        private String leadName;
        private String fromUserId;
        private String toUserId;
        private String toUserName;
    }
}

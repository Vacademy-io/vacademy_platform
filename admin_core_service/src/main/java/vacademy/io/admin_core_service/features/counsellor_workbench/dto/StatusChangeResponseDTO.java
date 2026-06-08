package vacademy.io.admin_core_service.features.counsellor_workbench.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Response to PATCH /counsellors/{userId}/status. When the counsellor is
 * being marked INACTIVE, open_leads carries the list the UI needs to
 * pre-populate the reassign dialog.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class StatusChangeResponseDTO {
    private String userId;
    private String status;
    private Integer poolsAffected;
    private List<WorkbenchLeadDTO> openLeads;
}

package vacademy.io.admin_core_service.features.learner.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Response DTO for sub-org admins
 * Returns list of admins for a specific package session and sub-org
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class SubOrgAdminsResponseDTO {
    private String userId;
    private String packageSessionId;
    private String subOrgId;
    private List<AdminDetailsDTO> admins;
    private Integer totalAdmins;
}

package vacademy.io.admin_core_service.features.applicant.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.common.auth.dto.UserDTO;

import java.util.List;

/**
 * Response DTO for parent with all children and their details
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ParentWithChildrenResponseDTO {

    /**
     * Parent user information from auth service
     */
    private UserDTO parentInfo;

    /**
     * List of all children with their applications and enrollments
     */
    private List<ChildDetailsDTO> children;
}

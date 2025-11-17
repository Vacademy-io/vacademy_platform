package vacademy.io.admin_core_service.features.learner.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Response DTO for institute purchased course with enrolled users
 * Contains 2 main sections:
 * 1. Sub-Organization Details (purchasing institute information)
 * 2. Student Mappings (list of student_session_institute_group_mapping rows with user details)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class SubOrgResponseDTO {
    private SubOrgDetailsDTO subOrgDetails;
    private List<StudentMappingWithUserDTO> studentMappings;
}

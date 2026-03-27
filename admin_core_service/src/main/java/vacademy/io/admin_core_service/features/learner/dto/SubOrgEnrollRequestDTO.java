package vacademy.io.admin_core_service.features.learner.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.common.dto.CustomFieldValueDTO;

import java.util.Date;
import java.util.List;

/**
 * Request DTO for enrolling a learner through sub-organization purchase
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class SubOrgEnrollRequestDTO {

    private UserDTO user;
    private String packageSessionId;
    private String subOrgId;
    private String instituteId;
    private String groupId;
    private Date enrolledDate;
    private Date expiryDate;
    private String instituteEnrollmentNumber;
    private String status;
    private String commaSeparatedOrgRoles;
    private List<CustomFieldValueDTO> customFieldValues;
}

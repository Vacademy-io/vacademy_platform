package vacademy.io.admin_core_service.features.institute.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.common.dto.CustomFieldDTO;
import vacademy.io.admin_core_service.features.enroll_invite.enums.SubOrgRoles;
import vacademy.io.admin_core_service.features.institute_learner.dto.InstituteInfoDTOForTableSetup;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class InstituteSetupDTO {
    private InstituteInfoDTOForTableSetup instituteInfoDTO;
    private List <SubOrgRoles> subOrgRoles;
    private List<CustomFieldDTO> dropdownCustomFields;
}

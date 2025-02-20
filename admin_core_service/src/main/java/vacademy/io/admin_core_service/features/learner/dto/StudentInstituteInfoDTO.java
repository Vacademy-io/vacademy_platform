package vacademy.io.admin_core_service.features.learner.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.common.institute.dto.InstituteSubModuleDTO;
import vacademy.io.common.institute.dto.PackageSessionDTO;
import vacademy.io.common.institute.dto.SubjectDTO;

import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class StudentInstituteInfoDTO {
    private String instituteName;
    private String id;
    private String country;
    private String state;
    private String city;
    private String address;
    private String pinCode;
    private String phone;
    private String email;
    private String websiteUrl;
    private String instituteLogoFileId;
    private String instituteThemeCode;
    private List<InstituteSubModuleDTO> subModules;
    private List<PackageSessionDTO> batchesForSessions;
    private List<SubjectDTO> subjects;
}

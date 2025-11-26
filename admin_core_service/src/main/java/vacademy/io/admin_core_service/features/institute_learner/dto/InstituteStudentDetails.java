package vacademy.io.admin_core_service.features.institute_learner.dto;


import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class InstituteStudentDetails {
    private String instituteId;
    private String packageSessionId;
    private String enrollmentId;
    private String enrollmentStatus;
    private Date enrollmentDate;
    private String groupId;
    private String accessDays;
    private String destinationPackageSessionId;
    private String userPlanId;
    private String subOrgId;
    private String commaSeparatedOrgRoles;
}

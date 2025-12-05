package vacademy.io.admin_core_service.features.institute_learner.dto.student_stats_dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Builder;
import lombok.Data;
import vacademy.io.admin_core_service.features.institute_learner.dto.StudentV2DTO;
import vacademy.io.common.auth.dto.UserDTO;

import java.util.Date;
import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@Builder
public class StudentStatsDTO{
    private String userType; // NEW_USER or RETAINER
    private UserDTO userDTO;
    private List<String> packageSessionIds; // Array of package session IDs
    private String commaSeparatedOrgRoles;
    private Date createdAt;
    private Date startDate;
    private Date endDate;
}

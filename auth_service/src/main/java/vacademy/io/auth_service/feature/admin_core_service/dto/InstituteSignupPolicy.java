package vacademy.io.auth_service.feature.admin_core_service.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InstituteSignupPolicy {
    private String passwordStrategy; // manual | auto | null
    private String passwordDelivery; // none | email | null
    private boolean allowLearnersToCreateCourses; // controls TEACHER role
    private String userNameStrategy;
}


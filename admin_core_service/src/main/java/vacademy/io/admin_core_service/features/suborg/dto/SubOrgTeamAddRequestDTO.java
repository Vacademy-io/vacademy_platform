package vacademy.io.admin_core_service.features.suborg.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class SubOrgTeamAddRequestDTO {
    private String subOrgId;
    private String instituteId;
    private MemberUser user;
    /** Custom role name (no system role allowed when caller is a sub-org admin). */
    private String roleName;
    /** Optional: existing role id; if present we do NOT create a new role. */
    private String roleId;
    private List<String> packageSessionIds;
    private String accessPermission;

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class MemberUser {
        private String email;
        private String fullName;
        private String mobileNumber;
    }
}

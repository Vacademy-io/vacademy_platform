package vacademy.io.admin_core_service.features.faculty.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserAccessDetailsDTO {
    private String userId;
    private String instituteId;
    private List<FacultyAccessMappingDTO> accessMappings;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FacultyAccessMappingDTO {
        private String id;
        private String userType;
        private String typeId;
        private String accessType;
        private String accessId;
        private String accessPermission;
        private String linkageType;
        private String suborgId;
        private String packageSessionId;
        private String subjectId;
        private String status;
        private String name;
    }
}

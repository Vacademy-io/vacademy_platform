package vacademy.io.admin_core_service.features.parent_portal.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * One child a guardian can monitor, enriched with the institute + batch context
 * that the raw auth_service {@code UserDTO} lacks. Powers the child-picker screen.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ParentChildSummaryDTO {
    private String childUserId;
    private String fullName;
    private String email;
    private String mobileNumber;
    private String profilePicFileId;
    private String instituteId;
    private String instituteName;
    private List<EnrollmentSummary> enrollments;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class EnrollmentSummary {
        private String packageSessionId;
        private String batchName;
        private String status;
    }
}

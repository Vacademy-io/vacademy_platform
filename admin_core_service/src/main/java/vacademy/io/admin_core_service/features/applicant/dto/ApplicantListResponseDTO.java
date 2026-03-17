package vacademy.io.admin_core_service.features.applicant.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Timestamp;
import java.util.Date;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ApplicantListResponseDTO {

    // Applicant basic info
    private String applicantId;
    private String trackingId;
    private String overallStatus;
    private String workflowType;
    private String applicationStageStatus;
    private Timestamp createdAt;
    private Timestamp updatedAt;

    private ApplicationStageInfo applicationStage;

    private StudentData studentData;

    private ParentData parentData;

    private PackageSessionData packageSession;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class ApplicationStageInfo {
        private String stageId;
        private String stageName;
        private String source;
        private String sourceId;
        private String type;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class StudentData {
        private String userId;
        private String fullName;
        private String gender;
        private Date dateOfBirth;
        private String fatherName;
        private String motherName;
        private String addressLine;
        private String city;
        private String pinCode;
        private String previousSchoolName;
        private String applyingForClass;
        private String academicYear;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class ParentData {
        private String userId;
        private String fullName;
        private String email;
        private String mobileNumber;
        private String addressLine;
        private String city;
        private String pinCode;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class PackageSessionData {
        private String packageSessionId;
        private String sessionName;
        private String levelName;
        private String packageName;
        private String groupName;
        private Date startTime;
        private String status;
        private Boolean isParent;
        private String parentId;
    }
}

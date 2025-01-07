package vacademy.io.assessment_service.features.assessment.dto.create_assessment;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.assessment_service.features.assessment.dto.RegistrationFieldDto;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AssessmentRegistrationsDto {
    private boolean closedTest;
    private OpenTestDetails openTestDetails;
    private List<String> preRegisterBatchesDetails;
    private List<StudentDetails> preRegisterStudentsDetails;
    private String joinLink;
    private NotifyStudent notifyStudent;
    private NotifyParent notifyParent;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class OpenTestDetails {
        private boolean checked;
        private String registrationStartDate;
        private String registrationEndDate;
        private String instructionsHtml;
        private RegistrationFormDetails registrationFormDetails;

        @Data
        @Builder
        @NoArgsConstructor
        @AllArgsConstructor
        @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
        public static class RegistrationFormDetails {
            private String name;
            private String email;
            private String phone;
            private List<RegistrationFieldDto> customAddedFields;
        }

        // Getters and Setters
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class SelectBatch {
        private boolean checked;
        private List<String> batchDetails;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class StudentDetails {
        private String userId;
        private String batchId;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class NotifyStudent {
        private boolean whenAssessmentCreated;
        private boolean showLeaderboard;
        private boolean beforeAssessmentGoesLive;
        private boolean whenAssessmentLive;
        private boolean whenAssessmentReportGenerated;

    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class NotifyParent {
        private boolean whenAssessmentCreated;
        private boolean beforeAssessmentGoesLive;
        private boolean showLeaderboard;
        private boolean whenAssessmentLive;
        private boolean whenStudentAppears;
        private boolean whenStudentFinishesTest;
        private boolean whenAssessmentReportGenerated;
    }
}

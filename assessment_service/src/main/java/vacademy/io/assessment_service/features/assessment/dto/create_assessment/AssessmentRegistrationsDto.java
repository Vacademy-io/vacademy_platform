package vacademy.io.assessment_service.features.assessment.dto.create_assessment;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.assessment_service.features.assessment.dto.RegistrationFieldDto;
import vacademy.io.common.student.dto.BasicParticipantDTO;

import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AssessmentRegistrationsDto {
    private boolean closedTest;
    private OpenTestDetails openTestDetails;
    private List<String> addedPreRegisterBatchesDetails = new ArrayList<>();
    private List<String> deletedPreRegisterBatchesDetails = new ArrayList<>();
    private List<BasicParticipantDTO> addedPreRegisterStudentsDetails = new ArrayList<>();
    private List<BasicParticipantDTO> deletedPreRegisterStudentsDetails = new ArrayList<>();
    private String updatedJoinLink;
    private NotifyStudent notifyStudent;
    private NotifyParent notifyParent;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class OpenTestDetails {
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
            private List<RegistrationFieldDto> addedCustomAddedFields = new ArrayList<>();
            private List<RegistrationFieldDto> removedCustomAddedFields = new ArrayList<>();
        }

    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class NotifyStudent {
        private boolean whenAssessmentCreated;
        private boolean showLeaderboard;
        private Integer beforeAssessmentGoesLive;
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
        private Integer beforeAssessmentGoesLive;
        private boolean showLeaderboard;
        private boolean whenAssessmentLive;
        private boolean whenStudentAppears;
        private boolean whenStudentFinishesTest;
        private boolean whenAssessmentReportGenerated;
    }
}

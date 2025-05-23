package vacademy.io.assessment_service.features.assessment.service.creation;

import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import vacademy.io.assessment_service.features.assessment.dto.RolesBatchesAndUsersDto;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentInstituteMapping;
import vacademy.io.assessment_service.features.assessment.enums.StepStatus;
import vacademy.io.assessment_service.features.assessment.enums.creationSteps.AccessControlEnum;
import vacademy.io.assessment_service.features.assessment.enums.creationSteps.QuestionCreationEnum;
import vacademy.io.assessment_service.features.assessment.service.IStep;
import vacademy.io.assessment_service.features.assessment.service.StepOption;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Component
public class AssessmentAccessDetail extends IStep {

    private List<Map<String, String>> getStepsForManualUploadExam() {
        return List.of(Map.of(AccessControlEnum.CREATION_ACCESS.name().toLowerCase(), "REQUIRED"),
                Map.of(AccessControlEnum.REPORT_AND_SUBMISSION_ACCESS.name().toLowerCase(), "REQUIRED"),
                Map.of(AccessControlEnum.EVALUATION_ACCESS.name().toLowerCase(), "REQUIRED"),
                Map.of(AccessControlEnum.LIVE_ASSESSMENT_ACCESS.name().toLowerCase(), "REQUIRED")
        );
    }

    @Override
    public void checkStatusAndFetchData(Optional<Assessment> assessment) {
        setStatus(StepStatus.COMPLETED.name());
        if (assessment.isEmpty()) return;
        setAssessmentType(assessment.get().getAssessmentType());
        Optional<AssessmentInstituteMapping> assessmentInstituteMapping = getAssessmentUrlByInstituteIdAndAssessmentId(getInstituteId(), assessment.get());
        if (assessmentInstituteMapping.isEmpty()) return;
        Map<String, Object> savedData = new HashMap<>();

        savedData.put(AccessControlEnum.CREATION_ACCESS.name().toLowerCase(), new RolesBatchesAndUsersDto(null, getDetailsFromCommaSeparatedString(assessmentInstituteMapping.get().getCommaSeparatedCreationRoles()), getDetailsFromCommaSeparatedString(assessmentInstituteMapping.get().getCommaSeparatedCreationUserIds()), null));
        savedData.put(AccessControlEnum.EVALUATION_ACCESS.name().toLowerCase(), new RolesBatchesAndUsersDto(null, getDetailsFromCommaSeparatedString(assessmentInstituteMapping.get().getCommaSeparatedEvaluationRoles()), getDetailsFromCommaSeparatedString(assessmentInstituteMapping.get().getCommaSeparatedEvaluationUserIds()), assessmentInstituteMapping.get().getEvaluationSetting()));
        savedData.put(AccessControlEnum.LIVE_ASSESSMENT_ACCESS.name().toLowerCase(), new RolesBatchesAndUsersDto(null, getDetailsFromCommaSeparatedString(assessmentInstituteMapping.get().getCommaSeparatedLiveViewRoles()), getDetailsFromCommaSeparatedString(assessmentInstituteMapping.get().getCommaSeparatedLiveViewUserIds()), null));
        savedData.put(AccessControlEnum.REPORT_AND_SUBMISSION_ACCESS.name().toLowerCase(), new RolesBatchesAndUsersDto(null, getDetailsFromCommaSeparatedString(assessmentInstituteMapping.get().getCommaSeparatedSubmissionViewRoles()), getDetailsFromCommaSeparatedString(assessmentInstituteMapping.get().getCommaSeparatedSubmissionViewUserIds()), null));

        setSavedData(savedData);
    }

    private List<String> getDetailsFromCommaSeparatedString(String value) {
        if (!StringUtils.hasText(value)) return List.of();
        return List.of(value.split(","));
    }

    private Optional<AssessmentInstituteMapping> getAssessmentUrlByInstituteIdAndAssessmentId(String instituteId, Assessment assessment) {
        return assessment.getAssessmentInstituteMappings().stream().filter(
                assessmentInstituteMapping -> assessmentInstituteMapping.getAssessment().equals(assessment) && assessmentInstituteMapping.getInstituteId().equals(instituteId)).findFirst();
    }

    @Override
    public void fillStepKeysBasedOnAssessmentType(String type, String instituteId) {
        setStepName("Add Access Control");
        setInstituteId(instituteId);
        setStatus(StepStatus.INCOMPLETE.name());
        setType(type);
        switch (type) {
            case "EXAM":
                setStepKeys(getStepsForExam());
                break;
            case "MOCK":
                setStepKeys(getStepsForMock());
                break;
            case "PRACTICE":
                setStepKeys(getStepsForPractice());
                break;
            case "SURVEY":
                setStepKeys(getStepsForSurvey());
                break;
            case "MANUAL_UPLOAD_EXAM":
                setStepKeys(getStepsForManualUploadExam());
                break;
        }

        this.getFieldOptions().put(AccessControlEnum.ROLES.name().toLowerCase(), (List.of("ADMIN", "CREATOR", "EVALUATOR")).stream().map((option) ->
                new StepOption(QuestionCreationEnum.DURATION_DISTRIBUTION.name().toLowerCase(), option, null, false)
        ).toList());

    }


    private List<Map<String, String>> getStepsForExam() {
        // Todo: get steps based on saved assessment
        return List.of(Map.of(AccessControlEnum.CREATION_ACCESS.name().toLowerCase(), "REQUIRED"),
                Map.of(AccessControlEnum.REPORT_AND_SUBMISSION_ACCESS.name().toLowerCase(), "REQUIRED"),
                Map.of(AccessControlEnum.EVALUATION_ACCESS.name().toLowerCase(), "REQUIRED"),
                Map.of(AccessControlEnum.LIVE_ASSESSMENT_ACCESS.name().toLowerCase(), "REQUIRED")
        );
    }

    private List<Map<String, String>> getStepsForMock() {
        return List.of(Map.of(AccessControlEnum.CREATION_ACCESS.name().toLowerCase(), "REQUIRED"),
                Map.of(AccessControlEnum.REPORT_AND_SUBMISSION_ACCESS.name().toLowerCase(), "REQUIRED"),
                Map.of(AccessControlEnum.EVALUATION_ACCESS.name().toLowerCase(), "REQUIRED"),
                Map.of(AccessControlEnum.LIVE_ASSESSMENT_ACCESS.name().toLowerCase(), "REQUIRED")
        );
    }

    private List<Map<String, String>> getStepsForSurvey() {
        return List.of(Map.of(AccessControlEnum.CREATION_ACCESS.name().toLowerCase(), "REQUIRED"),
                Map.of(AccessControlEnum.REPORT_AND_SUBMISSION_ACCESS.name().toLowerCase(), "REQUIRED"),
                Map.of(AccessControlEnum.EVALUATION_ACCESS.name().toLowerCase(), "REQUIRED"),
                Map.of(AccessControlEnum.LIVE_ASSESSMENT_ACCESS.name().toLowerCase(), "REQUIRED")
        );
    }

    private List<Map<String, String>> getStepsForPractice() {
        return List.of(Map.of(AccessControlEnum.CREATION_ACCESS.name().toLowerCase(), "REQUIRED"),
                Map.of(AccessControlEnum.REPORT_AND_SUBMISSION_ACCESS.name().toLowerCase(), "REQUIRED"),
                Map.of(AccessControlEnum.EVALUATION_ACCESS.name().toLowerCase(), "REQUIRED"),
                Map.of(AccessControlEnum.LIVE_ASSESSMENT_ACCESS.name().toLowerCase(), "REQUIRED")
        );
    }

}
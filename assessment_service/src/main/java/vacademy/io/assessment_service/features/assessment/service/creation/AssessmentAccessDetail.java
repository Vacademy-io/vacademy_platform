package vacademy.io.assessment_service.features.assessment.service.creation;

import org.springframework.stereotype.Component;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.enums.AccessControlEnum;
import vacademy.io.assessment_service.features.assessment.enums.ParticipantsCreationEnum;
import vacademy.io.assessment_service.features.assessment.enums.QuestionCreationEnum;
import vacademy.io.assessment_service.features.assessment.enums.StepStatus;
import vacademy.io.assessment_service.features.assessment.service.IStep;

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
        setStatus(StepStatus.INCOMPLETE.name());
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
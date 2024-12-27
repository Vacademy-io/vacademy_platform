package vacademy.io.assessment_service.features.assessment.service.creation;

import org.springframework.stereotype.Component;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.enums.AssessmentCreationEnum;
import vacademy.io.assessment_service.features.assessment.enums.DurationDistributionEnum;
import vacademy.io.assessment_service.features.assessment.enums.StepStatus;
import vacademy.io.assessment_service.features.assessment.service.IStep;
import vacademy.io.assessment_service.features.assessment.service.StepOption;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;


@Component
public class AssessmentBasicDetail extends IStep {

    @Override
    public void checkStatusAndFetchData(Optional<Assessment> assessment) {
        setStatus(StepStatus.INCOMPLETE.name());
    }

    @Override
    public void fillStepKeysBasedOnAssessmentType(String type, String instituteId) {
        setStepName("Basic Info");
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
            case "MANUAL_UPLOAD_EXAM":
                setStepKeys(getStepsForManualUploadExam());
                break;
        }

        this.getFieldOptions().put(AssessmentCreationEnum.DURATION_DISTRIBUTION.name().toLowerCase(), Arrays.stream(DurationDistributionEnum.values()).map((option) ->
                new StepOption(AssessmentCreationEnum.DURATION_DISTRIBUTION.name().toLowerCase(), option.name(), null, false)
        ).toList());

        this.getDefaultValues().put(AssessmentCreationEnum.DURATION_DISTRIBUTION.name().toLowerCase(), new StepOption(AssessmentCreationEnum.DURATION_DISTRIBUTION.name().toLowerCase(), DurationDistributionEnum.ASSESSMENT.name(), null, false));
        this.getDefaultValues().put(AssessmentCreationEnum.ASSESSMENT_PREVIEW.name().toLowerCase(), new StepOption(AssessmentCreationEnum.ASSESSMENT_PREVIEW.name().toLowerCase(), "FALSE", null, false));
        this.getDefaultValues().put(AssessmentCreationEnum.CAN_SWITCH_SECTION.name().toLowerCase(), new StepOption(AssessmentCreationEnum.CAN_SWITCH_SECTION.name().toLowerCase(), "TRUE", null, false));
        this.getDefaultValues().put(AssessmentCreationEnum.ADD_TIME_CONSENT.name().toLowerCase(), new StepOption(AssessmentCreationEnum.ADD_TIME_CONSENT.name().toLowerCase(), "TRUE", null, false));
        this.getDefaultValues().put(AssessmentCreationEnum.REATTEMPT_CONSENT.name().toLowerCase(), new StepOption(AssessmentCreationEnum.REATTEMPT_CONSENT.name().toLowerCase(), "TRUE", null, false));

    }

    private List<Map<String, String>> getStepsForExam() {
        return List.of(Map.of(AssessmentCreationEnum.BOUNDATION_START_DATE.name().toLowerCase(), "REQUIRED"),
                Map.of(AssessmentCreationEnum.SUBJECT_SELECTION.name().toLowerCase(), "OPTIONAL"),
                Map.of(AssessmentCreationEnum.BOUNDATION_END_DATE.name().toLowerCase(), "REQUIRED"),
                Map.of(AssessmentCreationEnum.DURATION.name().toLowerCase(), "REQUIRED"),
                Map.of(AssessmentCreationEnum.DURATION_DISTRIBUTION.name().toLowerCase(), "REQUIRED"),
                Map.of(AssessmentCreationEnum.CAN_SWITCH_SECTION.name().toLowerCase(), "REQUIRED"),
                Map.of(AssessmentCreationEnum.ASSESSMENT_VISIBILITY.name().toLowerCase(), "REQUIRED"),
                Map.of(AssessmentCreationEnum.EXPECTED_PARTICIPANTS.name().toLowerCase(), "REQUIRED"),
                Map.of(AssessmentCreationEnum.OMR_MODE.name().toLowerCase(), "REQUIRED"),
                Map.of(AssessmentCreationEnum.EVALUATION_TYPE.name().toLowerCase(), "REQUIRED"),
                Map.of(AssessmentCreationEnum.ASSESSMENT_PREVIEW.name().toLowerCase(), "REQUIRED"),
                Map.of(AssessmentCreationEnum.ADD_TIME_CONSENT.name().toLowerCase(), "REQUIRED"),
                Map.of(AssessmentCreationEnum.REATTEMPT_CONSENT.name().toLowerCase(), "REQUIRED"));
    }

    private List<Map<String, String>> getStepsForMock() {

        return List.of(
                Map.of(AssessmentCreationEnum.SUBJECT_SELECTION.name().toLowerCase(), "OPTIONAL"),
                Map.of(AssessmentCreationEnum.DURATION.name().toLowerCase(), "REQUIRED"),
                Map.of(AssessmentCreationEnum.DURATION_DISTRIBUTION.name().toLowerCase(), "REQUIRED"),
                Map.of(AssessmentCreationEnum.CAN_SWITCH_SECTION.name().toLowerCase(), "REQUIRED"),
                Map.of(AssessmentCreationEnum.ASSESSMENT_VISIBILITY.name().toLowerCase(), "REQUIRED"),
                Map.of(AssessmentCreationEnum.EXPECTED_PARTICIPANTS.name().toLowerCase(), "REQUIRED"),
                Map.of(AssessmentCreationEnum.OMR_MODE.name().toLowerCase(), "REQUIRED"),
                Map.of(AssessmentCreationEnum.EVALUATION_TYPE.name().toLowerCase(), "REQUIRED"),
                Map.of(AssessmentCreationEnum.ASSESSMENT_PREVIEW.name().toLowerCase(), "REQUIRED"),
                Map.of(AssessmentCreationEnum.ADD_TIME_CONSENT.name().toLowerCase(), "REQUIRED"),
                Map.of(AssessmentCreationEnum.REATTEMPT_COUNT.name().toLowerCase(), "REQUIRED"));
    }

    private List<Map<String, String>> getStepsForSurvey() {
        return List.of(
                Map.of(AssessmentCreationEnum.SUBJECT_SELECTION.name().toLowerCase(), "OPTIONAL"),
                Map.of(AssessmentCreationEnum.ASSESSMENT_VISIBILITY.name().toLowerCase(), "REQUIRED"),
                Map.of(AssessmentCreationEnum.EXPECTED_PARTICIPANTS.name().toLowerCase(), "REQUIRED"),
                Map.of(AssessmentCreationEnum.REATTEMPT_COUNT.name().toLowerCase(), "REQUIRED"));

    }

    private List<Map<String, String>> getStepsForPractice() {
        return List.of(
                Map.of(AssessmentCreationEnum.SUBJECT_SELECTION.name().toLowerCase(), "OPTIONAL"),
                Map.of(AssessmentCreationEnum.ASSESSMENT_VISIBILITY.name().toLowerCase(), "REQUIRED"),
                Map.of(AssessmentCreationEnum.EXPECTED_PARTICIPANTS.name().toLowerCase(), "REQUIRED"),
                Map.of(AssessmentCreationEnum.OMR_MODE.name().toLowerCase(), "REQUIRED"),
                Map.of(AssessmentCreationEnum.EVALUATION_TYPE.name().toLowerCase(), "REQUIRED"),
                Map.of(AssessmentCreationEnum.ASSESSMENT_PREVIEW.name().toLowerCase(), "REQUIRED"),
                Map.of(AssessmentCreationEnum.REATTEMPT_COUNT.name().toLowerCase(), "REQUIRED"));
    }

    private List<Map<String, String>> getStepsForManualUploadExam() {
        return List.of(Map.of(AssessmentCreationEnum.BOUNDATION_START_DATE.name().toLowerCase(), "REQUIRED"),
                Map.of(AssessmentCreationEnum.SUBJECT_SELECTION.name().toLowerCase(), "OPTIONAL"),
                Map.of(AssessmentCreationEnum.BOUNDATION_END_DATE.name().toLowerCase(), "REQUIRED"),
                Map.of(AssessmentCreationEnum.ASSESSMENT_VISIBILITY.name().toLowerCase(), "REQUIRED"),
                Map.of(AssessmentCreationEnum.EXPECTED_PARTICIPANTS.name().toLowerCase(), "REQUIRED"),
                Map.of(AssessmentCreationEnum.REATTEMPT_CONSENT.name().toLowerCase(), "REQUIRED"),
                Map.of(AssessmentCreationEnum.REATTEMPT_COUNT.name().toLowerCase(), "REQUIRED"));

    }


}
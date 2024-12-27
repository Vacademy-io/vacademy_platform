package vacademy.io.assessment_service.features.assessment.service;

import lombok.Getter;
import lombok.Setter;
import vacademy.io.assessment_service.features.assessment.dto.StepResponseDto;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;

import java.util.List;
import java.util.Map;
import java.util.Optional;

public abstract class IStep {

    @Setter
    @Getter
    private String stepName;

    @Setter
    @Getter
    private String status;

    @Setter
    @Getter
    private String instituteId;

    @Setter
    @Getter
    private String type;

    @Getter
    @Setter
    private Map<String, Object> savedData;

    @Getter
    @Setter
    private List<Map<String, String>> stepKeys;

    @Getter
    @Setter
    private Map<String, StepOption> defaultValues;

    @Getter
    @Setter
    private Map<String, List<StepOption>> fieldOptions;

    public abstract void checkStatusAndFetchData(Optional<Assessment> assessment);

    public abstract void fillStepKeysBasedOnAssessmentType(String assessmentType, String instituteId);

    public StepResponseDto toResponseDto() {
        return new StepResponseDto(this.stepName, this.status, this.instituteId, this.type, this.savedData, this.stepKeys, this.defaultValues, this.fieldOptions);
    }
}

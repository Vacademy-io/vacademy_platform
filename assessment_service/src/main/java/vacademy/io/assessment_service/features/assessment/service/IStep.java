package vacademy.io.assessment_service.features.assessment.service;

import lombok.Getter;
import lombok.Setter;
import vacademy.io.assessment_service.features.assessment.dto.StepResponseDto;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;

import java.util.*;

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

    @Setter
    @Getter
    private String assessmentType;

    @Getter
    @Setter
    private Map<String, Object> savedData = new HashMap<>();

    @Getter
    @Setter
    private List<Map<String, String>> stepKeys = new ArrayList<>();

    @Getter
    @Setter
    private Map<String, StepOption> defaultValues = new HashMap<>();

    @Getter
    @Setter
    private Map<String, List<StepOption>> fieldOptions = new HashMap<>();

    public abstract void checkStatusAndFetchData(Optional<Assessment> assessment);

    public abstract void fillStepKeysBasedOnAssessmentType(String assessmentType, String instituteId);

    public StepResponseDto toResponseDto() {
        return new StepResponseDto(this.stepName, this.status, this.instituteId, this.type,this.assessmentType ,this.savedData, this.stepKeys, this.defaultValues, this.fieldOptions);
    }
}

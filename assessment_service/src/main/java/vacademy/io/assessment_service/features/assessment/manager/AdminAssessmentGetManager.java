package vacademy.io.assessment_service.features.assessment.manager;


import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.AdminAssessmentFilter;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.AllAdminAssessmentResponse;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.AssessmentAdminListInitDto;
import vacademy.io.assessment_service.features.assessment.enums.AssessmentModeEnum;
import vacademy.io.assessment_service.features.assessment.enums.AssessmentVisibility;
import vacademy.io.assessment_service.features.question_core.enums.EvaluationTypes;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.Arrays;
import java.util.HashMap;

@Component
public class AdminAssessmentGetManager {
    public ResponseEntity<AssessmentAdminListInitDto> assessmentAdminListInit(CustomUserDetails user, String instituteId) {
        AssessmentAdminListInitDto assessmentAdminListInitDto = new AssessmentAdminListInitDto();
        assessmentAdminListInitDto.setAssessmentAccessStatuses(Arrays.stream(AssessmentVisibility.values()).map(AssessmentVisibility::name).toList());
        assessmentAdminListInitDto.setAssessmentModeTypes(Arrays.stream(AssessmentModeEnum.values()).map(AssessmentModeEnum::name).toList());
        assessmentAdminListInitDto.setEvaluationTypes(Arrays.stream(EvaluationTypes.values()).map(EvaluationTypes::name).toList());
        assessmentAdminListInitDto.setTagAndIds(new HashMap<>());
        return ResponseEntity.ok(assessmentAdminListInitDto);
    }

    public ResponseEntity<AllAdminAssessmentResponse> assessmentAdminListFilter(CustomUserDetails user, AdminAssessmentFilter allAdminAssessmentResponse, String instituteId) {
        return ResponseEntity.ok(new AllAdminAssessmentResponse());
    }
}

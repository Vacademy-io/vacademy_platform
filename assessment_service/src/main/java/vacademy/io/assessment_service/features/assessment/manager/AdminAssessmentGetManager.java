package vacademy.io.assessment_service.features.assessment.manager;


import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.AdminAssessmentFilter;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.AllAdminAssessmentResponse;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.AssessmentAdminListInitDto;
import vacademy.io.assessment_service.features.assessment.enums.AssessmentModeEnum;
import vacademy.io.assessment_service.features.assessment.enums.AssessmentVisibility;
import vacademy.io.assessment_service.features.question_core.enums.EvaluationTypes;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;

import static vacademy.io.common.core.standard_classes.ListService.createSortObject;

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

    public ResponseEntity<AllAdminAssessmentResponse> assessmentAdminListFilter(CustomUserDetails user, AdminAssessmentFilter adminAssessmentFilter, String instituteId, int pageNo, int pageSize) {
        // Create a sorting object based on the provided sort columns
        Sort thisSort = createSortObject(adminAssessmentFilter.getSortColumns());

        //TODO: Check user permission

        // Create a pageable instance for pagination
        Pageable pageable = PageRequest.of(pageNo, pageSize, thisSort);

        makeFilterFieldEmptyArrayIfNull(adminAssessmentFilter);

//        // Retrieve employees based on the filter criteria
//        Page<Object[]> employeePage = questionPaperRepository.findQuestionPapersByFilters(questionPaperFilter.getName(), questionPaperFilter.getStatuses(), questionPaperFilter.getLevelIds(), questionPaperFilter.getSubjectIds(), null, List.of(instituteId), pageable);
//
//        return createAllQuestionPaperResponseFromPaginatedData(employeePage);

        return null;
    }

    private void makeFilterFieldEmptyArrayIfNull(AdminAssessmentFilter adminAssessmentFilter) {

        if (adminAssessmentFilter.getAssessmentStatuses() == null) {
            adminAssessmentFilter.setAssessmentStatuses(new ArrayList<>());
        }
        if (adminAssessmentFilter.getAssessmentModes() == null) {
            adminAssessmentFilter.setAssessmentModes(new ArrayList<>());
        }
        if (adminAssessmentFilter.getBatchIds() == null) {
            adminAssessmentFilter.setBatchIds(new ArrayList<>());
        }
        if (adminAssessmentFilter.getTagIds() == null) {
            adminAssessmentFilter.setTagIds(new ArrayList<>());
        }
        if (adminAssessmentFilter.getSubjectsIds() == null) {
            adminAssessmentFilter.setSubjectsIds(new ArrayList<>());
        }
        if (adminAssessmentFilter.getAssessLiveStatuses() == null) {
            adminAssessmentFilter.setAssessLiveStatuses(new ArrayList<>());
        }
    }
}

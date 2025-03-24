package vacademy.io.assessment_service.features.assessment.manager;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.AdminAssessmentFilter;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.AdminBasicAssessmentListItemDto;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.AllAdminAssessmentResponse;
import vacademy.io.assessment_service.features.assessment.dto.manual_evaluation.EvaluatorAssessmentFilter;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentRepository;
import vacademy.io.assessment_service.features.assessment.service.assessment_get.AssessmentMapper;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

import static vacademy.io.common.core.standard_classes.ListService.createSortObject;

@Component
public class AdminAssessmentAccessManager {

    @Autowired
    AssessmentRepository assessmentRepository;


    public ResponseEntity<AllAdminAssessmentResponse> getAllManualAssessment(EvaluatorAssessmentFilter filer, int pageNo, int pageSize, String instituteId) {
        // Create a sorting object based on the provided sort columns
        Sort thisSort = createSortObject(filer.getSortColumns());
        Page<Object[]> assessmentsPage;

        // Create a pageable instance for pagination
        Pageable pageable = PageRequest.of(pageNo, pageSize, thisSort);

        makeFilterFieldEmptyArrayIfNull(filer);

        assessmentsPage = assessmentRepository.filterAssessmentsForManualType(filer.getName(),
                filer.getBatchIds().isEmpty() ? null : true,
                filer.getBatchIds(),
                filer.getSubjectsIds().isEmpty() ? null : true,
                filer.getSubjectsIds(),
                filer.getAssessmentStatuses(),
                filer.getGetLiveAssessments(),
                filer.getGetPassedAssessments(),
                filer.getGetUpcomingAssessments(),
                filer.getAssessmentModes(),
                filer.getAccessStatuses(),
                filer.getInstituteIds(),
                filer.getUserIds(),
                pageable);
        List<AdminBasicAssessmentListItemDto> content = assessmentsPage.stream().map(AssessmentMapper::toDto).collect(Collectors.toList());
        int queryPageNo = assessmentsPage.getNumber();
        int queryPageSize = assessmentsPage.getSize();
        long totalElements = assessmentsPage.getTotalElements();
        int totalPages = assessmentsPage.getTotalPages();
        boolean last = assessmentsPage.isLast();
        AllAdminAssessmentResponse response = AllAdminAssessmentResponse.builder().content(content).pageNo(queryPageNo).pageSize(queryPageSize).totalElements(totalElements).totalPages(totalPages).last(last).build();

        return ResponseEntity.ok(response);
    }

    private void makeFilterFieldEmptyArrayIfNull(EvaluatorAssessmentFilter adminAssessmentFilter) {

        if (adminAssessmentFilter.getAssessmentStatuses() == null) {
            adminAssessmentFilter.setAssessmentStatuses(new ArrayList<>());
        }
        if (adminAssessmentFilter.getAssessmentModes() == null) {
            adminAssessmentFilter.setAssessmentModes(new ArrayList<>());
        }
        if (adminAssessmentFilter.getInstituteIds() == null) {
            adminAssessmentFilter.setInstituteIds(new ArrayList<>());
        }
        if(adminAssessmentFilter.getUserIds() == null){
            adminAssessmentFilter.setUserIds(new ArrayList<>());
        }
    }
}

package vacademy.io.assessment_service.features.assessment.manager;

import org.docx4j.org.apache.xpath.operations.Bool;
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


    public ResponseEntity<AllAdminAssessmentResponse> getAllManualAssessment(AdminAssessmentFilter adminAssessmentFilter, int pageNo, int pageSize, String instituteId, String userId, String userRole) {
        // Create a sorting object based on the provided sort columns
        Sort thisSort = createSortObject(adminAssessmentFilter.getSortColumns());
        Page<Object[]> assessmentsPage;

        // Create a pageable instance for pagination
        Pageable pageable = PageRequest.of(pageNo, pageSize, thisSort);

        makeFilterFieldEmptyArrayIfNull(adminAssessmentFilter);

        assessmentsPage = assessmentRepository.filterAssessmentsForManualType(adminAssessmentFilter.getName(), adminAssessmentFilter.getBatchIds().isEmpty() ? null : true, adminAssessmentFilter.getBatchIds(), adminAssessmentFilter.getSubjectsIds().isEmpty() ? null : true, adminAssessmentFilter.getSubjectsIds(), adminAssessmentFilter.getAssessmentStatuses(), adminAssessmentFilter.getGetLiveAssessments(), adminAssessmentFilter.getGetPassedAssessments(), adminAssessmentFilter.getGetUpcomingAssessments(), adminAssessmentFilter.getAssessmentModes(), adminAssessmentFilter.getAccessStatuses(), adminAssessmentFilter.getInstituteIds(), userRole, userId,pageable);
        List<AdminBasicAssessmentListItemDto> content = assessmentsPage.stream().map(AssessmentMapper::toDto).collect(Collectors.toList());
        int queryPageNo = assessmentsPage.getNumber();
        int queryPageSize = assessmentsPage.getSize();
        long totalElements = assessmentsPage.getTotalElements();
        int totalPages = assessmentsPage.getTotalPages();
        boolean last = assessmentsPage.isLast();
        AllAdminAssessmentResponse response = AllAdminAssessmentResponse.builder().content(content).pageNo(queryPageNo).pageSize(queryPageSize).totalElements(totalElements).totalPages(totalPages).last(last).build();

        return ResponseEntity.ok(response);
    }

    private void makeFilterFieldEmptyArrayIfNull(AdminAssessmentFilter adminAssessmentFilter) {

        if (adminAssessmentFilter.getAssessmentStatuses() == null) {
            adminAssessmentFilter.setAssessmentStatuses(new ArrayList<>());
        }
        if (adminAssessmentFilter.getAssessmentModes() == null) {
            adminAssessmentFilter.setAssessmentModes(new ArrayList<>());
        }
        if (adminAssessmentFilter.getInstituteIds() == null) {
            adminAssessmentFilter.setInstituteIds(new ArrayList<>());
        }
        if (adminAssessmentFilter.getEvaluationTypes() == null){
            adminAssessmentFilter.setEvaluationTypes(new ArrayList<>());
        }
    }
}

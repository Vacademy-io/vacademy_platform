package vacademy.io.assessment_service.features.student_assessment.manager;


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
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.enums.AssessmentModeEnum;
import vacademy.io.assessment_service.features.assessment.enums.AssessmentStatus;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentRepository;
import vacademy.io.assessment_service.features.assessment.service.assessment_get.AssessmentMapper;
import vacademy.io.assessment_service.features.student_assessment.dto.AllStudentAssessmentResponse;
import vacademy.io.assessment_service.features.student_assessment.dto.StudentAssessmentFilter;
import vacademy.io.assessment_service.features.student_assessment.dto.StudentAssessmentMapper;
import vacademy.io.assessment_service.features.student_assessment.dto.StudentBasicAssessmentListItemDto;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

import static vacademy.io.common.core.standard_classes.ListService.createSortObject;

@Component
public class LearnerAssessmentGetManager {

    @Autowired
    AssessmentRepository assessmentRepository;

    public ResponseEntity<AllStudentAssessmentResponse> assessmentListFilter(CustomUserDetails user, StudentAssessmentFilter studentAssessmentFilter, String instituteId, int pageNo, int pageSize) {

        // Create a sorting object based on the provided sort columns
        Sort thisSort = createSortObject(studentAssessmentFilter.getSortColumns());
        Page<Object[]> assessmentsPage;
        //TODO: Check user permission

        // Create a pageable instance for pagination
        Pageable pageable = PageRequest.of(pageNo, pageSize, thisSort);

        makeFilterFieldEmptyArrayIfNull(studentAssessmentFilter);

        assessmentsPage = assessmentRepository.studentAssessments(studentAssessmentFilter.getName(), studentAssessmentFilter.getBatchIds().isEmpty() ? null : true, studentAssessmentFilter.getBatchIds(), List.of(AssessmentStatus.PUBLISHED.name()), studentAssessmentFilter.getGetLiveAssessments(), studentAssessmentFilter.getGetPassedAssessments(), studentAssessmentFilter.getGetUpcomingAssessments(), Arrays.stream(AssessmentModeEnum.values()).map(AssessmentModeEnum::name).toList(), studentAssessmentFilter.getInstituteIds(), true, studentAssessmentFilter.getUserIds(), pageable);
        List<StudentBasicAssessmentListItemDto> content = assessmentsPage.stream().map(StudentAssessmentMapper::toDto).collect(Collectors.toList());
        int queryPageNo = assessmentsPage.getNumber();
        int queryPageSize = assessmentsPage.getSize();
        long totalElements = assessmentsPage.getTotalElements();
        int totalPages = assessmentsPage.getTotalPages();
        boolean last = assessmentsPage.isLast();
        AllStudentAssessmentResponse response = AllStudentAssessmentResponse.builder().content(content).pageNo(queryPageNo).pageSize(queryPageSize).totalElements(totalElements).totalPages(totalPages).last(last).build();

        return ResponseEntity.ok(response);
    }


    private void makeFilterFieldEmptyArrayIfNull(StudentAssessmentFilter adminAssessmentFilter) {

        if (adminAssessmentFilter.getInstituteIds() == null) {
            adminAssessmentFilter.setInstituteIds(new ArrayList<>());
        }
    }
}

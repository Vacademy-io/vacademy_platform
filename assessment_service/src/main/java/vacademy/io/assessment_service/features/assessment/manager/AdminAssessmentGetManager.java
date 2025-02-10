package vacademy.io.assessment_service.features.assessment.manager;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import vacademy.io.assessment_service.features.assessment.dto.LeaderBoardDto;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.*;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response.AssessmentOverviewDto;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response.AssessmentOverviewResponse;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response.MarksRankDto;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.enums.AssessmentModeEnum;
import vacademy.io.assessment_service.features.assessment.enums.AssessmentStatus;
import vacademy.io.assessment_service.features.assessment.enums.AssessmentVisibility;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentRepository;
import vacademy.io.assessment_service.features.assessment.repository.StudentAttemptRepository;
import vacademy.io.assessment_service.features.assessment.service.assessment_get.AssessmentMapper;
import vacademy.io.assessment_service.features.question_core.enums.EvaluationTypes;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.*;
import java.util.stream.Collectors;

import static vacademy.io.common.core.standard_classes.ListService.createSortObject;

@Component
public class AdminAssessmentGetManager {

    @Autowired
    AssessmentRepository assessmentRepository;

    @Autowired
    StudentAttemptRepository studentAttemptRepository;

    public ResponseEntity<AssessmentAdminListInitDto> assessmentAdminListInit(CustomUserDetails user, String instituteId) {
        AssessmentAdminListInitDto assessmentAdminListInitDto = new AssessmentAdminListInitDto();
        assessmentAdminListInitDto.setAssessmentAccessStatuses(Arrays.stream(AssessmentVisibility.values()).map(AssessmentVisibility::name).toList());
        assessmentAdminListInitDto.setAssessmentModeTypes(Arrays.stream(AssessmentModeEnum.values()).map(AssessmentModeEnum::name).toList());
        assessmentAdminListInitDto.setEvaluationTypes(Arrays.stream(EvaluationTypes.values()).map(EvaluationTypes::name).toList());
        assessmentAdminListInitDto.setAssessmentStatuses(Arrays.stream(AssessmentStatus.values()).map(AssessmentStatus::name).toList());
        assessmentAdminListInitDto.setTagAndIds(new HashMap<>());
        return ResponseEntity.ok(assessmentAdminListInitDto);
    }

    public ResponseEntity<AllAdminAssessmentResponse> assessmentAdminListFilter(CustomUserDetails user, AdminAssessmentFilter adminAssessmentFilter, String instituteId, int pageNo, int pageSize) {
        // Create a sorting object based on the provided sort columns
        Sort thisSort = createSortObject(adminAssessmentFilter.getSortColumns());
        Page<Object[]> assessmentsPage;
        //TODO: Check user permission

        // Create a pageable instance for pagination
        Pageable pageable = PageRequest.of(pageNo, pageSize, thisSort);

        makeFilterFieldEmptyArrayIfNull(adminAssessmentFilter);

        assessmentsPage = assessmentRepository.filterAssessments(adminAssessmentFilter.getName(), adminAssessmentFilter.getBatchIds().isEmpty() ? null : true, adminAssessmentFilter.getBatchIds(), adminAssessmentFilter.getSubjectsIds().isEmpty() ? null : true, adminAssessmentFilter.getSubjectsIds(), adminAssessmentFilter.getAssessmentStatuses(), adminAssessmentFilter.getGetLiveAssessments(), adminAssessmentFilter.getGetPassedAssessments(), adminAssessmentFilter.getGetUpcomingAssessments(), adminAssessmentFilter.getAssessmentModes(), adminAssessmentFilter.getAccessStatuses(), adminAssessmentFilter.getInstituteIds(), pageable);
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
    }

    public ResponseEntity<LeaderBoardResponse> getLeaderBoard(CustomUserDetails user, String assessmentId, LeaderboardFilter filter, String instituteId, int pageNo, int pageSize) {
        if(Objects.isNull(filter)) throw new VacademyException("Invalid Request");
        Sort sortColumn = createSortObject(filter.getSortColumns());

        Pageable pageable = PageRequest.of(pageNo, pageSize, sortColumn);
        Page<LeaderBoardDto> paginatedLeaderboard = null;

        if(StringUtils.hasText(filter.getName())){
            paginatedLeaderboard = studentAttemptRepository.findLeaderBoardForAssessmentAndInstituteIdWithSearch(filter.getName(), assessmentId, instituteId, filter.getStatus(), pageable);
        }
        else{
            paginatedLeaderboard = studentAttemptRepository.findLeaderBoardForAssessmentAndInstituteIdWithoutSearch(assessmentId, instituteId, filter.getStatus(), pageable);
        }

        return ResponseEntity.ok(createLeaderBoardResponse(paginatedLeaderboard));
    }

    private LeaderBoardResponse createLeaderBoardResponse(Page<LeaderBoardDto> paginatedLeaderboard) {
        if(Objects.isNull(paginatedLeaderboard)){
            return LeaderBoardResponse.builder()
                    .pageNo(0)
                    .pageSize(0)
                    .totalElements(0)
                    .content(null)
                    .last(true)
                    .totalPages(0)
                    .build();
        }
        List<LeaderBoardDto> allLeaderboard = paginatedLeaderboard.getContent();
        return LeaderBoardResponse.builder()
                .pageSize(paginatedLeaderboard.getSize())
                .pageNo(paginatedLeaderboard.getNumber())
                .content(allLeaderboard)
                .totalElements(paginatedLeaderboard.getTotalElements())
                .last(paginatedLeaderboard.isLast())
                .totalPages(paginatedLeaderboard.getTotalPages()).build();
    }

    public ResponseEntity<AssessmentOverviewResponse> getOverViewDetails(CustomUserDetails user, String assessmentId, String instituteId) {

        AssessmentOverviewDto assessmentOverviewDto = studentAttemptRepository.findAssessmentOverviewDetails(assessmentId, instituteId);
        List<MarksRankDto> marksRankDto = studentAttemptRepository.findMarkRankForAssessment(assessmentId, instituteId);
        return ResponseEntity.ok(AssessmentOverviewResponse.builder()
                .assessmentOverviewDto(assessmentOverviewDto)
                .marksRankDto(marksRankDto).build());
    }

    public ResponseEntity<String> getQuestionInsights(CustomUserDetails user, String assessmentId, String instituteId, String sectionId) {

        return ResponseEntity.ok("Done");
    }
}

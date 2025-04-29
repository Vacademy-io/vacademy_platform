package vacademy.io.assessment_service.features.assessment.manager;


import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import vacademy.io.assessment_service.features.assessment.dto.AssessmentQuestionPreviewDto;
import vacademy.io.assessment_service.features.assessment.dto.LeaderBoardDto;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.*;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.request.RevaluateRequest;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response.*;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.entity.Section;
import vacademy.io.assessment_service.features.assessment.enums.AssessmentModeEnum;
import vacademy.io.assessment_service.features.assessment.enums.AssessmentStatus;
import vacademy.io.assessment_service.features.assessment.enums.AssessmentVisibility;
import vacademy.io.assessment_service.features.assessment.enums.RevaluateRequestEnum;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentRepository;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentUserRegistrationRepository;
import vacademy.io.assessment_service.features.assessment.repository.SectionRepository;
import vacademy.io.assessment_service.features.assessment.repository.StudentAttemptRepository;
import vacademy.io.assessment_service.features.assessment.service.StudentAttemptService;
import vacademy.io.assessment_service.features.assessment.service.assessment_get.AssessmentMapper;
import vacademy.io.assessment_service.features.learner_assessment.dto.QuestionStatusDto;
import vacademy.io.assessment_service.features.learner_assessment.service.QuestionWiseMarksService;
import vacademy.io.assessment_service.features.question_core.enums.EvaluationTypes;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.core.standard_classes.ListService;
import vacademy.io.common.exceptions.VacademyException;

import java.util.*;
import java.util.stream.Collectors;

import static vacademy.io.common.core.standard_classes.ListService.createSortObject;

@Slf4j
@Component
public class AdminAssessmentGetManager {

    @Autowired
    AssessmentRepository assessmentRepository;

    @Autowired
    StudentAttemptRepository studentAttemptRepository;

    @Autowired
    AssessmentLinkQuestionsManager assessmentLinkQuestionsManager;

    @Autowired
    QuestionWiseMarksService questionWiseMarksService;

    @Autowired
    AssessmentUserRegistrationRepository assessmentUserRegistrationRepository;

    @Autowired
    StudentAttemptService studentAttemptService;

    @Autowired
    SectionRepository sectionRepository;

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

        assessmentsPage = assessmentRepository.filterAssessments(adminAssessmentFilter.getName(), adminAssessmentFilter.getBatchIds().isEmpty() ? null : true, adminAssessmentFilter.getBatchIds(), adminAssessmentFilter.getSubjectsIds().isEmpty() ? null : true, adminAssessmentFilter.getSubjectsIds(), adminAssessmentFilter.getAssessmentStatuses(), adminAssessmentFilter.getGetLiveAssessments(), adminAssessmentFilter.getGetPassedAssessments(), adminAssessmentFilter.getGetUpcomingAssessments(), adminAssessmentFilter.getAssessmentModes(), adminAssessmentFilter.getAccessStatuses(), adminAssessmentFilter.getInstituteIds(), adminAssessmentFilter.getEvaluationTypes(), adminAssessmentFilter.getAssessmentTypes(), pageable);
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
        if (adminAssessmentFilter.getEvaluationTypes() == null) {
            adminAssessmentFilter.setEvaluationTypes(new ArrayList<>());
        }
    }

    public ResponseEntity<LeaderBoardResponse> getLeaderBoard(CustomUserDetails user, String assessmentId, LeaderboardFilter filter, String instituteId, int pageNo, int pageSize) {
        if (Objects.isNull(filter)) throw new VacademyException("Invalid Request");
        Sort sortColumn = createSortObject(filter.getSortColumns());

        Pageable pageable = PageRequest.of(pageNo, pageSize, sortColumn);
        Page<LeaderBoardDto> paginatedLeaderboard = null;

        if (StringUtils.hasText(filter.getName())) {
            paginatedLeaderboard = studentAttemptRepository.findLeaderBoardForAssessmentAndInstituteIdWithSearch(filter.getName(), assessmentId, instituteId, filter.getStatus(), pageable);
        } else {
            paginatedLeaderboard = studentAttemptRepository.findLeaderBoardForAssessmentAndInstituteIdWithoutSearch(assessmentId, instituteId, filter.getStatus(), pageable);
        }

        return ResponseEntity.ok(createLeaderBoardResponse(paginatedLeaderboard));
    }

    private LeaderBoardResponse createLeaderBoardResponse(Page<LeaderBoardDto> paginatedLeaderboard) {
        if (Objects.isNull(paginatedLeaderboard)) {
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

    public ResponseEntity<QuestionInsightsResponse> getQuestionInsights(CustomUserDetails user, String assessmentId, String instituteId, String sectionId) {
        try {
            return ResponseEntity.ok(createInsights(user, assessmentId, sectionId));
        } catch (VacademyException e) {
            throw new VacademyException("Failed to retrieve: " + e.getMessage());
        }
    }

    public QuestionInsightsResponse createInsights(CustomUserDetails user, String assessmentId, String sectionId) {
        // Fetch question mappings
        Map<String, List<AssessmentQuestionPreviewDto>> questionMapping = assessmentLinkQuestionsManager.getQuestionsOfSection(user, assessmentId, sectionId);

        if (questionMapping == null || !questionMapping.containsKey(sectionId)) {
            return QuestionInsightsResponse.builder().questionInsightDto(new ArrayList<>()).build();
        }

        List<AssessmentQuestionPreviewDto> questionPreviewDtos = questionMapping.get(sectionId);
        if (questionPreviewDtos == null || questionPreviewDtos.isEmpty()) {
            return QuestionInsightsResponse.builder()
                    .questionInsightDto(new ArrayList<>()).build();
        }

        // Process insights for each question
        List<QuestionInsightsResponse.QuestionInsightDto> allResponses = questionPreviewDtos.stream()
                .map(question -> processQuestionInsights(assessmentId, question))
                .filter(Objects::nonNull) // Remove null responses (if any)
                .collect(Collectors.toList());

        return QuestionInsightsResponse.builder().questionInsightDto(allResponses).build();
    }

    private QuestionInsightsResponse.QuestionInsightDto processQuestionInsights(String assessmentId, AssessmentQuestionPreviewDto questionPreviewDto) {
        if (questionPreviewDto == null || questionPreviewDto.getQuestionId() == null) {
            throw new VacademyException("Invalid QuestionId or QuestionId not present");
        }

        // Fetch question status details
        QuestionStatusDto questionWiseMarks = questionWiseMarksService.getQuestionStatusForAssessmentAndQuestion(assessmentId, questionPreviewDto.getQuestionId(), questionPreviewDto.getSectionId());

        return createInsightsDto(questionPreviewDto, questionWiseMarks, assessmentId);
    }

    private QuestionInsightsResponse.QuestionInsightDto createInsightsDto(AssessmentQuestionPreviewDto questionPreviewDto, QuestionStatusDto questionWiseMarks, String assessmentId) {
        Long allAttempts = safeGetLong(assessmentUserRegistrationRepository.countUserRegisteredForAssessment(assessmentId, List.of("DELETED")));

        if (Objects.isNull(questionWiseMarks)) {
            return QuestionInsightsResponse.QuestionInsightDto.builder()
                    .assessmentQuestionPreviewDto(questionPreviewDto)
                    .totalAttempts(allAttempts)
                    .skipped(allAttempts)
                    .build();
        }

        Long correctAttempt = safeGetLong(questionWiseMarks.getCorrectAttempt());
        Long incorrectAttempt = safeGetLong(questionWiseMarks.getIncorrectAttempt());
        Long partialCorrectAttempt = safeGetLong(questionWiseMarks.getPartialCorrectAttempt());

        // Fetch total attempts (handle potential null return)
        Long skipped = Math.max(0, allAttempts - (correctAttempt + incorrectAttempt + partialCorrectAttempt));

        // Fetch top 3 correct responders (handle potential null return)
        List<Top3CorrectResponseDto> top3CorrectResponseDto = safeGetList(
                questionWiseMarksService.getTop3ParticipantsForCorrectResponse(assessmentId, questionWiseMarks.getQuestionId(), questionPreviewDto.getSectionId()));

        return QuestionInsightsResponse.QuestionInsightDto.builder()
                .assessmentQuestionPreviewDto(questionPreviewDto)
                .questionStatus(questionWiseMarks)
                .totalAttempts(allAttempts)
                .skipped(skipped)
                .top3CorrectResponseDto(top3CorrectResponseDto)
                .build();
    }

    // Helper method to handle null Long values
    private Long safeGetLong(Long value) {
        return value != null ? value : 0L;
    }

    // Helper method to handle null lists
    private <T> List<T> safeGetList(List<T> list) {
        return list != null ? list : Collections.emptyList();
    }

    public ResponseEntity<StudentReportResponse> getStudentReport(CustomUserDetails userDetails, String studentId, String instituteId, StudentReportFilter filter, int pageNo, int pageSize) {
        if (Objects.isNull(filter)) throw new VacademyException("Invalid Request filter");

        Sort sortingObject = ListService.createSortObject(filter.getSortColumns());
        Pageable pageable = PageRequest.of(pageNo, pageSize, sortingObject);

        Page<StudentReportDto> studentReportDtoPage = null;
        if (StringUtils.hasText(filter.getName())) {
            studentReportDtoPage = studentAttemptRepository.findAssessmentForUserWithFilterAndSearch(filter.getName(), studentId, instituteId, filter.getStatus(), filter.getReleaseResultStatus() != null ? filter.getReleaseResultStatus() : new ArrayList<>(), pageable);

        }
        if (Objects.isNull(studentReportDtoPage)) {
            studentReportDtoPage = studentAttemptRepository.findAssessmentForUserWithFilter(studentId, instituteId, filter.getStatus(), filter.getReleaseResultStatus() != null ? filter.getReleaseResultStatus() : new ArrayList<>(), pageable);
        }

        return ResponseEntity.ok(createReportResponse(studentReportDtoPage));
    }

    private StudentReportResponse createReportResponse(Page<StudentReportDto> studentReportDtoPage) {
        if (Objects.isNull(studentReportDtoPage)) {
            return StudentReportResponse.builder()
                    .pageNo(0)
                    .pageSize(0)
                    .totalPages(0)
                    .last(true)
                    .totalElements(0).build();
        }
        List<StudentReportDto> content = studentReportDtoPage.getContent();
        return StudentReportResponse.builder()
                .content(content)
                .pageNo(studentReportDtoPage.getNumber())
                .pageSize(studentReportDtoPage.getSize())
                .totalElements(studentReportDtoPage.getTotalElements())
                .last(studentReportDtoPage.isLast())
                .totalPages(studentReportDtoPage.getTotalPages())
                .build();
    }

    public ResponseEntity<String> revaluateAssessment(CustomUserDetails userDetails,
                                                      String assessmentId,
                                                      String methodType,
                                                      RevaluateRequest request,
                                                      String instituteId) {
        Assessment assessment = assessmentRepository.findById(assessmentId)
                .orElseThrow(() -> new VacademyException("Assessment Not Found"));

        return switch (RevaluateRequestEnum.valueOf(methodType)) {
            case ENTIRE_ASSESSMENT -> revaluateForAllParticipants(assessment, instituteId);
            case ENTIRE_ASSESSMENT_PARTICIPANTS ->
                    revaluateAssessmentForParticipantsAndAllAssessment(assessment, request, instituteId);
            case PARTICIPANTS_AND_QUESTIONS ->
                    revaluateAssessmentForParticipantsAndQuestions(assessment, request, instituteId);
            default -> ResponseEntity.ok("Invalid Request");
        };
    }


    private ResponseEntity<String> revaluateAssessmentForParticipantsAndQuestions(Assessment assessment, RevaluateRequest request, String instituteId) {
        if (Objects.isNull(request) || Objects.isNull(request.getAttemptIds()) || Objects.isNull(request.getQuestions()))
            throw new VacademyException("Invalid Request");

        try {
            studentAttemptService.revaluateCustomParticipantAndQuestionsWrapper(assessment, request, instituteId);
        } catch (Exception e) {
            log.error("[REVALUATE ERROR]: " + e.getMessage());
        }
        return ResponseEntity.ok("Done");
    }

    private ResponseEntity<String> revaluateAssessmentForParticipantsAndAllAssessment(Assessment assessment, RevaluateRequest request, String instituteId) {
        if (Objects.isNull(request) || Objects.isNull(request.getAttemptIds()))
            throw new VacademyException("Invalid Request");
        try {
            studentAttemptService.revaluateForParticipantIdsWrapper(assessment, request.getAttemptIds(), instituteId);
        } catch (Exception e) {
            log.error("[REVALUATE ERROR]: " + e.getMessage());
        }

        return ResponseEntity.ok("Done");
    }

    private ResponseEntity<String> revaluateForAllParticipants(Assessment assessment, String instituteId) {
        try {
            studentAttemptService.revaluateForAllParticipantsWrapper(assessment, instituteId);
        } catch (Exception e) {
            log.error("[REVALUATE ERROR]: " + e.getMessage());
        }

        return ResponseEntity.ok("Done");
    }

    public ResponseEntity<TotalMarksAssessmentResponse> initTotalAssessmentMarks(CustomUserDetails user, String assessmentId) {
        return ResponseEntity.ok(getTotalMarksForAssessment(assessmentId));
    }

    private TotalMarksAssessmentResponse getTotalMarksForAssessment(String assessmentId) {
        List<Section> sections = sectionRepository.findByAssessmentIdAndStatusNotIn(assessmentId, List.of("DELETED"));
        Map<String, Double> sectionMarksMapping = new HashMap<>();
        Double totalMarks = 0.0;

        for (Section mapping : sections) {
            totalMarks += mapping.getTotalMarks();
            sectionMarksMapping.put(mapping.getId(), mapping.getTotalMarks());
        }

        return TotalMarksAssessmentResponse.builder()
                .totalAchievableMarks(totalMarks)
                .sectionWiseAchievableMarks(sectionMarksMapping).build();
    }

    public ResponseEntity<AssessmentCountResponse> getAssessmentCount(CustomUserDetails userDetails, String instituteId) {
        AssessmentCountResponse response = assessmentRepository.getAssessmentAllTypeCount(instituteId);
        return ResponseEntity.ok(response);
    }
}

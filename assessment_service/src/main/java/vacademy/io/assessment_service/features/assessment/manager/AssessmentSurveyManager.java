package vacademy.io.assessment_service.features.assessment.manager;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import vacademy.io.assessment_service.features.assessment.dto.AssessmentQuestionPreviewDto;
import vacademy.io.assessment_service.features.assessment.dto.survey_dto.*;
import vacademy.io.assessment_service.features.assessment.dto.survey_dto.request.IndividualResponseRequestFilter;
import vacademy.io.assessment_service.features.assessment.dto.survey_dto.request.RespondentAllResponseFilter;
import vacademy.io.assessment_service.features.assessment.dto.survey_dto.response.IndividualAllResponse;
import vacademy.io.assessment_service.features.assessment.dto.survey_dto.response.IndividualResponseDto;
import vacademy.io.assessment_service.features.assessment.dto.survey_dto.response.RespondentAllResponse;
import vacademy.io.assessment_service.features.assessment.dto.survey_dto.response.RespondentResponseDto;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.service.AssessmentSurveyService;
import vacademy.io.assessment_service.features.assessment.service.assessment_get.AssessmentService;
import vacademy.io.assessment_service.features.learner_assessment.entity.QuestionWiseMarks;
import vacademy.io.assessment_service.features.learner_assessment.repository.QuestionWiseMarksRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;

import java.util.*;

@Component
public class AssessmentSurveyManager {
    @Autowired
    AssessmentLinkQuestionsManager assessmentLinkQuestionsManager;

    @Autowired
    AssessmentService assessmentService;

    @Autowired
    AssessmentSurveyService assessmentSurveyService;

    @Autowired
    QuestionWiseMarksRepository questionWiseMarksRepository;




    public ResponseEntity<SurveyOverviewDetailDto> getOverViewDetailsForInstitute(
            CustomUserDetails userDetails,
            String instituteId,
            String commaSeparatedSectionIds,
            String assessmentId
    ) {
        Optional<Assessment> assessment = assessmentService.getAssessmentFromId(assessmentId);
        if(assessment.isEmpty()) throw new VacademyException("Assessment Not Found");
        // Fetch all questions mapped by section
        Map<String, List<AssessmentQuestionPreviewDto>> questionMapping =
                assessmentLinkQuestionsManager.getQuestionsOfSection(
                        userDetails, assessmentId, commaSeparatedSectionIds
                );

        List<SurveyDto> surveys = assessmentSurveyService.getSurveyListFromQuestionMapping(assessment.get(), questionMapping);

        // Build SurveyOverviewDetailDto
        SurveyOverviewDetailDto overview = SurveyOverviewDetailDto.builder()
                .surveyId(assessmentId)
                .totalParticipants(assessmentSurveyService.getTotalParticipants(assessmentId)) // implement as per your participant logic
                .participantsResponded(assessmentSurveyService.getParticipantsResponded(assessmentId)) // implement as per your logic
                .allSurveys(surveys)
                .build();

        return ResponseEntity.ok(overview);
    }

    public ResponseEntity<IndividualAllResponse> getIndividualPaginatedResponse(CustomUserDetails userDetails, IndividualResponseRequestFilter filter, String instituteId, int pageNo, int pageSize) {
        Sort sort = createSortObject(filter.getSortColumns());

        Pageable pageable = PageRequest.of(pageNo,pageSize,sort);

        Page<QuestionWiseMarks> paginatedResponse = questionWiseMarksRepository.findSurveyResponseWithFilterAndSearch(filter.getName(),instituteId,filter.getQuestionIds(), filter.getAssessmentIds(), filter.getSectionIds(), filter.getStatus(), pageable);
        return ResponseEntity.ok(createResponseForAllRespondent(paginatedResponse));
    }

    private IndividualAllResponse createResponseForAllRespondent(Page<QuestionWiseMarks> paginatedResponse) {
        if(paginatedResponse==null) return IndividualAllResponse.builder()
                .content(new ArrayList<>())
                .last(true)
                .totalPages(0)
                .totalElements(0)
                .pageNo(0)
                .pageSize(0)
                .build();

        return IndividualAllResponse.builder()
                .content(createContent(paginatedResponse.getContent()))
                .totalPages(paginatedResponse.getTotalPages())
                .totalElements(paginatedResponse.getTotalElements())
                .last(paginatedResponse.isLast())
                .pageSize(paginatedResponse.getSize())
                .pageNo(paginatedResponse.getNumber()).build();
    }

    private List<IndividualResponseDto> createContent(List<QuestionWiseMarks> questionWiseResponse) {
        List<IndividualResponseDto> response = new ArrayList<>();

        questionWiseResponse.forEach(questionWise->{
            response.add(IndividualResponseDto.builder()
                    .email(questionWise.getStudentAttempt().getRegistration().getUserEmail())
                    .name(questionWise.getStudentAttempt().getRegistration().getParticipantName())
                    .response(questionWise.getResponseJson()).build());
        });

        return response;
    }

    public static Sort createSortObject(Map<String, String> sortMap) {
        //Todo: Testing for sorting
        if (sortMap == null) return Sort.unsorted();

        List<Sort.Order> orders = new ArrayList<>();
        for (Map.Entry<String, String> entry : sortMap.entrySet()) {
            Sort.Direction direction = "DESC".equalsIgnoreCase(entry.getValue()) ? Sort.Direction.DESC : Sort.Direction.ASC;
            orders.add(new Sort.Order(direction, entry.getKey()));
        }

        return Sort.by(orders);
    }

    public ResponseEntity<RespondentAllResponse> getRespondentResponseForEachQuestion(CustomUserDetails userDetails, RespondentAllResponseFilter filter, String instituteId, int pageNo, int pageSize) {
        Sort sort = createSortObject(filter.getSortColumns());

        Pageable pageable = PageRequest.of(pageNo,pageSize,sort);

        Page<QuestionWiseMarks> paginatedResponse = questionWiseMarksRepository.findResponseForRespondentWithFilterAndSearch(filter.getName(),instituteId,filter.getAttemptIds(), filter.getAssessmentIds(), filter.getStatus(), pageable);
        return ResponseEntity.ok(createRespondentAllResponse(paginatedResponse));
    }

    private RespondentAllResponse createRespondentAllResponse(Page<QuestionWiseMarks> paginatedResponse) {
        if(paginatedResponse==null) return RespondentAllResponse.builder()
                .content(new ArrayList<>())
                .last(true)
                .totalPages(0)
                .totalElements(0)
                .pageNo(0)
                .pageSize(0)
                .build();

        return RespondentAllResponse.builder()
                .content(createContentForRespondentResponse(paginatedResponse.getContent()))
                .totalPages(paginatedResponse.getTotalPages())
                .totalElements(paginatedResponse.getTotalElements())
                .last(paginatedResponse.isLast())
                .pageSize(paginatedResponse.getSize())
                .pageNo(paginatedResponse.getNumber()).build();
    }

    private List<RespondentResponseDto> createContentForRespondentResponse(List<QuestionWiseMarks> content) {
        List<RespondentResponseDto> response = new ArrayList<>();

        content.forEach(questionWise->{
            response.add(RespondentResponseDto.builder()
                    .email(questionWise.getStudentAttempt().getRegistration().getUserEmail())
                    .name(questionWise.getStudentAttempt().getRegistration().getParticipantName())
                    .response(questionWise.getResponseJson())
                    .question(questionWise.getQuestion().getTextData().getContent())
                    .questionType(questionWise.getQuestion().getQuestionType()).build());
        });

        return response;
    }
}

package vacademy.io.assessment_service.features.assessment.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.assessment_service.features.assessment.dto.AssessmentQuestionPreviewDto;
import vacademy.io.assessment_service.features.assessment.dto.survey_dto.*;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentUserRegistrationRepository;
import vacademy.io.assessment_service.features.assessment.repository.StudentAttemptRepository;
import vacademy.io.assessment_service.features.learner_assessment.entity.QuestionWiseMarks;
import vacademy.io.assessment_service.features.learner_assessment.repository.QuestionWiseMarksRepository;
import vacademy.io.assessment_service.features.learner_assessment.service.QuestionWiseMarksService;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

@Service
public class AssessmentSurveyService {

    @Autowired
    QuestionWiseMarksService questionWiseMarksService;


    @Autowired
    StudentAttemptRepository studentAttemptRepository;

    @Autowired
    AssessmentUserRegistrationRepository assessmentUserRegistrationRepository;


    public Long getTotalParticipants(String assessmentId) {
        return assessmentUserRegistrationRepository.countUserRegisteredForAssessment(assessmentId, List.of("DELETED"));
    }

    public Long getParticipantsResponded(String assessmentId) {
        return questionWiseMarksService.countUniqueRespondentForAssessment(assessmentId);
    }

    public List<SurveyDto> getSurveyListFromQuestionMapping(Assessment assessment, Map<String, List<AssessmentQuestionPreviewDto>> questionMapping) {
        List<SurveyDto> surveys = new ArrayList<>();
        // Iterate through each section → each question
        questionMapping.values().forEach(questionList -> {
            for (AssessmentQuestionPreviewDto questionPreview : questionList) {
                List<QuestionWiseMarks> allRespondentData = questionWiseMarksService.getAllQuestionWiseAttemptsForAssessmentIdAndQuestionIdAndSectionId( assessment.getId(),questionPreview.getQuestionId(), questionPreview.getSectionId());
                Object surveyDetail = QuestionBasedStrategyFactory.getSurveyDetailBasedOnType(
                        assessment,
                        questionPreview,allRespondentData
                );

                SurveyDto.SurveyDtoBuilder surveyBuilder = SurveyDto.builder()
                        .assessmentQuestionPreviewDto(questionPreview);

                // Populate based on survey type
                if (surveyDetail instanceof MCQSurveyDto) {
                    surveyBuilder.mcqSurveyDtos(Collections.singletonList((MCQSurveyDto) surveyDetail));
                } else if (surveyDetail instanceof OneWordLongSurveyDto) {
                    surveyBuilder.oneWordLongSurveyDtos(Collections.singletonList((OneWordLongSurveyDto) surveyDetail));
                } else if (surveyDetail instanceof NumberSurveyDto) {
                    surveyBuilder.numberSurveyDtos(Collections.singletonList((NumberSurveyDto) surveyDetail));
                }
                // extend here for NumberSurveyDto, RatingSurveyDto etc.

                surveys.add(surveyBuilder.build());
            }
        });

        return surveys;
    }
}

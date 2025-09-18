package vacademy.io.assessment_service.features.assessment.service.marking_strategy;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import vacademy.io.assessment_service.features.assessment.dto.AssessmentQuestionPreviewDto;
import vacademy.io.assessment_service.features.assessment.dto.Questio_type_based_dtos.mcqs.MCQSCorrectAnswerDto;
import vacademy.io.assessment_service.features.assessment.dto.Questio_type_based_dtos.mcqs.MCQSMarkingDto;
import vacademy.io.assessment_service.features.assessment.dto.Questio_type_based_dtos.mcqs.MCQSResponseDto;
import vacademy.io.assessment_service.features.assessment.dto.survey_dto.MCQSurveyDto;
import vacademy.io.assessment_service.features.assessment.dto.survey_dto.NumberSurveyDto;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.enums.QuestionResponseEnum;
import vacademy.io.assessment_service.features.assessment.service.IQuestionTypeBasedStrategy;
import vacademy.io.assessment_service.features.learner_assessment.entity.QuestionWiseMarks;
import vacademy.io.assessment_service.features.learner_assessment.service.QuestionWiseMarksService;

import java.util.*;

@Component
public class MCQSQuestionTypeBasedStrategy extends IQuestionTypeBasedStrategy {

    @Autowired
    QuestionWiseMarksService questionWiseMarksService;

    @Override
    public double calculateMarks(String markingJsonStr, String correctAnswerJsonStr, String responseJson) {
        try {
            MCQSMarkingDto markingDto = (MCQSMarkingDto) validateAndGetMarkingData(markingJsonStr);
            MCQSCorrectAnswerDto correctAnswerDto = (MCQSCorrectAnswerDto) validateAndGetCorrectAnswerData(correctAnswerJsonStr);
            MCQSResponseDto responseDto = (MCQSResponseDto) validateAndGetResponseData(responseJson);

            // Validate input objects and prevent NullPointerException
            if (correctAnswerDto == null || markingDto == null || responseDto == null) {
                setAnswerStatus(QuestionResponseEnum.PENDING.name());
                return 0.0;
            }

            // Extracting correct answer
            String correctOptionId = Optional.ofNullable(correctAnswerDto.getData())
                    .map(MCQSCorrectAnswerDto.DataFields::getCorrectOptionIds)
                    .filter(ids -> !ids.isEmpty())
                    .map(ids -> ids.get(0))  // Only one correct answer for MCQS
                    .orElse(null);

            // Extracting student's selected answer
            List<String> attemptedOptionIds = Optional.ofNullable(responseDto.getResponseData())
                    .map(MCQSResponseDto.ResponseData::getOptionIds)
                    .orElse(List.of());

            // Extract marking scheme details safely
            MCQSMarkingDto.DataFields markingData = markingDto.getData();
            if (markingData == null) {
                setAnswerStatus(QuestionResponseEnum.PENDING.name());
                return 0.0;
            }

            double totalMarks = markingData.getTotalMark();
            double negativeMarks = markingData.getNegativeMark();
            int negativePercentage = markingData.getNegativeMarkingPercentage();

            // If no answer was attempted, return 0 marks
            if (attemptedOptionIds.isEmpty()) {
                setAnswerStatus(QuestionResponseEnum.PENDING.name());
                return 0.0;
            }

            // If the selected option is correct, award full marks
            if (attemptedOptionIds.size() == 1 && attemptedOptionIds.get(0).equals(correctOptionId)) {
                setAnswerStatus(QuestionResponseEnum.CORRECT.name());
                return totalMarks;
            }

            // If an incorrect answer was selected, apply negative marking
            setAnswerStatus(QuestionResponseEnum.INCORRECT.name());
            return -1*(negativeMarks);

        } catch (Exception e) {
            return 0.0;
        }
    }


    @Override
    public Object validateAndGetMarkingData(String markingJson) throws JsonProcessingException {
        ObjectMapper objectMapper = new ObjectMapper();
        return objectMapper.readValue(markingJson, MCQSMarkingDto.class);
    }

    @Override
    public Object validateAndGetCorrectAnswerData(String correctAnswerJson) throws JsonProcessingException {
        ObjectMapper objectMapper = new ObjectMapper();
        return objectMapper.readValue(correctAnswerJson, MCQSCorrectAnswerDto.class);
    }

    @Override
    public Object validateAndGetResponseData(String responseJson) throws JsonProcessingException {
        ObjectMapper objectMapper = new ObjectMapper();
        return objectMapper.readValue(responseJson, MCQSResponseDto.class);
    }

    @Override
    public Object validateAndGetSurveyData(Assessment assessment, AssessmentQuestionPreviewDto assessmentQuestionPreviewDto) {
        setType(assessmentQuestionPreviewDto.getQuestion().getType());
        List<QuestionWiseMarks> allRespondentData = questionWiseMarksService.getAllQuestionWiseAttemptsForAssessmentIdAndQuestionIdAndSectionId(assessmentQuestionPreviewDto.getQuestionId(), assessment.getId(), assessmentQuestionPreviewDto.getSectionId());

        return MCQSurveyDto.builder()
                .type(getType())
                .totalRespondent(allRespondentData.size())
                .order(assessmentQuestionPreviewDto.getQuestionOrder())
                .mcqSurveyInfoList(createMCQSSurveyInfo(allRespondentData)).build();
    }

    private List<MCQSurveyDto.MCQSurveyInfo> createMCQSSurveyInfo(List<QuestionWiseMarks> allRespondentData) {
        List<MCQSurveyDto.MCQSurveyInfo> response = new ArrayList<>();
        Map<String, Integer> answerCountMapping = new HashMap<>();

        allRespondentData.forEach(questionWiseResponse -> {
            String answer = extractValidAnswerForMCQS(questionWiseResponse.getResponseJson());
            answerCountMapping.merge(Objects.requireNonNullElse(answer, "NO_ANSWER"), 1, Integer::sum);
        });

        // Convert map into MCQSurveyInfo list
        answerCountMapping.forEach((answer, count) -> {
            double percentage = (count * 100.0) / allRespondentData.size(); // force double division
            MCQSurveyDto.MCQSurveyInfo info = MCQSurveyDto.MCQSurveyInfo.builder()
                    .option(String.valueOf(answer))   // ensure option is String if needed
                    .percentage(percentage)
                    .respondentCount(count)
                    .build();
            response.add(info);
        });

        return response;
    }

    private String extractValidAnswerForMCQS(String responseJson) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            JsonNode root = mapper.readTree(responseJson);

            // Navigate to responseData → optionIds[0]
            JsonNode optionIdsNode = root.path("responseData").path("optionIds");

            if (optionIdsNode.isArray() && !optionIdsNode.isEmpty()) {
                return optionIdsNode.get(0).asText(); // since MCQS has only one option
            }
        } catch (Exception e) {
            // Log error and skip invalid response
            e.printStackTrace();
        }
        return null; // in case of invalid/empty response
    }

}

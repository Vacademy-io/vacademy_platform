package vacademy.io.assessment_service.features.assessment.service.marking_strategy;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.assessment_service.features.assessment.dto.Questio_type_based_dtos.mcqm.MCQMCorrectAnswerDto;
import vacademy.io.assessment_service.features.assessment.dto.Questio_type_based_dtos.mcqm.MCQMMarkingDto;
import vacademy.io.assessment_service.features.assessment.dto.Questio_type_based_dtos.mcqm.MCQMResponseDto;
import vacademy.io.assessment_service.features.assessment.enums.QuestionResponseEnum;
import vacademy.io.assessment_service.features.assessment.service.IQuestionTypeBasedStrategy;

import java.util.List;
import java.util.Optional;

@Slf4j
@Component
public class MCQMQuestionTypeBasedStrategy extends IQuestionTypeBasedStrategy {

    @Override
    public double calculateMarks(String markingJsonStr, String correctAnswerJsonStr, String responseJson) {
        try {
            MCQMMarkingDto markingDto = (MCQMMarkingDto) validateAndGetMarkingData(markingJsonStr);
            MCQMCorrectAnswerDto correctAnswerDto = (MCQMCorrectAnswerDto) validateAndGetCorrectAnswerData(correctAnswerJsonStr);
            MCQMResponseDto responseDto = (MCQMResponseDto) validateAndGetResponseData(responseJson);

            // Validate input objects and avoid NullPointerException
            if (correctAnswerDto == null || markingDto == null || responseDto == null) {
                setAnswerStatus(QuestionResponseEnum.INCORRECT.name());
                return 0.0;
            }

            // Extracting correct option IDs
            List<String> correctOptionIds = Optional.ofNullable(correctAnswerDto.getData())
                    .map(MCQMCorrectAnswerDto.DataFields::getCorrectOptionIds)
                    .orElse(List.of());

            // Extracting student response
            List<String> attemptedOptionIds = Optional.ofNullable(responseDto.getResponseData())
                    .map(MCQMResponseDto.ResponseData::getOptionIds)
                    .orElse(List.of());

            // Extract marking scheme details safely
            MCQMMarkingDto.DataFields markingData = markingDto.getData();
            if (markingData == null) {
                setAnswerStatus(QuestionResponseEnum.INCORRECT.name());
                return 0.0;
            }

            double totalMarks = markingData.getTotalMark();
            double negativeMarks = markingData.getNegativeMark();
            int negativePercentage = markingData.getNegativeMarkingPercentage();
            int partialMarking = markingData.getPartialMarking();
            int partialMarkingPercentage = markingData.getPartialMarkingPercentage();

            // If the student did not attempt the question, return 0 marks
            if (attemptedOptionIds.isEmpty()) {
                setAnswerStatus(QuestionResponseEnum.INCORRECT.name());
                return 0.0;
            }

            // Check if the answer is completely correct
            if (attemptedOptionIds.equals(correctOptionIds)) {
                setAnswerStatus(QuestionResponseEnum.CORRECT.name());
                return totalMarks;
            }

            // Partial marking scenario
            long correctSelected = attemptedOptionIds.stream().filter(correctOptionIds::contains).count();
            long incorrectSelected = attemptedOptionIds.size() - correctSelected;

            if (partialMarking == 1 && correctSelected > 0) {
                double partialMarks = (totalMarks * partialMarkingPercentage) / 100.0;
                double finalMarks = partialMarks - (incorrectSelected * (negativeMarks * negativePercentage) / 100.0);
                setAnswerStatus(QuestionResponseEnum.PARTIAL_CORRECT.name());
                return finalMarks;
            }

            // If incorrect response, apply negative marking
            setAnswerStatus(QuestionResponseEnum.INCORRECT.name());
            return -((incorrectSelected * negativeMarks * negativePercentage) / 100.0);

        } catch (Exception e) {
            log.error("Error Occurred: " + e.getMessage());
            return 0.0;
        }
    }


    @Override
    public Object validateAndGetMarkingData(String markingJson) throws JsonProcessingException {
        ObjectMapper objectMapper = new ObjectMapper();
        return objectMapper.readValue(markingJson, MCQMMarkingDto.class);
    }

    @Override
    public Object validateAndGetCorrectAnswerData(String correctAnswerJson) throws JsonProcessingException {
        ObjectMapper objectMapper = new ObjectMapper();
        return objectMapper.readValue(correctAnswerJson, MCQMCorrectAnswerDto.class);
    }

    @Override
    public Object validateAndGetResponseData(String responseJson) throws JsonProcessingException {
        ObjectMapper objectMapper = new ObjectMapper();
        return objectMapper.readValue(responseJson, MCQMResponseDto.class);
    }
}

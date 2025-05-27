package vacademy.io.assessment_service.features.assessment.service.marking_strategy;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import vacademy.io.assessment_service.features.assessment.dto.Questio_type_based_dtos.numeric.NUMERICCorrectAnswerDto;
import vacademy.io.assessment_service.features.assessment.dto.Questio_type_based_dtos.numeric.NUMERICMarkingDto;
import vacademy.io.assessment_service.features.assessment.dto.Questio_type_based_dtos.numeric.NUMERICResponseDto;
import vacademy.io.assessment_service.features.assessment.enums.QuestionResponseEnum;
import vacademy.io.assessment_service.features.assessment.service.IQuestionTypeBasedStrategy;

import java.util.List;

@Component
public class NUMERICQuestionTypeBasedStrategy extends IQuestionTypeBasedStrategy {


    @Override
    public double calculateMarks(String markingJsonStr, String correctAnswerJsonStr, String responseJson) {
        try {
            NUMERICMarkingDto markingDto = (NUMERICMarkingDto) validateAndGetMarkingData(markingJsonStr);
            NUMERICCorrectAnswerDto correctAnswerDto = (NUMERICCorrectAnswerDto) validateAndGetCorrectAnswerData(correctAnswerJsonStr);
            NUMERICResponseDto responseDto = (NUMERICResponseDto) validateAndGetResponseData(responseJson);

            // Validate input objects and prevent NullPointerException
            if (correctAnswerDto == null || markingDto == null || responseDto == null) {
                setAnswerStatus(QuestionResponseEnum.PENDING.name());
                return 0.0;
            }

            // Extracting correct answer
            List<Double> validAnswers = correctAnswerDto.getData().getValidAnswers();

            // Extracting student's selected answer
            Double attemptedAnswer = responseDto.getResponseData().getValidAnswer();

            // Extract marking scheme details safely
            NUMERICMarkingDto.DataFields markingData = markingDto.getData();
            if (markingData == null) {
                setAnswerStatus(QuestionResponseEnum.PENDING.name());
                return 0.0;
            }

            double totalMarks = markingData.getTotalMark();
            double negativeMarks = markingData.getNegativeMark();
            int negativePercentage = markingData.getNegativeMarkingPercentage();

            // If no answer was attempted, return 0 marks
            if (attemptedAnswer == null) {
                setAnswerStatus(QuestionResponseEnum.PENDING.name());
                return 0.0;
            }

            // If the selected option is correct, award full marks
            if (validAnswers.contains(attemptedAnswer)) {
                setAnswerStatus(QuestionResponseEnum.CORRECT.name());
                return totalMarks;
            }

            // If an incorrect answer was selected, apply negative marking
            setAnswerStatus(QuestionResponseEnum.INCORRECT.name());
            return -(negativeMarks * negativePercentage / 100.0);

        } catch (Exception e) {
            return 0.0;
        }
    }


    @Override
    public Object validateAndGetMarkingData(String markingJson) throws JsonProcessingException {
        ObjectMapper objectMapper = new ObjectMapper();
        return objectMapper.readValue(markingJson, NUMERICMarkingDto.class);
    }

    @Override
    public Object validateAndGetCorrectAnswerData(String correctAnswerJson) throws JsonProcessingException {
        ObjectMapper objectMapper = new ObjectMapper();
        return objectMapper.readValue(correctAnswerJson, NUMERICCorrectAnswerDto.class);
    }

    @Override
    public Object validateAndGetResponseData(String responseJson) throws JsonProcessingException {
        ObjectMapper objectMapper = new ObjectMapper();
        return objectMapper.readValue(responseJson, NUMERICResponseDto.class);
    }
}

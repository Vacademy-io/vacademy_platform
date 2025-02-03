package vacademy.io.assessment_service.features.assessment.service.marking_strategy;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import vacademy.io.assessment_service.features.assessment.dto.Questio_type_based_dtos.mcqs.MCQSCorrectAnswerDto;
import vacademy.io.assessment_service.features.assessment.dto.Questio_type_based_dtos.mcqs.MCQSMarkingDto;
import vacademy.io.assessment_service.features.assessment.dto.Questio_type_based_dtos.mcqs.MCQSResponseDto;
import vacademy.io.assessment_service.features.assessment.service.IQuestionTypeBasedStrategy;

import java.util.List;
import java.util.Optional;

@Component
public class MCQSQuestionTypeBasedStrategy extends IQuestionTypeBasedStrategy {


    @Override
    public double calculateMarks(String markingJsonStr, String correctAnswerJsonStr, String responseJson){
        try{
            MCQSMarkingDto markingDto = (MCQSMarkingDto) validateAndGetMarkingData(markingJsonStr);
            MCQSCorrectAnswerDto correctAnswerDto = (MCQSCorrectAnswerDto) validateAndGetCorrectAnswerData(correctAnswerJsonStr);
            MCQSResponseDto responseDto = (MCQSResponseDto) validateAndGetResponseData(responseJson);


            // Validate input objects and prevent NullPointerException
            if (correctAnswerDto == null || markingDto == null || responseDto == null) {
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
                return 0.0;
            }

            double totalMarks = markingData.getTotalMark();
            double negativeMarks = markingData.getNegativeMark();
            int negativePercentage = markingData.getNegativeMarkingPercentage();

            // If no answer was attempted, return 0 marks
            if (attemptedOptionIds.isEmpty()) {
                return 0.0;
            }

            // If the selected option is correct, award full marks
            if (attemptedOptionIds.size() == 1 && attemptedOptionIds.get(0).equals(correctOptionId)) {
                return totalMarks;
            }

            // If an incorrect answer was selected, apply negative marking
            return -(negativeMarks * negativePercentage / 100.0);
        }
        catch (Exception e){
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
}

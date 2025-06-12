package vacademy.io.assessment_service.features.assessment.service.marking_strategy;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.util.Pair;
import org.springframework.stereotype.Component;
import vacademy.io.assessment_service.features.assessment.dto.Questio_type_based_dtos.long_answer.LongAanswerCorrectAnswerDto;
import vacademy.io.assessment_service.features.assessment.dto.Questio_type_based_dtos.long_answer.LongAnswerMarkingDto;
import vacademy.io.assessment_service.features.assessment.dto.Questio_type_based_dtos.long_answer.LongAnswerResponseDto;
import vacademy.io.assessment_service.features.assessment.enums.QuestionResponseEnum;
import vacademy.io.assessment_service.features.assessment.service.IQuestionTypeBasedStrategy;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

@Slf4j
@Component
public class LongAnswerQuestionTypeBasedStrategy extends IQuestionTypeBasedStrategy {
    public static Pair<Double, String> calculateMarksViaMatching(String correctAnswer, String studentAnswer, double totalMarks, double negativeMarks) {
        // Convert answers to sets of words (ignore case & split by spaces)
        Set<String> correctWords = new HashSet<>(Arrays.asList(correctAnswer.toLowerCase().split("\\s+")));
        Set<String> studentWords = new HashSet<>(Arrays.asList(studentAnswer.toLowerCase().split("\\s+")));

        // Compute Jaccard Similarity
        Set<String> intersection = new HashSet<>(correctWords);
        intersection.retainAll(studentWords);

        Set<String> union = new HashSet<>(correctWords);
        union.addAll(studentWords);

        double similarity = (double) intersection.size() / union.size();
        // Determine marks based on similarity
        if (similarity >= 0.8) {

            return Pair.of(totalMarks, QuestionResponseEnum.CORRECT.name()); // Full marks for high similarity
        } else if (similarity >= 0.5) {
            return Pair.of(totalMarks*0.5, QuestionResponseEnum.CORRECT.name()); // 50% marks for moderate similarity
        } else {
            return Pair.of(-negativeMarks, QuestionResponseEnum.INCORRECT.name());
        }
    }

    @Override
    public double calculateMarks(String markingJsonStr, String correctAnswerJsonStr, String responseJson) {
        try {
            LongAnswerMarkingDto markingDto = (LongAnswerMarkingDto) validateAndGetMarkingData(markingJsonStr);
            LongAanswerCorrectAnswerDto correctAnswerDto = (LongAanswerCorrectAnswerDto) validateAndGetCorrectAnswerData(correctAnswerJsonStr);
            LongAnswerResponseDto responseDto = (LongAnswerResponseDto) validateAndGetResponseData(responseJson);

            // Validate input objects and avoid NullPointerException
            if (correctAnswerDto == null || markingDto == null || responseDto == null) {
                setAnswerStatus(QuestionResponseEnum.PENDING.name());
                return 0.0;
            }
            if (responseDto.getResponseData().getAnswer() == null) {
                setAnswerStatus(QuestionResponseEnum.PENDING.name());
                return 0.0;
            }

            // Extracting correct option IDs
            String correctAnswer = correctAnswerDto.getData().getAnswer().getContent().toLowerCase();

            // Extracting student response
            String attemptedAnswer = responseDto.getResponseData().getAnswer().toLowerCase();

            // Extract marking scheme details safely
            LongAnswerMarkingDto.DataFields markingData = markingDto.getData();
            if (markingData == null) {
                setAnswerStatus(QuestionResponseEnum.PENDING.name());
                return 0.0;
            }

            double totalMarks = markingData.getTotalMark();
            double negativeMarks = markingData.getNegativeMark();

            // If the student did not attempt the question, return 0 marks
            if (attemptedAnswer.isEmpty()) {
                setAnswerStatus(QuestionResponseEnum.PENDING.name());
                return 0.0;
            }
            Pair<Double, String> marksStatusMap = calculateMarksViaMatching(attemptedAnswer, correctAnswer, totalMarks, negativeMarks);
            if(marksStatusMap == null){
                setAnswerStatus(QuestionResponseEnum.PENDING.name());
                return 0.0;
            }
            else{
                setAnswerStatus(marksStatusMap.getSecond());
                return marksStatusMap.getFirst();
            }


        } catch (Exception e) {
            log.error("Error Occurred: " + e.getMessage());
            return 0.0;
        }
    }

    @Override
    public Object validateAndGetMarkingData(String markingJson) throws JsonProcessingException {
        ObjectMapper objectMapper = new ObjectMapper();
        return objectMapper.readValue(markingJson, LongAnswerMarkingDto.class);
    }

    @Override
    public Object validateAndGetCorrectAnswerData(String correctAnswerJson) throws JsonProcessingException {
        ObjectMapper objectMapper = new ObjectMapper();
        return objectMapper.readValue(correctAnswerJson, LongAanswerCorrectAnswerDto.class);
    }

    @Override
    public Object validateAndGetResponseData(String responseJson) throws JsonProcessingException {
        ObjectMapper objectMapper = new ObjectMapper();
        return objectMapper.readValue(responseJson, LongAnswerResponseDto.class);
    }
}

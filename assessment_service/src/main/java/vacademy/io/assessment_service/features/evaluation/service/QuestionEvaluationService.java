package vacademy.io.assessment_service.features.evaluation.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.assessment_service.features.question_core.dto.LongAnswerEvaluationDTO;
import vacademy.io.assessment_service.features.question_core.dto.MCQEvaluationDTO;
import vacademy.io.assessment_service.features.question_core.dto.NumericalEvaluationDto;
import vacademy.io.assessment_service.features.question_core.dto.OneWordEvaluationDTO;

@Service
public class QuestionEvaluationService {

    @Autowired
    private ObjectMapper objectMapper; // For JSON serialization/deserialization

    // Method to set evaluation JSON based on question type
    public String setEvaluationJson(MCQEvaluationDTO mcqEvaluationDTO) throws JsonProcessingException {
        // Convert DTO to JSON string
        String jsonString = objectMapper.writeValueAsString(mcqEvaluationDTO);

        // Here you would save jsonString to your database (not shown)
        // For example: question.setAutoEvaluationJson(jsonString);

        return jsonString; // Return the JSON string for confirmation or further processing
    }
    public String setEvaluationJson(NumericalEvaluationDto numericalEvaluation) throws JsonProcessingException {
        // Convert DTO to JSON string
        String jsonString = objectMapper.writeValueAsString(numericalEvaluation);

        // Here you would save jsonString to your database (not shown)
        // For example: question.setAutoEvaluationJson(jsonString);

        return jsonString; // Return the JSON string for confirmation or further processing
    }
    public String setEvaluationJson(OneWordEvaluationDTO oneWordEvaluationDTO) throws JsonProcessingException {
        // Convert DTO to JSON string
        String jsonString = objectMapper.writeValueAsString(oneWordEvaluationDTO);

        // Here you would save jsonString to your database (not shown)
        // For example: question.setAutoEvaluationJson(jsonString);

        return jsonString; // Return the JSON string for confirmation or further processing
    }

    public String setEvaluationJson(LongAnswerEvaluationDTO longAnswerEvaluationDTO) throws JsonProcessingException {
        // Convert DTO to JSON string
        String jsonString = objectMapper.writeValueAsString(longAnswerEvaluationDTO);

        // Here you would save jsonString to your database (not shown)
        // For example: question.setAutoEvaluationJson(jsonString);

        return jsonString; // Return the JSON string for confirmation or further processing
    }

    // Method to get evaluation JSON as DTO based on question type
    public Object getEvaluationJson(String jsonString, Class<?> clazz) throws JsonProcessingException {
        return objectMapper.readValue(jsonString, clazz);
    }


}

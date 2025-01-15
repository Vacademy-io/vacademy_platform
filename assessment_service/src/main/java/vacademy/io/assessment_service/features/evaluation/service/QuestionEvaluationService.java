package vacademy.io.assessment_service.features.evaluation.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.assessment_service.features.question_core.dto.MCQEvaluationDTO;

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

    // Method to get evaluation JSON as DTO based on question type
    public MCQEvaluationDTO getEvaluationJson(String jsonString) throws JsonProcessingException {
        // Deserialize JSON string to DTO
        return objectMapper.readValue(jsonString, MCQEvaluationDTO.class);
    }
}

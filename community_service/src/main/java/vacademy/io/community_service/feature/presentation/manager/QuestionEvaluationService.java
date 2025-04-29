package vacademy.io.community_service.feature.presentation.manager;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.community_service.feature.presentation.dto.question.LongAnswerEvaluationDTO;
import vacademy.io.community_service.feature.presentation.dto.question.MCQEvaluationDTO;
import vacademy.io.community_service.feature.presentation.dto.question.NumericalEvaluationDto;
import vacademy.io.community_service.feature.presentation.dto.question.OneWordEvaluationDTO;


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

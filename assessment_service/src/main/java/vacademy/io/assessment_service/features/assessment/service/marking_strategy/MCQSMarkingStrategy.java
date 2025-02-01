package vacademy.io.assessment_service.features.assessment.service.marking_strategy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import vacademy.io.assessment_service.features.assessment.service.IMarkingStrategy;
import vacademy.io.assessment_service.features.question_core.enums.QuestionTypes;

import java.util.List;

@Component
public class MCQSMarkingStrategy extends IMarkingStrategy {


    @Override
    public double calculateMarks(String markingJsonStr, String correctAnswerJsonStr, List<String> studentChosenOptions) throws Exception {
        this.setType(QuestionTypes.MCQS.name());
        ObjectMapper objectMapper = new ObjectMapper();
        JsonNode markingJson = objectMapper.readTree(markingJsonStr).get("data");
        JsonNode correctAnswerJson = objectMapper.readTree(correctAnswerJsonStr).get("data");

        double totalMark = markingJson.get("totalMark").asDouble();
        double negativeMark = markingJson.get("negativeMark").asDouble();

        String correctOption = correctAnswerJson.get("correctOptionIds").get(0).asText();
        String studentOption = studentChosenOptions.isEmpty() ? "" : studentChosenOptions.get(0);

        return correctOption.equals(studentOption) ? totalMark : -negativeMark;
    }
}

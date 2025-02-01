package vacademy.io.assessment_service.features.assessment.service.marking_strategy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.assessment_service.features.assessment.service.IMarkingStrategy;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Component
public class MCQMMarkingStrategy extends IMarkingStrategy {

    @Override
    public double calculateMarks(String markingJsonStr, String correctAnswerJsonStr, List<String> studentChosenOptions) throws Exception {
        this.setType("MCQM");

        ObjectMapper objectMapper = new ObjectMapper();
        JsonNode markingJson = objectMapper.readTree(markingJsonStr).get("data");

        double totalMark = markingJson.get("totalMark").asDouble();
        double negativeMark = markingJson.get("negativeMark").asDouble();
        boolean partialMarking = markingJson.get("partialMarking").asBoolean();
        double partialPercentage = markingJson.get("partialMarkingPercentage").asDouble();


        Set<String> studentOptions = new HashSet<>(studentChosenOptions);

        JsonNode rootNode = objectMapper.readTree(correctAnswerJsonStr);

        // Extract correctOptionIds as a Set<String>
        Set<String> correctOptionIds = new HashSet<>();
        JsonNode correctOptionsNode = rootNode.path("data").path("correctOptionIds");

        if (correctOptionsNode.isArray()) {
            for (JsonNode node : correctOptionsNode) {
                correctOptionIds.add(node.asText());
            }
        }

        if (studentOptions.equals(correctOptionIds)) {
            return totalMark;
        } else if (!correctOptionIds.containsAll(studentOptions)) {
            return -negativeMark;
        } else if (partialMarking) {
            long correctChosen = studentOptions.stream().filter(correctOptionIds::contains).count();
            return (correctChosen / (double) correctOptionIds.size()) * (totalMark * (partialPercentage / 100));
        }

        return 0;
    }
}

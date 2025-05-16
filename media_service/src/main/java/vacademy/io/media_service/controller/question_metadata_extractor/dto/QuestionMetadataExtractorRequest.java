package vacademy.io.media_service.controller.question_metadata_extractor.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

import java.util.HashMap;
import java.util.Map;

@Getter
@Setter
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class QuestionMetadataExtractorRequest {
    Map<String , String> idAndTopics = new HashMap<>();
    Map<String, String> previewIdAndQuestionText = new HashMap<>();
}

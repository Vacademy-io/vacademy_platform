package vacademy.io.media_service.controller.question_metadata_extractor.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class QuestionMetadataExtractorResponse {
    private List<QuestionMetadata> questions;

    @Getter
    @Setter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class QuestionMetadata {
        private String question_id;  // Changed from map structure
        private List<String> topic_ids;
        private List<String> tags;
        private String difficulty;  // New field
        private String problem_type; // New field
    }
}

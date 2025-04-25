package vacademy.io.media_service.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;

import java.util.List;
import java.util.Map;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@ToString
@JsonIgnoreProperties(ignoreUnknown = true)
public class AutoQuestionPaperResponse {
    private List<QuestionDTO> questions;
    private String title;
    private List<String> tags;
    private String difficulty;
    private String description;
    private List<String> subjects;
    private List<String> classes;
    private TopicNumberMapDto topicQuestionMap;
}

package vacademy.io.media_service.dto;


import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AiGeneratedQuestionPaperJsonDto {
    private String title;
    private AiGeneratedQuestionJsonDto[] questions;
    private List<String> tags;
    private String difficulty;
    private String description;
    private List<String> subjects;
    private List<String> classes;
}

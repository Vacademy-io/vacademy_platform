package vacademy.io.media_service.dto;


import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AiGeneratedQuestionPaperJsonDto {
    private String title;
    private AiGeneratedQuestisonJsonDto[] questions;
}

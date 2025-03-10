package vacademy.io.media_service.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class AssessmentRichTextDataDTO {

    private String id;
    private String type;
    private String content;

    // Default constructor
    public AssessmentRichTextDataDTO() {
    }

    public void appendContent(String s) {
        String updatedHtml = (this.getContent() == null) ? "" : this.getContent() + s;
        this.content = updatedHtml;
    }

    // Parameterized constructor
    public AssessmentRichTextDataDTO(String id, String type, String content) {
        this.id = id;
        this.type = type;
        this.content = content;
    }
}

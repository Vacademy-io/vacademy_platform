package vacademy.io.community_service.feature.filter.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;
import vacademy.io.community_service.feature.filter.entity.AssessmentRichTextData;

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

    // Parameterized constructor
    public AssessmentRichTextDataDTO(String id, String type, String content) {
        this.id = id;
        this.type = type;
        this.content = content;
    }

    public AssessmentRichTextDataDTO(AssessmentRichTextData data) {
        if (data == null) return;
        this.id = data.getId();
        this.type = data.getType();
        this.content = data.getContent();
    }
}

package vacademy.io.media_service.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
@AllArgsConstructor
public class OptionDTO {

    private String id;
    private String previewId;
    private String questionId; // To reference back to the question
    private AssessmentRichTextDataDTO text;
    private String mediaId;
    private Integer optionOrder;
    private String createdOn; // Consider using LocalDateTime for better date handling
    private String updatedOn; // Consider using LocalDateTime for better date handling
    private AssessmentRichTextDataDTO explanationText;

    // Default constructor
    public OptionDTO() {
    }

    public OptionDTO(String previewId, AssessmentRichTextDataDTO text) {
        this.previewId = previewId;
        this.text = text;
    }


}

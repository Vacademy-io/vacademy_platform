package vacademy.io.community_service.feature.filter.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;
import vacademy.io.community_service.feature.presentation.entity.question.Option;

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

    // Constructor from entity
    public OptionDTO(Option option) {
        this.id = option.getId();
        this.questionId = option.getQuestion() != null ? option.getQuestion().getId() : null; // Get question ID if available
        this.text = new AssessmentRichTextDataDTO(option.getText());
        this.mediaId = option.getMediaId();
        this.createdOn = option.getCreatedOn() != null ? option.getCreatedOn().toString() : null; // Convert Timestamp to String
        this.updatedOn = option.getUpdatedOn() != null ? option.getUpdatedOn().toString() : null; // Convert Timestamp to String
        this.explanationText = new AssessmentRichTextDataDTO(option.getExplanationTextData());
    }
}

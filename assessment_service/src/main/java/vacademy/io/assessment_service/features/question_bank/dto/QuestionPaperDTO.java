package vacademy.io.assessment_service.features.question_bank.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;
import vacademy.io.assessment_service.features.question_bank.entity.QuestionPaper;
import vacademy.io.assessment_service.features.rich_text.dto.AssessmentRichTextDataDTO;

@Getter
@Setter
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class QuestionPaperDTO {

    private String id;
    private String title;
    private String status;
    private AssessmentRichTextDataDTO description;
    private String createdOn; // Consider using LocalDateTime for better date handling
    private String updatedOn; // Consider using LocalDateTime for better date handling
    private String createdByUserId;

    // Constructor from entity
    public QuestionPaperDTO(QuestionPaper questionPaper) {
        this.id = questionPaper.getId();
        this.title = questionPaper.getTitle();
        this.description = new AssessmentRichTextDataDTO(questionPaper.getDescription());
        this.createdOn = questionPaper.getCreatedOn() != null ? questionPaper.getCreatedOn().toString() : null;
        this.updatedOn = questionPaper.getUpdatedOn() != null ? questionPaper.getUpdatedOn().toString() : null;
        this.createdByUserId = questionPaper.getCreatedByUserId();
    }
}

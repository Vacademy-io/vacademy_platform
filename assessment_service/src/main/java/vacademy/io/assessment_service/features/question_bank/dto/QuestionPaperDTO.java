package vacademy.io.assessment_service.features.question_bank.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;
import vacademy.io.assessment_service.features.question_bank.entity.QuestionPaper;
import vacademy.io.assessment_service.features.rich_text.dto.AssessmentRichTextDataDTO;

import java.util.Date;

@Getter
@Setter
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class QuestionPaperDTO {

    private String id;
    private String title;
    private String status;
    private String levelId;
    private String subjectId;
    private AssessmentRichTextDataDTO description;
    private Date createdOn; // Consider using LocalDateTime for better date handling
    private Date updatedOn; // Consider using LocalDateTime for better date handling
    private String createdByUserId;

    // Constructor from entity
    public QuestionPaperDTO(QuestionPaper questionPaper) {
        this.id = questionPaper.getId();
        this.title = questionPaper.getTitle();
        this.description = new AssessmentRichTextDataDTO(questionPaper.getDescription());
        this.createdOn = questionPaper.getCreatedOn() != null ? questionPaper.getCreatedOn() : null;
        this.updatedOn = questionPaper.getUpdatedOn() != null ? questionPaper.getUpdatedOn() : null;
        this.createdByUserId = questionPaper.getCreatedByUserId();
    }

    public QuestionPaperDTO(String id, String title, String status, String levelId, String subjectId, Date createdOn,
                            Date updatedOn, String createdByUserId) {
        this.id = id;
        this.title = title;
        this.status = status;
        this.levelId = levelId;
        this.subjectId = subjectId;
        this.createdOn = createdOn;
        this.updatedOn = updatedOn;
        this.createdByUserId = createdByUserId;
    }
}

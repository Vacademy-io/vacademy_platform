package vacademy.io.community_service.feature.presentation.entity.question;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.community_service.feature.presentation.dto.question.QuestionDTO;
import vacademy.io.community_service.feature.rich_text.entity.AssessmentRichTextData;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "question")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class Question {

    @Id
    @Column(name = "id", nullable = false)
    @UuidGenerator
    private String id;

    @Column(name = "media_id")
    private String mediaId;

    // One-to-One mapping with AssessmentRichTextData for parent_rich_text_id
    @OneToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "parent_rich_text_id", referencedColumnName = "id", insertable = true, updatable = true)
    private AssessmentRichTextData parentRichText;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;

    @Column(name = "question_response_type", nullable = false)
    private String questionResponseType;

    @Column(name = "question_type", nullable = false)
    private String questionType;

    @Column(name = "access_level", nullable = false)
    private String accessLevel;

    @Column(name = "auto_evaluation_json")
    private String autoEvaluationJson;

    @Column(name = "options_json")
    private String optionsJson;

    @Column(name = "evaluation_type")
    private String evaluationType;

    @Column(name = "status")
    private String status;

    @Column(name = "default_question_time_mins")
    private Integer defaultQuestionTimeMins;

    // One-to-One mapping with AssessmentRichTextData for text_id
    @OneToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "text_id", referencedColumnName = "id", insertable = true, updatable = true)
    private AssessmentRichTextData textData;

    // One-to-One mapping with AssessmentRichTextData for explanation_text_id
    @OneToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "explanation_text_id", referencedColumnName = "id", insertable = true, updatable = true)
    private AssessmentRichTextData explanationTextData;

    @OneToMany(mappedBy = "question", fetch = FetchType.LAZY)
    private List<Option> options = new ArrayList<>();


    public Question(QuestionDTO questionDTO) {
        this.id = questionDTO.getId();
        this.mediaId = questionDTO.getMediaId();
        this.createdAt = (Timestamp) questionDTO.getCreatedAt();
        this.updatedAt = (Timestamp) questionDTO.getUpdatedAt();
        this.questionResponseType = questionDTO.getQuestionResponseType();
        this.questionType = questionDTO.getQuestionType();
        this.accessLevel = questionDTO.getAccessLevel();
        this.autoEvaluationJson = questionDTO.getAutoEvaluationJson();
        this.evaluationType = questionDTO.getEvaluationType();
        this.defaultQuestionTimeMins = questionDTO.getDefaultQuestionTimeMins();
        this.textData = AssessmentRichTextData.fromDTO(questionDTO.getText());
        this.explanationTextData = AssessmentRichTextData.fromDTO(questionDTO.getExplanationText());
        this.parentRichText = AssessmentRichTextData.fromDTO(questionDTO.getParentRichText());
        this.optionsJson = questionDTO.getOptionsJson();
    }

    public Question(String id) {
        this.id = id;
    }
}

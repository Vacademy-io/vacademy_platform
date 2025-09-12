package vacademy.io.admin_core_service.features.slide.entity;

import jakarta.persistence.*;
import lombok.*;
import vacademy.io.admin_core_service.features.common.entity.RichTextData;
import vacademy.io.admin_core_service.features.slide.dto.QuizSlideQuestionDTO;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Entity
@Table(name = "quiz_slide_question")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class QuizSlideQuestion {

    @Id
    private String id;

    @OneToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "parent_rich_text_id", referencedColumnName = "id")
    private RichTextData parentRichText;

    @OneToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "text_id", referencedColumnName = "id")
    private RichTextData text;

    @OneToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "explanation_text_id", referencedColumnName = "id")
    private RichTextData explanationText;

    private String mediaId;

    private String status;

    @Column(name = "question_response_type", nullable = false)
    private String questionResponseType;

    @Column(name = "question_type", nullable = false)
    private String questionType;

    @Column(name = "access_level", nullable = false)
    private String accessLevel;

    @Column(name = "auto_evaluation_json", columnDefinition = "text")
    private String autoEvaluationJson;

    @Column(name = "evaluation_type")
    private String evaluationType;

    @Column(name = "question_order")
    private Integer questionOrder;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "quiz_slide_id")
    private QuizSlide quizSlide;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "can_skip")
    private Boolean canSkip = true;

    @OneToMany(mappedBy = "quizSlideQuestion", cascade = CascadeType.ALL)
    private List<QuizSlideQuestionOption> quizSlideQuestionOptions;

    public QuizSlideQuestion(QuizSlideQuestionDTO dto, QuizSlide quizSlide) {
        this.id = dto.getId();

        if (dto.getParentRichText() != null) {
            this.parentRichText = new RichTextData(dto.getParentRichText());
        }

        if (dto.getText() != null) {
            this.text = new RichTextData(dto.getText());
        }

        if (dto.getExplanationText() != null) {
            this.explanationText = new RichTextData(dto.getExplanationText());
        }

        this.mediaId = dto.getMediaId();
        this.status = dto.getStatus();
        this.questionResponseType = dto.getQuestionResponseType();
        this.questionType = dto.getQuestionType();
        this.accessLevel = dto.getAccessLevel();
        this.autoEvaluationJson = dto.getAutoEvaluationJson();
        this.evaluationType = dto.getEvaluationType();
        this.questionOrder = dto.getQuestionOrder();
        this.canSkip = dto.getCanSkip();
        this.quizSlide = quizSlide;

        if (dto.getOptions() != null && !dto.getOptions().isEmpty()) {
            this.quizSlideQuestionOptions = dto.getOptions().stream()
                    .map(o -> new QuizSlideQuestionOption(o, this))
                    .collect(Collectors.toList());
        }
    }
}

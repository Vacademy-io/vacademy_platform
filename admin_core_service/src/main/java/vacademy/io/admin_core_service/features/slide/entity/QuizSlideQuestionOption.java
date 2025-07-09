package vacademy.io.admin_core_service.features.slide.entity;

import jakarta.persistence.*;
import lombok.*;
import vacademy.io.admin_core_service.features.common.entity.RichTextData;
import vacademy.io.admin_core_service.features.slide.dto.QuizSlideQuestionOptionDTO;

import java.time.LocalDateTime;

@Entity
@Table(name = "quiz_slide_question_options")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class QuizSlideQuestionOption {

    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "quiz_slide_question_id", nullable = false)
    private QuizSlideQuestion quizSlideQuestion;

    @OneToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "text_id", referencedColumnName = "id")
    private RichTextData text;

    @OneToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "explanation_text_id", referencedColumnName = "id")
    private RichTextData explanationText;

    private String mediaId;

    @Column(name = "created_on")
    private LocalDateTime createdOn;

    @Column(name = "updated_on")
    private LocalDateTime updatedOn;

    public QuizSlideQuestionOption(QuizSlideQuestionOptionDTO dto, QuizSlideQuestion quizSlideQuestion) {
        this.id = dto.getId();
        if (dto.getText() != null) {
            this.text = new RichTextData(dto.getText());
        }
        if (dto.getExplanationText() != null) {
            this.explanationText = new RichTextData(dto.getExplanationText());
        }
        this.mediaId = dto.getMediaId();
        this.quizSlideQuestion = quizSlideQuestion;
    }
}

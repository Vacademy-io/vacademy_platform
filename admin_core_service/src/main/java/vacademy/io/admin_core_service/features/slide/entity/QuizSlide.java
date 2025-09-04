package vacademy.io.admin_core_service.features.slide.entity;

import jakarta.persistence.*;
import lombok.*;
import vacademy.io.admin_core_service.features.common.entity.RichTextData;
import vacademy.io.admin_core_service.features.slide.dto.QuizSlideDTO;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Entity
@Table(name = "quiz_slide")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class QuizSlide {

    @Id
    private String id;

    @OneToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "description", referencedColumnName = "id", foreignKey = @ForeignKey(name = "fk_quiz_desc_rich_text_id"))
    private RichTextData descriptionRichText;

    private String title;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "quizSlide", cascade = CascadeType.ALL)
    private List<QuizSlideQuestion> questions;

    public QuizSlide(QuizSlideDTO quizSlideDTO) {
        this.id = quizSlideDTO.getId();
        this.title = quizSlideDTO.getTitle();
        if (quizSlideDTO.getDescription() != null) {
            this.descriptionRichText = new RichTextData(quizSlideDTO.getDescription());
        }
        if (quizSlideDTO.getQuestions() != null && !quizSlideDTO.getQuestions().isEmpty()) {
            this.questions = quizSlideDTO.getQuestions().stream()
                    .map(q -> new QuizSlideQuestion(q, this))
                    .collect(Collectors.toList());
        }
    }
}

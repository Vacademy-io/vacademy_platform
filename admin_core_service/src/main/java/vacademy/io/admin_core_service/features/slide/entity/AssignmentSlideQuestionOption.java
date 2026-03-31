package vacademy.io.admin_core_service.features.slide.entity;

import jakarta.persistence.*;
import lombok.*;
import vacademy.io.admin_core_service.features.common.entity.RichTextData;
import vacademy.io.admin_core_service.features.slide.dto.AssignmentSlideQuestionOptionDTO;

import java.time.LocalDateTime;

@Entity
@Table(name = "assignment_slide_question_options")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AssignmentSlideQuestionOption {

    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assignment_slide_question_id", nullable = false)
    private AssignmentSlideQuestion assignmentSlideQuestion;

    @OneToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "text_id", referencedColumnName = "id")
    private RichTextData text;

    private String mediaId;

    @Column(name = "created_on")
    private LocalDateTime createdOn;

    @Column(name = "updated_on")
    private LocalDateTime updatedOn;

    public AssignmentSlideQuestionOption(AssignmentSlideQuestionOptionDTO dto, AssignmentSlideQuestion question) {
        this.id = dto.getId();
        if (dto.getText() != null) {
            this.text = new RichTextData(dto.getText());
        }
        this.mediaId = dto.getMediaId();
        this.assignmentSlideQuestion = question;
    }
}

package vacademy.io.admin_core_service.features.slide.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.common.entity.RichTextData;
import vacademy.io.admin_core_service.features.slide.dto.AssignmentSlideQuestionDTO;
import vacademy.io.common.ai.dto.RichTextDataDTO;

import java.sql.Timestamp;

@Entity
public class AssignmentSlideQuestion {

    @Id
    @UuidGenerator
    private String id;

    @OneToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "text_id", referencedColumnName = "id")
    private RichTextData textData;

    private Integer questionOrder;

    private String status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assignment_slide_id")
    private AssignmentSlide assignmentSlide;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;

    public AssignmentSlideQuestion() {
    }

    public AssignmentSlideQuestion(AssignmentSlideQuestionDTO dto, AssignmentSlide assignmentSlide) {
        this.id = dto.getId();
        if (dto.getTextData() != null)
            this.textData = new RichTextData(dto.getTextData());
        this.questionOrder = dto.getQuestionOrder();
        this.status = dto.getStatus();
        this.assignmentSlide = assignmentSlide;
    }
}

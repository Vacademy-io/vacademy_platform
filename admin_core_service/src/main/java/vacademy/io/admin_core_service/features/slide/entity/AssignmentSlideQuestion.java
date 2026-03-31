package vacademy.io.admin_core_service.features.slide.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.common.entity.RichTextData;
import vacademy.io.admin_core_service.features.slide.dto.AssignmentSlideQuestionDTO;

import java.sql.Timestamp;
import java.util.List;
import java.util.stream.Collectors;

@Entity
public class AssignmentSlideQuestion {

    @Id
    @UuidGenerator
    private String id;

    @OneToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "text_id", referencedColumnName = "id")
    private RichTextData textData;

    @Column(name = "question_type")
    private String questionType;

    private Integer questionOrder;

    private String status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assignment_slide_id")
    private AssignmentSlide assignmentSlide;

    @OneToMany(mappedBy = "assignmentSlideQuestion", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<AssignmentSlideQuestionOption> options;

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
        this.questionType = dto.getQuestionType();
        this.questionOrder = dto.getQuestionOrder();
        this.status = dto.getStatus();
        this.assignmentSlide = assignmentSlide;
        if (dto.getOptions() != null && !dto.getOptions().isEmpty()) {
            this.options = dto.getOptions().stream()
                    .map(o -> new AssignmentSlideQuestionOption(o, this))
                    .collect(Collectors.toList());
        }
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public RichTextData getTextData() { return textData; }
    public void setTextData(RichTextData textData) { this.textData = textData; }
    public String getQuestionType() { return questionType; }
    public void setQuestionType(String questionType) { this.questionType = questionType; }
    public Integer getQuestionOrder() { return questionOrder; }
    public void setQuestionOrder(Integer questionOrder) { this.questionOrder = questionOrder; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public AssignmentSlide getAssignmentSlide() { return assignmentSlide; }
    public void setAssignmentSlide(AssignmentSlide assignmentSlide) { this.assignmentSlide = assignmentSlide; }
    public List<AssignmentSlideQuestionOption> getOptions() { return options; }
    public void setOptions(List<AssignmentSlideQuestionOption> options) { this.options = options; }
}

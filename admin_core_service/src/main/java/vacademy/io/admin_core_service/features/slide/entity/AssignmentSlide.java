package vacademy.io.admin_core_service.features.slide.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import vacademy.io.admin_core_service.features.common.entity.RichTextData;
import vacademy.io.admin_core_service.features.slide.dto.AssignmentSlideDTO;

import java.sql.Date;
import java.sql.Timestamp;
import java.util.List;

@Entity
@Table(name = "assignment_slide")
@Getter
@Setter
public class AssignmentSlide {

    @Id
    @Column(name = "id", nullable = false)
    private String id;

    // Foreign Keys
    @OneToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "parent_rich_text_id", referencedColumnName = "id")
    private RichTextData parentRichText;

    @OneToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "text_id", referencedColumnName = "id")
    private RichTextData textData;

    @Column(name = "live_date")
    private Date liveDate;

    @Column(name = "end_date")
    private Date endDate;

    @Column(name = "re_attempt_count")
    private Integer reAttemptCount;

    @Column(name = "comma_separated_media_ids")
    private String commaSeparatedMediaIds;

    @OneToMany(mappedBy = "assignmentSlide", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<AssignmentSlideQuestion> assignmentSlideQuestions;

    // Timestamps
    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;

    public AssignmentSlide(AssignmentSlideDTO dto) {
        if (dto == null) return;

        this.id = dto.getId();
        if (dto.getParentRichText() != null) {
            this.parentRichText = new RichTextData(dto.getParentRichText());
        }
        if (dto.getTextData() != null) {
            this.textData = new RichTextData(dto.getParentRichText());
        }
        this.liveDate = dto.getLiveDate();
        this.endDate = dto.getEndDate();
        this.reAttemptCount = dto.getReAttemptCount();
        this.commaSeparatedMediaIds = dto.getCommaSeparatedMediaIds();
        if (dto.getQuestions() != null) {
            this.assignmentSlideQuestions = dto.getQuestions().stream().map((question) -> new AssignmentSlideQuestion(question,this)).toList();
        }
    }

    public AssignmentSlide() {
    }

}

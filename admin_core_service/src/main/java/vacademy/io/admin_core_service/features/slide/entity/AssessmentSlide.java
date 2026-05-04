package vacademy.io.admin_core_service.features.slide.entity;

import jakarta.persistence.*;
import lombok.*;
import vacademy.io.admin_core_service.features.slide.dto.AssessmentSlideDTO;

import java.time.LocalDateTime;

@Entity
@Table(name = "assessment_slide")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AssessmentSlide {

    @Id
    private String id;

    @Column(name = "assessment_id", nullable = false)
    private String assessmentId;

    @Builder.Default
    @Column(name = "allow_reattempt")
    private Boolean allowReattempt = true;

    @Builder.Default
    @Column(name = "show_result")
    private Boolean showResult = true;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    public AssessmentSlide(AssessmentSlideDTO dto) {
        this.id = dto.getId();
        this.assessmentId = dto.getAssessmentId();
        this.allowReattempt = dto.getAllowReattempt() != null ? dto.getAllowReattempt() : Boolean.TRUE;
        this.showResult = dto.getShowResult() != null ? dto.getShowResult() : Boolean.TRUE;
    }
}

package vacademy.io.admin_core_service.features.learner_tracking.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.learner_tracking.dto.AssessmentSlideActivityLogDTO;

import java.sql.Timestamp;

@Entity
@AllArgsConstructor
@NoArgsConstructor
public class AssessmentSlideTracked {

    @Id
    private String id;

    private String attemptId;

    private String commaSeparatedFileIds;

    @ManyToOne
    @JoinColumn(name = "activity_id", nullable = false)
    private ActivityLog activityLog;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;

    public AssessmentSlideTracked(AssessmentSlideActivityLogDTO dto, ActivityLog activityLog) {
        this.id = dto.getId();
        this.attemptId = dto.getAttemptId();
        this.commaSeparatedFileIds = dto.getCommaSeparatedFileIds();
        this.activityLog = activityLog;
    }

    public AssessmentSlideActivityLogDTO toAssessmentSlideActivityLog() {
        AssessmentSlideActivityLogDTO dto = new AssessmentSlideActivityLogDTO();
        dto.setId(id);
        dto.setAttemptId(attemptId);
        dto.setCommaSeparatedFileIds(commaSeparatedFileIds);
        dto.setDateSubmitted(activityLog.getCreatedAt());
        return dto;
    }

    public String getId() {
        return id;
    }
}

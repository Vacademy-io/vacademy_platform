package vacademy.io.admin_core_service.features.learner_tracking.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.learner_tracking.dto.AssignmentSlideActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.dto.QuestionSlideActivityLogDTO;

import java.sql.Timestamp;

@Entity
@AllArgsConstructor
@NoArgsConstructor
public class AssignmentSlideTracked {

    @Id
    private String id;

    private String commaSeparatedFileIds;

    @ManyToOne
    @JoinColumn(name = "activity_id", nullable = false)
    private ActivityLog activityLog;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;

    public AssignmentSlideTracked(AssignmentSlideActivityLogDTO assignmentSlideActivityLogDTO, ActivityLog activityLog) {
        this.id = assignmentSlideActivityLogDTO.getId();
        this.commaSeparatedFileIds = assignmentSlideActivityLogDTO.getCommaSeparatedFileIds();
        this.activityLog = activityLog;
    }
}

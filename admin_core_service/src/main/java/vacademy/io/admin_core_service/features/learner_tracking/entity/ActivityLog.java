package vacademy.io.admin_core_service.features.learner_tracking.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.learner_tracking.dto.ActivityLogDTO;

import java.sql.Timestamp;

@Entity
@Table(name = "activity_log")
@Getter
@Setter
@NoArgsConstructor
public class ActivityLog {

    @Id
    @UuidGenerator
    @Column(length = 255, nullable = false)
    private String id;

    @Column(name = "source_id", length = 255)
    private String sourceId;

    @Column(name = "source_type", length = 255)
    private String sourceType;

    @Column(name = "user_id", length = 255, nullable = false)
    private String userId;

    @Column(name = "slide_id", length = 255)
    private String slideId;

    @Column(name = "start_time")
    private Timestamp startTime;

    @Column(name = "end_time")
    private Timestamp endTime;

    @Column(name = "percentage_watched")
    private Double percentageWatched;

    @Column(name = "created_at", insertable = false, updatable = false, columnDefinition = "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false, columnDefinition = "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    private Timestamp updatedAt;

    public ActivityLog(ActivityLogDTO activityLogDTO, String userId, String slideId) {
        this.id = activityLogDTO.getId();
        this.sourceId = activityLogDTO.getSourceId();
        this.sourceType = activityLogDTO.getSourceType();
        this.userId = userId;
        this.slideId = slideId;
        this.startTime = activityLogDTO.getStartTime();
        this.endTime = activityLogDTO.getEndTime();
        this.percentageWatched = activityLogDTO.getPercentageWatched();
    }
    public ActivityLogDTO toActivityLogDTO() {
        ActivityLogDTO activityLogDTO = new ActivityLogDTO();
        activityLogDTO.setId(id);
        activityLogDTO.setSourceId(sourceId);
        activityLogDTO.setSourceType(sourceType);
        activityLogDTO.setUserId(userId);
        activityLogDTO.setSlideId(slideId);
        activityLogDTO.setStartTime(startTime);
        activityLogDTO.setEndTime(endTime);
        activityLogDTO.setPercentageWatched(percentageWatched);
        return activityLogDTO;
    }
}
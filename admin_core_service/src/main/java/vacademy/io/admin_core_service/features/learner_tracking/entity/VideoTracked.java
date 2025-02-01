package vacademy.io.admin_core_service.features.learner_tracking.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.learner_tracking.dto.VideoActivityLogDTO;

import java.sql.Timestamp;

@Entity
@Table(name = "video_tracked", schema = "public")
@Getter
@Setter
@NoArgsConstructor
public class VideoTracked {

    @Id
    @UuidGenerator
    @Column(length = 255, nullable = false)
    private String id;

    @ManyToOne
    @JoinColumn(name = "activity_id", nullable = false)
    private ActivityLog activityLog;

    @Column(name = "start_time")
    private Timestamp startTime;

    @Column(name = "end_time")
    private Timestamp endTime;

    @Column(name = "created_at", insertable = false, updatable = false, columnDefinition = "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false, columnDefinition = "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    private Timestamp updatedAt;

    public VideoTracked(VideoActivityLogDTO videoActivityLogDTO, ActivityLog activityLog) {
        this.id = videoActivityLogDTO.getId();
        this.activityLog = activityLog;
        this.startTime = videoActivityLogDTO.getStartTime();
        this.endTime = videoActivityLogDTO.getEndTime();
    }
}
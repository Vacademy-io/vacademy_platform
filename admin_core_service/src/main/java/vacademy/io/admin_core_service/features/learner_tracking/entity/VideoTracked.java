package vacademy.io.admin_core_service.features.learner_tracking.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import vacademy.io.admin_core_service.features.learner_tracking.dto.VideoActivityLogDTO;

import java.sql.Timestamp;

@Entity
@Table(name = "video_tracked", schema = "public")
@Getter
@Setter
@NoArgsConstructor
public class VideoTracked {

    @Id
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
        if (videoActivityLogDTO.getStartTimeInMillis() != null) {
            this.startTime = new Timestamp(videoActivityLogDTO.getStartTimeInMillis());
        }
        if (videoActivityLogDTO.getEndTimeInMillis() != null) {
            this.endTime = new Timestamp(videoActivityLogDTO.getEndTimeInMillis());
        }
    }

    public VideoActivityLogDTO videoActivityLogDTO() {
        VideoActivityLogDTO videoActivityLogDTO = new VideoActivityLogDTO();
        videoActivityLogDTO.setId(id);
        videoActivityLogDTO.setStartTimeInMillis(startTime != null ? startTime.getTime() : null);
        videoActivityLogDTO.setEndTimeInMillis(endTime != null ? endTime.getTime() : null);
        return videoActivityLogDTO;
    }
}
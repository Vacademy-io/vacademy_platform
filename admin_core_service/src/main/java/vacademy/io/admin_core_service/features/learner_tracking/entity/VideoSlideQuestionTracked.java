package vacademy.io.admin_core_service.features.learner_tracking.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import vacademy.io.admin_core_service.features.learner_tracking.dto.AssignmentSlideActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.dto.VideoSlideQuestionActivityLogDTO;

import java.sql.Timestamp;

@Entity
@Table(name = "video_slide_question_tracked")
@NoArgsConstructor
@Getter
@Setter
public class VideoSlideQuestionTracked {

    @Id
    private String id;

    private String responseJson;

    private String responseStatus;

    @ManyToOne
    @JoinColumn(name = "activity_id", nullable = false)
    private ActivityLog activityLog;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;

    public VideoSlideQuestionTracked(VideoSlideQuestionActivityLogDTO videoSlideQuestionActivityLogDTO, ActivityLog activityLog) {
        this.id = videoSlideQuestionActivityLogDTO.getId();
        this.responseJson = videoSlideQuestionActivityLogDTO.getResponseJson();
        this.responseStatus = videoSlideQuestionActivityLogDTO.getResponseStatus();
        this.activityLog = activityLog;
    }

    public VideoSlideQuestionActivityLogDTO toVideoSlideQuestionActivityLogDTO() {
        VideoSlideQuestionActivityLogDTO videoSlideQuestionActivityLogDTO = new VideoSlideQuestionActivityLogDTO();
        videoSlideQuestionActivityLogDTO.setId(id);
        videoSlideQuestionActivityLogDTO.setResponseJson(responseJson);
        videoSlideQuestionActivityLogDTO.setResponseStatus(responseStatus);
        return videoSlideQuestionActivityLogDTO;
    }
}

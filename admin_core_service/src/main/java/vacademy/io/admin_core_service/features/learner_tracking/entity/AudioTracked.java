package vacademy.io.admin_core_service.features.learner_tracking.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import vacademy.io.admin_core_service.features.learner_tracking.dto.AudioActivityLogDTO;

import java.sql.Timestamp;

/**
 * Entity for tracking audio playback intervals.
 * Each record represents a segment of audio that was listened to.
 */
@Entity
@Table(name = "audio_tracked")
@Getter
@Setter
@NoArgsConstructor
public class AudioTracked {

    @Id
    @Column(name = "id", length = 255, nullable = false)
    private String id;

    @Column(name = "activity_id", length = 255)
    private String activityId;

    /**
     * Start time of the audio segment (in milliseconds from audio start)
     */
    @Column(name = "start_time")
    private Timestamp startTime;

    /**
     * End time of the audio segment (in milliseconds from audio start)
     */
    @Column(name = "end_time")
    private Timestamp endTime;

    /**
     * Playback speed used during this segment
     */
    @Column(name = "playback_speed")
    private Double playbackSpeed;

    @Column(name = "created_at", insertable = false, updatable = false, columnDefinition = "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false, columnDefinition = "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    private Timestamp updatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "activity_id", referencedColumnName = "id", insertable = false, updatable = false)
    private ActivityLog activityLog;

    /**
     * Constructor from DTO
     */
    public AudioTracked(AudioActivityLogDTO dto, ActivityLog activityLog) {
        this.id = dto.getId() != null ? dto.getId() : java.util.UUID.randomUUID().toString();
        this.activityId = activityLog.getId();
        if (dto.getStartTimeInMillis() != null) {
            this.startTime = new Timestamp(dto.getStartTimeInMillis());
        }
        if (dto.getEndTimeInMillis() != null) {
            this.endTime = new Timestamp(dto.getEndTimeInMillis());
        }
        this.playbackSpeed = dto.getPlaybackSpeed();
    }

    /**
     * Convert to DTO
     */
    public AudioActivityLogDTO toAudioActivityLogDTO() {
        AudioActivityLogDTO dto = new AudioActivityLogDTO();
        dto.setId(this.id);
        dto.setStartTimeInMillis(this.startTime != null ? this.startTime.getTime() : null);
        dto.setEndTimeInMillis(this.endTime != null ? this.endTime.getTime() : null);
        dto.setPlaybackSpeed(this.playbackSpeed);
        return dto;
    }
}

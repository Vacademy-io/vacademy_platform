package vacademy.io.admin_core_service.features.learner_tracking.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

/**
 * DTO for tracking audio playback activity.
 * Similar to VideoActivityLogDTO but specific to audio slides.
 */
@Getter
@Setter
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AudioActivityLogDTO {

    /**
     * Unique ID for this tracking entry
     */
    private String id;

    /**
     * Start time of the audio segment listened (in milliseconds from audio start)
     */
    private Long startTimeInMillis;

    /**
     * End time of the audio segment listened (in milliseconds from audio start)
     */
    private Long endTimeInMillis;

    /**
     * Playback speed (e.g., 1.0, 1.5, 2.0)
     */
    private Double playbackSpeed;
}

package vacademy.io.admin_core_service.features.live_session.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response DTO returned by the feedback-config endpoint.
 * Contains the feedback configuration for a session and whether the current
 * user has already submitted feedback for the given schedule.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class FeedbackConfigResponseDTO {
    /** The raw feedback config JSON string (parsed by the frontend). */
    private Object feedbackConfig;
    private boolean alreadySubmitted;
    private String sessionTitle;
    private String instituteName;
    private String instituteLogo;
}

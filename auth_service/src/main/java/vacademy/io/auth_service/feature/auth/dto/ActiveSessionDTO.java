package vacademy.io.auth_service.feature.auth.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Represents one active session shown on the "You're logged in on other
 * devices" popup.
 * The sessionId is used to identify which session to terminate.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ActiveSessionDTO {
    private String sessionId; // user_session.id — sent back to /session/logout
    private String deviceType; // "mobile", "desktop", "tablet" — derived from User-Agent
    private String ipAddress;
    private LocalDateTime loginTime;
    private LocalDateTime lastActivityTime;
}

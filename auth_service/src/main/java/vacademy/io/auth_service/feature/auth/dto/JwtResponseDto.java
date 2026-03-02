package vacademy.io.auth_service.feature.auth.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class JwtResponseDto {
    private String accessToken;
    private String refreshToken;

    // Session-limit fields — false/null on all normal logins (backward compatible)
    // Existing fields keep their original camelCase serialization (no @JsonNaming)
    @Builder.Default
    @JsonProperty("session_limit_exceeded")
    private boolean sessionLimitExceeded = false;

    @JsonProperty("active_sessions")
    private List<ActiveSessionDTO> activeSessions;
}

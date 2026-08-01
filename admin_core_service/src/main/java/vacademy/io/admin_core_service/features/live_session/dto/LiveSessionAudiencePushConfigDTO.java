package vacademy.io.admin_core_service.features.live_session.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * "Save registrants to audience list(s)" config for a public live session.
 * Serialized as-is into {@code live_session.audience_push_config_json}. When
 * enabled, every public guest registration is also pushed as a lead into each
 * selected audience list (on top of the always-on default
 * "Public Webinar - Live Session" audience).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class LiveSessionAudiencePushConfigDTO {
    private Boolean enabled;
    private List<String> audienceIds;

    public boolean isPushEnabled() {
        return Boolean.TRUE.equals(enabled) && audienceIds != null && !audienceIds.isEmpty();
    }
}

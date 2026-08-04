package vacademy.io.admin_core_service.features.learner.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Notification from auth_service that {@code users.username} has already been
 * committed to a new value. Carries the previous username because the copies
 * downstream of admin_core are keyed by username rather than user_id.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class UsernameChangedRequest {

    private String userId;
    private String oldUsername;
    private String newUsername;
}

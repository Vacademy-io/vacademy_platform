package vacademy.io.assessment_service.features.user_credentials.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Payload for the username rename fan-out. Carries BOTH usernames because the
 * assessment-side copies are keyed by username, not by user_id:
 * {@code live_session_response} has no user_id column at all, and guest
 * participants in {@code live_session_participant} have a null one. The old
 * value is therefore the only usable predicate, and it has to be captured in
 * auth_service before {@code users.username} is overwritten.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class UsernameRenameRequest {

    /** auth users.id — used for the tables that do carry a user_id, and for log correlation. */
    private String userId;

    /** The username as it was BEFORE the change. */
    private String oldUsername;

    /** The username as it is now in auth users.username. */
    private String newUsername;
}

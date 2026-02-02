package vacademy.io.admin_core_service.features.enrollment_policy.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Value;
import lombok.experimental.SuperBuilder;
import lombok.extern.jackson.Jacksonized;

import java.util.List;

@Value
@Jacksonized
@SuperBuilder
@JsonIgnoreProperties(ignoreUnknown = true)
public class OnEnrollmentPolicyDTO {
    /**
     * List of package_session_ids to mark as DELETED when user enrolls in this
     * package.
     * Use case: When user upgrades from demo to paid, terminate all demo sessions.
     */
    List<String> terminateActiveSessions;

    /**
     * List of package_session_ids that should block enrollment if user is already
     * ACTIVE in them.
     * Use case: Block demo enrollment if user already has an active paid
     * subscription.
     */
    List<String> blockIfActiveIn;

    /**
     * Custom message to show when enrollment is blocked due to existing active
     * session.
     * If not provided, a default message will be used.
     */
    String blockMessage;
}

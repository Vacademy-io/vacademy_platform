package vacademy.io.admin_core_service.features.user_subscription.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Container for all policy details of a specific package session.
 * Includes timeline of future actions, re-enrollment policy, and expiry policy.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class PackageSessionPolicyDetailsDTO {

    /**
     * Package session ID
     */
    private String packageSessionId;

    /**
     * Package session name
     */
    private String packageSessionName;

    /**
     * Package session status
     */
    private String packageSessionStatus;

    /**
     * List of all future actions sorted by scheduled date (ascending)
     * Includes notifications, payment attempts, expiry events
     */
    private List<PolicyActionDTO> policyActions;

    /**
     * Re-enrollment policy details
     * Null if no re-enrollment policy configured
     */
    private ReenrollmentPolicyDetailsDTO reenrollmentPolicy;

    /**
     * On expiry policy details
     * Null if no expiry policy configured
     */
    private OnExpiryPolicyDetailsDTO onExpiryPolicy;
}

package vacademy.io.admin_core_service.features.migration.dto.v2;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Practice/SubOrg configuration for enrollment
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PracticeEnrollmentDTO {

    // ===== For ROOT_ADMIN (creating new practice) =====

    /**
     * Practice/Organization name (required for ROOT_ADMIN)
     */
    @JsonProperty("practice_name")
    private String practiceName;

    // ===== For Members (linking to existing practice) =====

    /**
     * Link to practice by finding the owner's email
     */
    @JsonProperty("link_to_owner_email")
    private String linkToOwnerEmail;

    /**
     * Link to practice by SubOrg ID directly
     */
    @JsonProperty("sub_org_id")
    private String subOrgId;

    // ===== Role Configuration =====

    /**
     * Role in the practice: ROOT_ADMIN, ADMIN, LEARNER
     * ROOT_ADMIN: Creates the SubOrg, owns the UserPlan
     * ADMIN: Has admin privileges, links to root's plan
     * LEARNER: Regular member, links to root's plan
     */
    @JsonProperty("role")
    private String role;

    // Helper methods
    public boolean isRootAdmin() {
        return "ROOT_ADMIN".equalsIgnoreCase(role);
    }

    public boolean isAdmin() {
        return "ADMIN".equalsIgnoreCase(role);
    }

    public boolean isLearner() {
        return "LEARNER".equalsIgnoreCase(role) || role == null;
    }

    public String getEffectiveRole() {
        if (role == null || role.isBlank()) {
            return "LEARNER";
        }
        return role.toUpperCase();
    }

    /**
     * Get comma-separated roles for SSIGM
     */
    public String getCommaSeparatedRoles() {
        String r = getEffectiveRole();
        if ("ROOT_ADMIN".equals(r)) {
            return "ROOT_ADMIN,LEARNER";
        } else if ("ADMIN".equals(r)) {
            return "ADMIN,LEARNER";
        } else {
            return "LEARNER";
        }
    }

    public boolean hasLinkToOwner() {
        return (linkToOwnerEmail != null && !linkToOwnerEmail.isBlank()) ||
                (subOrgId != null && !subOrgId.isBlank());
    }
}

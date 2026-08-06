package vacademy.io.admin_core_service.features.learner.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * One sub-organization already present in a given (org-associated) package session, with the
 * contact details an admin needs to recognise it while enrolling someone into that batch.
 *
 * <p>Powers the sub-org picker step of the admin "Enroll Learner" wizard: the admin picks the
 * sub-org by name, sees who its admins are (name + email) to confirm they picked the right
 * organisation, and chooses the role the new member gets inside it.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class PackageSessionSubOrgDTO {
    private String subOrgId;
    private String name;
    private String email;
    private String mobileNumber;
    /** Distinct users already mapped to this sub-org within the package session. */
    private Long memberCount;
    /** Members of this sub-org whose comma_separated_org_roles carry ADMIN (or ROOT_ADMIN). */
    private List<AdminDetailsDTO> admins;
}

package vacademy.io.admin_core_service.features.audience.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.common.auth.dto.UserDTO;

import java.util.List;

/**
 * Options for the CRM Leads "All counsellors" filter.
 *
 * <p>{@code scoped == true} means team-hierarchy scoping applied: {@code counsellors} is the
 * caller plus their user-to-user descendants (self + reports + reports' reports), matching the
 * set of counsellors whose leads the caller can actually see in getLeads(). {@code scoped == false}
 * means the caller is unscoped (admin, or no leads_team_id configured) — {@code counsellors} is
 * empty and the frontend falls back to its institute-wide counsellor list.</p>
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LeadCounsellorOptionsDTO {
    private boolean scoped;
    private List<UserDTO> counsellors;
}

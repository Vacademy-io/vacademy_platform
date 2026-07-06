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
 * <p>{@code counsellors} is always the caller-visible COUNSELLOR-role list.
 * {@code scoped == true} means the caller is hierarchy-scoped (holds the COUNSELLOR role):
 * the list is the caller plus their counsellor-role descendants, matching the set of
 * counsellors whose leads they can actually see in getLeads(). {@code scoped == false}
 * means the caller is unscoped (pure admin / other roles) and the list is the
 * institute-wide COUNSELLOR-role roster.</p>
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LeadCounsellorOptionsDTO {
    private boolean scoped;
    private List<UserDTO> counsellors;
}

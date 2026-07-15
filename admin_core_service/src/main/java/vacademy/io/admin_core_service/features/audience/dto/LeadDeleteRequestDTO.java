package vacademy.io.admin_core_service.features.audience.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Request body for soft-deleting leads.
 *
 * <p>A "lead" in the list is one {@code audience_response} row, but the same person can hold
 * several — 341 users in production hold more than one, one of them 21 — so the caller has to
 * say which they mean:</p>
 * <ul>
 *   <li>{@code RESPONSE} (default) — delete only the given {@code response_ids}. This is what a
 *       row in the list represents, and what bulk-select operates on.</li>
 *   <li>{@code USER} — delete every lead belonging to the same people, across all campaigns.
 *       This is the "remove the person entirely" choice in the confirm dialog.</li>
 * </ul>
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class LeadDeleteRequestDTO {

    /** The audience_response ids to act on. Required for both scopes — under USER scope these
     *  identify the people whose leads get removed. */
    private List<String> responseIds;

    /** RESPONSE (default) | USER. See the class javadoc. */
    private String scope;

    /** Required: soft-delete is institute-scoped and the admin check is per institute. */
    private String instituteId;
}

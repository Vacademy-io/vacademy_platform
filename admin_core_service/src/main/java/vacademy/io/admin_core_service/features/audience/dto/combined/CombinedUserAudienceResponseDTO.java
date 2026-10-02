package vacademy.io.admin_core_service.features.audience.dto.combined;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Response DTO for combined users and audience API
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CombinedUserAudienceResponseDTO {

    private List<UserWithCustomFieldsDTO> users;
    
    // Pagination info
    private Long totalElements;
    private Integer totalPages;
    private Integer currentPage;
    private Integer pageSize;
    private Boolean isLast;
    
    // Optional: List of audience IDs that were used for filtering
    private List<String> filteredAudienceIds;

    /**
     * Whether this institute runs trials at all, i.e. at least one live invite configures
     * AUTOPAY_SETTING.TRIAL_DAYS > 0. The Trial/Paid badge and its filter hide themselves
     * when false, so an institute with no trial memberships never sees a distinction that
     * means nothing to it. Derived from the invites rather than from a flag someone has to
     * remember to switch on.
     */
    private Boolean membershipTypesAvailable;
}

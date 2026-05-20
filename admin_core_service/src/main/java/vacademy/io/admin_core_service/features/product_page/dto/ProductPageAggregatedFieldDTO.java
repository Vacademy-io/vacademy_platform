package vacademy.io.admin_core_service.features.product_page.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.admin_core_service.features.common.dto.InstituteCustomFieldDTO;

import java.util.ArrayList;
import java.util.List;

/**
 * Wraps InstituteCustomFieldDTO with the list of enrollInviteIds that own this field.
 * Used in the Course Page public response so the frontend can dynamically filter fields
 * when a learner deselects a course (fields exclusive to that invite are hidden).
 */
@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ProductPageAggregatedFieldDTO {

    private InstituteCustomFieldDTO field;

    /**
     * All enrollInviteIds across the page's mappings that reference this field
     * (matched by fieldId). The frontend uses this to filter fields when the
     * learner's selected courses change.
     */
    private List<String> enrollInviteIds = new ArrayList<>();

    public ProductPageAggregatedFieldDTO(InstituteCustomFieldDTO field, String firstInviteId) {
        this.field = field;
        this.enrollInviteIds.add(firstInviteId);
    }

    public void addInviteId(String inviteId) {
        if (!enrollInviteIds.contains(inviteId)) {
            enrollInviteIds.add(inviteId);
        }
    }
}

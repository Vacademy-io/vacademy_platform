package vacademy.io.admin_core_service.features.product_page.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ProductPageResponse {

    private String id;
    private String name;
    private String code;
    private String instituteId;
    private String status;
    private String pageJson;
    private String settingsJson;
    private String shortUrl;

    private List<ProductPageInviteMappingResponse> mappings;

    /**
     * Aggregated distinct custom fields across all active invites on this page.
     * Deduplicated by fieldId; each entry carries enrollInviteIds so the frontend
     * can filter fields when a learner deselects a course.
     */
    private List<ProductPageAggregatedFieldDTO> aggregatedCustomFields;

    /** Resolved from institute payment gateway config. */
    private String vendor;
    private String currency;
    private String gtmContainerId;
}

package vacademy.io.admin_core_service.features.product_page.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ProductPageRequest {

    private String name;

    /** Visual layout JSON (same structure as catalogue_json). */
    private String pageJson;

    /** Behavioural settings JSON (defaultStep, TnC, invoice, GTM, etc.). */
    private String settingsJson;

    private String status;

    private List<ProductPageInviteMappingRequest> mappings;
}

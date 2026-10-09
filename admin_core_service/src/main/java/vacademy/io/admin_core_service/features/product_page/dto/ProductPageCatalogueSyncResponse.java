package vacademy.io.admin_core_service.features.product_page.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;

import java.util.ArrayList;
import java.util.List;

/**
 * POST /v1/product-page/{id}/sync-catalogue: the page as GET /v1/product-page/{id}
 * returns it after the sync (so the editor can re-seed from it), plus what the
 * sync did.
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ToString(callSuper = true)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ProductPageCatalogueSyncResponse extends ProductPageResponse {

    /** Mappings added: one per catalogue package session the page did not sell. */
    private int added;

    /** Mappings switched off (status INACTIVE): their session left the catalogue, or they could no longer be sold. */
    private int deactivated;

    /** Catalogue sessions that could not be added, and why. */
    private List<Skipped> skipped = new ArrayList<>();

    /** Plain-language problems the admin should know about (mixed gateways or currencies, duplicates, price drift). */
    private List<String> warnings = new ArrayList<>();

    /** The package sessions added, in the order they were appended. */
    private List<String> addedPackageSessionIds = new ArrayList<>();

    /** The mappings switched off, and why. */
    private List<Deactivated> deactivatedMappings = new ArrayList<>();

    /**
     * reason: no_active_invite | invite_inactive | invite_not_started | invite_expired
     * | payment_option_inactive | cpo_not_supported | no_active_plan
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class Skipped {
        private String packageSessionId;
        private String reason;
        private String packageName;
        private String levelName;
    }

    /**
     * reason: left_catalogue | bridge_inactive | invite_inactive
     * | payment_option_inactive | plan_inactive | plan_missing
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class Deactivated {
        private String mappingId;
        private String packageSessionId;
        private String reason;
        private String packageName;
        private String levelName;
    }
}

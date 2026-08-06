package vacademy.io.admin_core_service.features.telephony.core.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Builder;
import lombok.Data;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.CallDispositionCatalog;

/**
 * Outward projection of one call outcome — powers both the counsellor's
 * disposition picker (catalog rows only) and the Call Log's disposition FILTER
 * (the wider vocabulary, which also includes the AI outcomes an institute
 * configured in AI Calling settings / its agents, and the ones its calls have
 * actually returned). {@link #settable} tells the two apart.
 */
@Data
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CallDispositionCatalogDTO {

    /** Where this outcome came from — see {@code CallDispositionOptionsService}. */
    public static final String SOURCE_CATALOG = "CATALOG";
    public static final String SOURCE_AI_SETTINGS = "AI_SETTINGS";
    public static final String SOURCE_AI_AGENT = "AI_AGENT";
    public static final String SOURCE_OBSERVED = "OBSERVED";

    private String id;
    private String dispositionKey;
    private String label;
    private String color;
    private String category;
    /** Whether choosing this outcome also advances the lead's pipeline status. */
    private boolean mapsToLeadStatus;

    /**
     * True only for {@link #SOURCE_CATALOG} rows — the ones
     * {@code POST /calls/{id}/disposition} will accept. An AI-sourced outcome is
     * filterable but NOT settable by hand (applying it would 400 on "Unknown
     * disposition"), so the picker must offer settable options only.
     */
    @Builder.Default
    private boolean settable = true;

    /** CATALOG | AI_SETTINGS | AI_AGENT | OBSERVED. */
    @Builder.Default
    private String source = SOURCE_CATALOG;

    public static CallDispositionCatalogDTO from(CallDispositionCatalog c) {
        return CallDispositionCatalogDTO.builder()
                .id(c.getId())
                .dispositionKey(c.getDispositionKey())
                .label(c.getLabel())
                .color(c.getColor())
                .category(c.getCategory())
                .mapsToLeadStatus(c.getMapsToLeadStatusId() != null)
                .settable(true)
                .source(SOURCE_CATALOG)
                .build();
    }
}

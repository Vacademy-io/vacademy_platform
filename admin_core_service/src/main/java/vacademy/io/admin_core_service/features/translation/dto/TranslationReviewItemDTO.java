package vacademy.io.admin_core_service.features.translation.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.sql.Timestamp;
import java.util.Map;

/**
 * One review item for the translation review screen: the sidecar row (both
 * text tables), its translated content, the canonical base content where cheap
 * to fetch (rich_text_data join / slide title-description), and a reference to
 * the entity the translation belongs to.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class TranslationReviewItemDTO {

    /** RICH_TEXT | ENTITY_FIELD — pairs with the /item/state "table" field. */
    @JsonProperty("table")
    private String table;

    @JsonProperty("id")
    private String id;

    @JsonProperty("state")
    private String state;

    @JsonProperty("translated_content")
    private String translatedContent;

    /** Canonical content; null when not cheaply resolvable. */
    @JsonProperty("base_content")
    private String baseContent;

    /**
     * RICH_TEXT: {"rich_text_id": ...};
     * ENTITY_FIELD: {"entity_type": ..., "entity_id": ..., "field": ...}.
     */
    @JsonProperty("entity_ref")
    private Map<String, String> entityRef;

    @JsonProperty("translated_by")
    private String translatedBy;

    @JsonProperty("updated_at")
    private Timestamp updatedAt;
}

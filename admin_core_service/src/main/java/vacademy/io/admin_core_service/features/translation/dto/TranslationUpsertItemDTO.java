package vacademy.io.admin_core_service.features.translation.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.Getter;
import lombok.Setter;

/**
 * One item of the shared internal batch-upsert contract (snake_case JSON):
 *
 * <pre>
 * { "target_type": "RICH_TEXT" | "ENTITY_FIELD" | "MEDIA",
 *   "rich_text_id": "...",                                  // RICH_TEXT only
 *   "entity_type": "...", "entity_id": "...", "field": "...", // ENTITY_FIELD / MEDIA
 *   "locale": "ar",
 *   "content": "...",                                       // RICH_TEXT + ENTITY_FIELD
 *   "json_value": {...} | null,                             // optional (ENTITY_FIELD)
 *   "file_id_or_url": "...", "kind": "PRIMARY|CAPTION_VTT|AUDIO_TRACK", // MEDIA only
 *   "state": "DRAFT" | "PUBLISHED",
 *   "source_locale": "en", "source_hash": "<sha256 of source text>",
 *   "translated_by": "AI:<model>" | "USER:<id>" }
 * </pre>
 */
@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class TranslationUpsertItemDTO {

    @JsonProperty("target_type")
    private String targetType;

    @JsonProperty("rich_text_id")
    private String richTextId;

    @JsonProperty("entity_type")
    private String entityType;

    @JsonProperty("entity_id")
    private String entityId;

    @JsonProperty("field")
    private String field;

    @JsonProperty("locale")
    private String locale;

    @JsonProperty("content")
    private String content;

    @JsonProperty("json_value")
    private JsonNode jsonValue;

    @JsonProperty("file_id_or_url")
    private String fileIdOrUrl;

    @JsonProperty("kind")
    private String kind;

    @JsonProperty("state")
    private String state;

    @JsonProperty("source_locale")
    private String sourceLocale;

    @JsonProperty("source_hash")
    private String sourceHash;

    @JsonProperty("translated_by")
    private String translatedBy;
}

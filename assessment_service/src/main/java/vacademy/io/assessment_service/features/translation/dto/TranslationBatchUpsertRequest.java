package vacademy.io.assessment_service.features.translation.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/**
 * Shared internal batch-upsert contract (snake_case JSON) — the EXACT shape
 * ai_service posts to every Java content service:
 *
 * <pre>
 * POST /internal/translations/v1/batch-upsert
 * { "items": [ {
 *     "target_type": "RICH_TEXT" | "ENTITY_FIELD" | "MEDIA",
 *     "rich_text_id": "...",                                        // RICH_TEXT only
 *     "entity_type": "...", "entity_id": "...", "field": "...",     // ENTITY_FIELD / MEDIA
 *     "locale": "ar",
 *     "content": "...",                                             // RICH_TEXT + ENTITY_FIELD
 *     "json_value": {...} | null,                                   // optional (ENTITY_FIELD)
 *     "file_id_or_url": "...", "kind": "PRIMARY|CAPTION_VTT|AUDIO_TRACK",  // MEDIA only
 *     "state": "DRAFT" | "PUBLISHED",
 *     "source_locale": "en", "source_hash": "&lt;sha256 of source text&gt;",
 *     "translated_by": "AI:&lt;model&gt;" | "USER:&lt;id&gt;"
 * } ], "package_session_id": "..." | null }
 * </pre>
 *
 * assessment_service additionally accepts an optional {@code assessment_id}
 * alongside {@code package_session_id}; when present it keys the
 * assessment_translation_coverage recompute.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class TranslationBatchUpsertRequest {

    private List<Item> items = new ArrayList<>();

    private String packageSessionId;

    /** Optional — assessment whose coverage rollup should be recomputed. */
    private String assessmentId;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Item {
        private String targetType;
        private String richTextId;
        private String entityType;
        private String entityId;
        private String field;
        private String locale;
        private String content;
        private JsonNode jsonValue;
        private String fileIdOrUrl;
        private String kind;
        private String state;
        private String sourceLocale;
        private String sourceHash;
        private String translatedBy;
    }
}

package vacademy.io.admin_core_service.features.translation.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

/**
 * Review approve/reject request:
 * {"table": "RICH_TEXT"|"ENTITY_FIELD"|"MEDIA", "id": "...", "state": "..."}.
 * Optional package_session_id keeps the coverage counter in sync when the
 * caller knows which package session the item belongs to.
 */
@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class TranslationItemStateUpdateDTO {

    @JsonProperty("table")
    private String table;

    @JsonProperty("id")
    private String id;

    @JsonProperty("state")
    private String state;

    @JsonProperty("package_session_id")
    private String packageSessionId;
}

package vacademy.io.admin_core_service.features.translation.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

/** Shared internal batch-upsert request: {"items": [...], "package_session_id": "..." | null}. */
@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class TranslationBatchUpsertRequestDTO {

    @JsonProperty("items")
    private List<TranslationUpsertItemDTO> items;

    @JsonProperty("package_session_id")
    private String packageSessionId;
}

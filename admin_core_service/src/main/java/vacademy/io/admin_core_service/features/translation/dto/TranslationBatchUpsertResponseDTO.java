package vacademy.io.admin_core_service.features.translation.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Shared internal batch-upsert response: {"upserted": n}. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class TranslationBatchUpsertResponseDTO {

    @JsonProperty("upserted")
    private int upserted;
}

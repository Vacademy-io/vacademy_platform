package vacademy.io.admin_core_service.features.migration.dto.v2;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Custom field value for import
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CustomFieldImportDTO {

    /**
     * Direct custom field ID (most reliable)
     */
    @JsonProperty("custom_field_id")
    private String customFieldId;

    /**
     * Field key (unique per institute)
     */
    @JsonProperty("field_key")
    private String fieldKey;

    /**
     * Field name (will be resolved via mapping)
     */
    @JsonProperty("field_key_or_name")
    private String fieldKeyOrName;

    /**
     * The value to store
     */
    @JsonProperty("value")
    private String value;

    /**
     * Gets the best available identifier for the custom field
     */
    public String getEffectiveFieldIdentifier() {
        if (customFieldId != null && !customFieldId.isBlank()) {
            return customFieldId;
        }
        if (fieldKey != null && !fieldKey.isBlank()) {
            return fieldKey;
        }
        return fieldKeyOrName;
    }

    public boolean hasDirectId() {
        return customFieldId != null && !customFieldId.isBlank();
    }
}

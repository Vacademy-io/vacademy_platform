package vacademy.io.admin_core_service.features.migration.dto.v2;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.util.StringUtils;

/**
 * DTO for importing tags for users
 * Tags can be specified by ID or by name
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TagImportDTO {

    /**
     * Tag ID (direct reference)
     */
    @JsonProperty("tag_id")
    private String tagId;

    /**
     * Tag name (will be looked up or created if auto_create is enabled)
     */
    @JsonProperty("tag_name")
    private String tagName;

    /**
     * Whether to auto-create the tag if it doesn't exist
     * Defaults to false (fail if tag not found)
     */
    @JsonProperty("auto_create")
    private Boolean autoCreate;

    // Helper methods
    public boolean hasDirectId() {
        return StringUtils.hasText(tagId);
    }

    public boolean hasTagName() {
        return StringUtils.hasText(tagName);
    }

    public boolean shouldAutoCreate() {
        return Boolean.TRUE.equals(autoCreate);
    }

    public String getEffectiveIdentifier() {
        if (hasDirectId()) {
            return tagId;
        }
        return tagName;
    }
}

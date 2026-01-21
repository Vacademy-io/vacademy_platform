package vacademy.io.admin_core_service.features.migration.dto.v2;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Request DTO for bulk user import (API 1)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BulkUserImportRequestDTO {

    @JsonProperty("users")
    private List<UserImportItemDTO> users;

    /**
     * Global mapping from field names to custom field IDs
     * e.g., {"Country": "cf-country-id", "State": "cf-state-id"}
     */
    @JsonProperty("default_custom_field_mapping")
    private Map<String, String> defaultCustomFieldMapping;

    /**
     * If true, don't update existing users (skip them)
     */
    @JsonProperty("skip_existing_users")
    private Boolean skipExistingUsers;

    /**
     * If true, validate without persisting
     */
    @JsonProperty("dry_run")
    private Boolean dryRun;

    // Helper methods
    public boolean isDryRun() {
        return Boolean.TRUE.equals(dryRun);
    }

    public boolean shouldSkipExisting() {
        return Boolean.TRUE.equals(skipExistingUsers);
    }
}

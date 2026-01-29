package vacademy.io.admin_core_service.features.common.dto;

import lombok.*;

/**
 * Represents a system field that can be mapped to a custom field.
 * Used to show available fields in the admin UI.
 */
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class SystemFieldInfoDTO {
    private String entityType;      // STUDENT, USER, etc.
    private String fieldName;       // Database column name: full_name
    private String displayName;     // Human-readable: Full Name
    private String fieldType;       // TEXT, NUMBER, DATE, etc.
    private boolean isMapped;       // Already has a custom field mapping
    private String mappedCustomFieldId; // If mapped, the custom field ID
}

package vacademy.io.admin_core_service.features.common.dto;

import lombok.*;
import vacademy.io.admin_core_service.features.common.enums.SyncDirectionEnum;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class SystemFieldCustomFieldMappingDTO {
    private String id;
    private String instituteId;
    private String entityType;
    private String systemFieldName;
    private String systemFieldDisplayName; // Human-readable name for UI
    private String customFieldId;
    private String customFieldName; // For display in UI
    private SyncDirectionEnum syncDirection;
    private String converterClass;
    private String status;
}

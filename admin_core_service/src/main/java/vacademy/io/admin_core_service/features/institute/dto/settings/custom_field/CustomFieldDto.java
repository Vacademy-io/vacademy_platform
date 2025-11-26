package vacademy.io.admin_core_service.features.institute.dto.settings.custom_field;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class CustomFieldDto {
    private String id;

    private String customFieldId;

    private String instituteId;

    private String groupName;

    private String fieldName;

    private String fieldType;

    private Integer individualOrder;

    private Integer groupInternalOrder;

    private Boolean canBeDeleted;

    private Boolean canBeEdited;

    private Boolean canBeRenamed;

    private List<String> locations;

    private String status;

    private String config;
}

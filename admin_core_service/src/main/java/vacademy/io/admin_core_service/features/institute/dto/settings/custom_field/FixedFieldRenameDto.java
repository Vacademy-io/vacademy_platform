package vacademy.io.admin_core_service.features.institute.dto.settings.custom_field;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class FixedFieldRenameDto {
    private String key;
    private String defaultValue;
    private String customValue;
}

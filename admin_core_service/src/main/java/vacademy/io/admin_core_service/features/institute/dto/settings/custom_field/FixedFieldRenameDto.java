package vacademy.io.admin_core_service.features.institute.dto.settings.custom_field;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor
public class FixedFieldRenameDto {
    private String key;
    private String defaultValue;
    private String customValue;
    private Integer order;
    private Boolean visibility;
}

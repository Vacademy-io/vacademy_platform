package vacademy.io.admin_core_service.features.institute.dto.settings.naming;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class NamingSettingDto {
    private String key;
    private String systemValue;
    private String customValue;
}

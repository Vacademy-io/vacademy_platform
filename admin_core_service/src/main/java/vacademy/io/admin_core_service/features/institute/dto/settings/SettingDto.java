package vacademy.io.admin_core_service.features.institute.dto.settings;


import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SettingDto {
    private String key;
    private String name;
    private Object data;
}

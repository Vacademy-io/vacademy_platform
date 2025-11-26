package vacademy.io.admin_core_service.features.institute.dto.settings;


import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class SettingDto {
    private String key;
    private String name;
    private Object data;
}

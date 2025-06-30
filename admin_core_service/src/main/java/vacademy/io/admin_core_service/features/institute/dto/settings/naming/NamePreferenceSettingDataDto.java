package vacademy.io.admin_core_service.features.institute.dto.settings.naming;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Setter
@Getter
public class NamePreferenceSettingDataDto {
    private List<NamingSettingDto> data;
}

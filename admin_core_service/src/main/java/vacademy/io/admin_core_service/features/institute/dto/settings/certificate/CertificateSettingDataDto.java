package vacademy.io.admin_core_service.features.institute.dto.settings.certificate;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class CertificateSettingDataDto {
    List<CertificateSettingDto> data;
}

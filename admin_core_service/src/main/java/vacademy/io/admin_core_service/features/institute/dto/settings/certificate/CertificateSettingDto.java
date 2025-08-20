package vacademy.io.admin_core_service.features.institute.dto.settings.certificate;


import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Setter
@Getter
public class CertificateSettingDto {
    private String key;
    private Boolean isDefaultCertificateSettingOn;
    private String defaultHtmlCertificateTemplate;
    private String currentHtmlCertificateTemplate;
    private List<String> customHtmlCertificateTemplate;
}

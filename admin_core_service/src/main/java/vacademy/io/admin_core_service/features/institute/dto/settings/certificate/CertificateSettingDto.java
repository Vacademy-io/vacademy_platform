package vacademy.io.admin_core_service.features.institute.dto.settings.certificate;


import lombok.Getter;
import lombok.Setter;

import java.util.List;
import java.util.Map;

@Setter
@Getter
public class CertificateSettingDto {
    private String key;
    private Boolean isDefaultCertificateSettingOn;
    private String defaultHtmlCertificateTemplate;
    private String currentHtmlCertificateTemplate;
    private List<String> customHtmlCertificateTemplate;
    private Map<String, String> placeHoldersMapping;
}

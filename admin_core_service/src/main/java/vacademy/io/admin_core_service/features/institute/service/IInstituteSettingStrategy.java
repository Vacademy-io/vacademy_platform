package vacademy.io.admin_core_service.features.institute.service;

import lombok.Getter;
import lombok.Setter;
import vacademy.io.common.institute.entity.Institute;

public abstract class IInstituteSettingStrategy {
    @Getter
    @Setter
    private String key;


    public abstract String buildInstituteSetting(Institute institute, Object settingRequest);
    public abstract String rebuildInstituteSetting(Institute institute, Object settingRequest, String key);
}

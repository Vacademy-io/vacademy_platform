package vacademy.io.admin_core_service.features.institute.service.setting;

import vacademy.io.admin_core_service.features.institute.enums.SettingKeyEnums;
import vacademy.io.common.institute.entity.Institute;

import java.util.HashMap;
import java.util.Map;



public class SettingStrategyFactory {

    private final Map<String, IInstituteSettingStrategy> strategies = new HashMap<>();

    public SettingStrategyFactory() {
        strategies.put(SettingKeyEnums.NAMING_SETTING.name(), new NameSettingStrategy());
        strategies.put(SettingKeyEnums.CERTIFICATE_SETTING.name(), new CertificateSettingStrategy());
        strategies.put(SettingKeyEnums.CUSTOM_FIELD_SETTING.name(), new CustomFieldSettingStrategy());
        // strategies.put("branding", new BrandingSettingStrategy(objectMapper));
        // Add more strategies here
    }

    private IInstituteSettingStrategy getStrategy(String key) {
        IInstituteSettingStrategy strategy = strategies.get(key);
        if (strategy == null) {
            // Fall back to generic strategy for unknown keys
            strategy = new GenericSettingStrategy();
            strategy.setKey(key);
        }
        return strategy;
    }

    public String buildNewSettingAndGetSettingJsonString(Institute institute, Object settingRequest, String key){
        IInstituteSettingStrategy strategy = getStrategy(key);
        return strategy.buildInstituteSetting(institute, settingRequest);
    }

    public String rebuildOldSettingAndGetSettingJsonString(Institute institute, Object settingRequest, String key){
        IInstituteSettingStrategy strategy = getStrategy(key);
        return strategy.rebuildInstituteSetting(institute, settingRequest,key);
    }
}

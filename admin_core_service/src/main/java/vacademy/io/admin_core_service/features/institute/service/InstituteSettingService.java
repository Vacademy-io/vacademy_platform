package vacademy.io.admin_core_service.features.institute.service;

import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute.dto.settings.naming.NameSettingRequest;
import vacademy.io.admin_core_service.features.institute.enums.SettingKeyEnums;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.common.institute.entity.Institute;

@Service
public class InstituteSettingService {

    private final SettingStrategyFactory settingStrategyFactory;
    private final InstituteRepository instituteRepository;

    public InstituteSettingService(InstituteRepository instituteRepository) {
        this.instituteRepository = instituteRepository;
        this.settingStrategyFactory = new SettingStrategyFactory();
    }


    public void createNewNamingSetting(Institute institute, NameSettingRequest request){
        String settingJsonString = settingStrategyFactory.buildNewSettingAndGetSettingJsonString(institute,request, SettingKeyEnums.NAMING_SETTING.name());
        institute.setSetting(settingJsonString);
        instituteRepository.save(institute);
    }

    public void updateNamingSetting(Institute institute, NameSettingRequest request){
        String settingJsonString = settingStrategyFactory.rebuildOldSettingAndGetSettingJsonString(institute,request, SettingKeyEnums.NAMING_SETTING.name());
        institute.setSetting(settingJsonString);
        instituteRepository.save(institute);
    }

    public void createDefaultNamingSetting(Institute institute, NameSettingRequest request){
        String settingJsonString = settingStrategyFactory.rebuildOldSettingAndGetSettingJsonString(institute,request, SettingKeyEnums.NAMING_SETTING.name());
        institute.setSetting(settingJsonString);
        instituteRepository.save(institute);
    }

}

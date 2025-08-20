package vacademy.io.admin_core_service.features.institute.service.setting;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute.constants.ConstantsSettingDefaultValue;
import vacademy.io.admin_core_service.features.institute.dto.settings.InstituteSettingDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.SettingDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.certificate.CertificateSettingDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.certificate.CertificateSettingRequest;
import vacademy.io.admin_core_service.features.institute.dto.settings.naming.NameSettingRequest;
import vacademy.io.admin_core_service.features.institute.enums.CertificateTypeEnum;
import vacademy.io.admin_core_service.features.institute.enums.SettingKeyEnums;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

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

    public void createNewCertificateSetting(Institute institute, CertificateSettingStrategy request){
        String settingJsonString = settingStrategyFactory.buildNewSettingAndGetSettingJsonString(institute,request, SettingKeyEnums.CERTIFICATE_SETTING.name());
        institute.setSetting(settingJsonString);
        instituteRepository.save(institute);
    }

    public void updateCertificateSetting(Institute institute, CertificateSettingRequest request){
        String settingJsonString = settingStrategyFactory.rebuildOldSettingAndGetSettingJsonString(institute,request, SettingKeyEnums.CERTIFICATE_SETTING.name());
        institute.setSetting(settingJsonString);
        instituteRepository.save(institute);
    }

    public void createDefaultCertificateSetting(Institute institute){
        CertificateSettingRequest request = new CertificateSettingRequest();
        CertificateSettingDto settingDto = new CertificateSettingDto();

        settingDto.setKey(CertificateTypeEnum.COURSE_COMPLETION.name());
        settingDto.setIsDefaultCertificateSettingOn(false);
        settingDto.setDefaultHtmlCertificateTemplate(ConstantsSettingDefaultValue.getDefaultHtmlCertificateTemplate());
        settingDto.setCurrentHtmlCertificateTemplate(ConstantsSettingDefaultValue.getDefaultHtmlCertificateTemplate());

        Map<String, CertificateSettingDto> settingDtoMap = new HashMap<>();
        settingDtoMap.put(CertificateTypeEnum.COURSE_COMPLETION.name(), settingDto);
        request.setRequest(settingDtoMap);


        String settingJsonString = settingStrategyFactory.buildNewSettingAndGetSettingJsonString(institute,request, SettingKeyEnums.CERTIFICATE_SETTING.name());
        institute.setSetting(settingJsonString);
        instituteRepository.save(institute);
    }

    public void updateNamingSetting(Institute institute, NameSettingRequest request){
        String settingJsonString = settingStrategyFactory.rebuildOldSettingAndGetSettingJsonString(institute,request, SettingKeyEnums.NAMING_SETTING.name());
        institute.setSetting(settingJsonString);
        instituteRepository.save(institute);
    }

    public void createDefaultNamingSetting(Institute institute, NameSettingRequest request){
        String settingJsonString = settingStrategyFactory.buildNewSettingAndGetSettingJsonString(institute,request, SettingKeyEnums.NAMING_SETTING.name());
        institute.setSetting(settingJsonString);
        instituteRepository.save(institute);
    }

    // Generic methods for any setting type
    public void createNewGenericSetting(Institute institute, String settingKey, Object settingData){
        String settingJsonString = settingStrategyFactory.buildNewSettingAndGetSettingJsonString(institute, settingData, settingKey);
        institute.setSetting(settingJsonString);
        instituteRepository.save(institute);
    }

    public void updateGenericSetting(Institute institute, String settingKey, Object settingData){
        String settingJsonString = settingStrategyFactory.rebuildOldSettingAndGetSettingJsonString(institute, settingData, settingKey);
        institute.setSetting(settingJsonString);
        instituteRepository.save(institute);
    }

    // Upsert method - creates if doesn't exist, updates if exists
    public void saveGenericSetting(Institute institute, String settingKey, Object settingData){
        String settingJsonString = settingStrategyFactory.buildNewSettingAndGetSettingJsonString(institute, settingData, settingKey);
        institute.setSetting(settingJsonString);
        instituteRepository.save(institute);
    }

    // GET methods for retrieving settings
    public InstituteSettingDto getAllSettings(Institute institute) {
        String settingJsonString = institute.getSetting();
        if (Objects.isNull(settingJsonString)) {
            return InstituteSettingDto.builder()
                    .instituteId(institute.getId())
                    .setting(Map.of())
                    .build();
        }

        try {
            ObjectMapper objectMapper = new ObjectMapper();
            return objectMapper.readValue(settingJsonString, InstituteSettingDto.class);
        } catch (Exception e) {
            throw new VacademyException("Error parsing settings: " + e.getMessage());
        }
    }

    public SettingDto getSpecificSetting(Institute institute, String settingKey) {
        InstituteSettingDto allSettings = getAllSettings(institute);
        
        if (allSettings.getSetting() == null || !allSettings.getSetting().containsKey(settingKey)) {
            return null;
        }
        
        return allSettings.getSetting().get(settingKey);
    }

    public Object getSettingData(Institute institute, String settingKey) {
        SettingDto setting = getSpecificSetting(institute, settingKey);
        return setting.getData();
    }

    public String getSettingsAsRawJson(Institute institute) {
        return institute.getSetting();
    }
}

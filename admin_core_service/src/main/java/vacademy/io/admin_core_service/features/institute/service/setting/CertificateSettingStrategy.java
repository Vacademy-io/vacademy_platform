package vacademy.io.admin_core_service.features.institute.service.setting;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute.constants.ConstantsSettingDefaultValue;
import vacademy.io.admin_core_service.features.institute.dto.settings.InstituteSettingDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.SettingDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.certificate.CertificateSettingDataDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.certificate.CertificateSettingDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.certificate.CertificateSettingRequest;
import vacademy.io.admin_core_service.features.institute.enums.CertificateTypeEnum;
import vacademy.io.admin_core_service.features.institute.enums.SettingKeyEnums;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
public class CertificateSettingStrategy extends IInstituteSettingStrategy{


    @Override
    public String buildInstituteSetting(Institute institute, Object settingRequest) {

        setKey(SettingKeyEnums.CERTIFICATE_SETTING.name());

        String settingJsonString = institute.getSetting();
        if(Objects.isNull(settingJsonString)) return handleCaseWhereNoSettingPresent(institute, settingRequest);

        return handleCaseWhereInstituteSettingPresent(institute, settingRequest);
    }

    private String handleCaseWhereInstituteSettingPresent(Institute institute, Object settingRequest) {
        try {
            ObjectMapper objectMapper = new ObjectMapper();
            CertificateSettingRequest certificateSettingRequest = (CertificateSettingRequest) settingRequest;
            if (certificateSettingRequest == null) throw new VacademyException("Invalid Request");

            // Parse the existing setting JSON string to Map
            InstituteSettingDto instituteSettingDto = objectMapper.readValue(
                    institute.getSetting(), InstituteSettingDto.class
            );

            Map<String, SettingDto> existingSettings = instituteSettingDto.getSetting();
            if (existingSettings == null) existingSettings = new HashMap<>();

            // Check if the naming setting already exists
            if (existingSettings.containsKey(SettingKeyEnums.CERTIFICATE_SETTING.name())) {
                // Just rebuild using rebuildInstituteSetting if already present
                return rebuildInstituteSetting(institute, certificateSettingRequest, SettingKeyEnums.NAMING_SETTING.name());
            }

            // Otherwise, create a new naming setting and add it
            CertificateSettingDataDto data = createCertificateSettingFromRequest(certificateSettingRequest);

            SettingDto settingDto = new SettingDto();
            settingDto.setKey(SettingKeyEnums.CERTIFICATE_SETTING.name());
            settingDto.setName("Certificate Setting");
            settingDto.setData(data);

            existingSettings.put(SettingKeyEnums.CERTIFICATE_SETTING.name(), settingDto);
            instituteSettingDto.setSetting(existingSettings);

            return objectMapper.writeValueAsString(instituteSettingDto);
        } catch (Exception e) {
            throw new VacademyException("Error updating setting: " + e.getMessage());
        }
    }

    private CertificateSettingDataDto createCertificateSettingFromRequest(CertificateSettingRequest certificateSettingRequest) {
        List<CertificateSettingDto> certificateSetting = certificateSettingRequest.getRequest().entrySet().stream()
                .map(entry -> {
                    CertificateSettingDto dto = new CertificateSettingDto();
                    dto.setKey(entry.getKey());
                    dto.setIsDefaultCertificateSettingOn(entry.getValue().getIsDefaultCertificateSettingOn()); // assuming system value is same as key
                    dto.setCustomHtmlCertificateTemplate(entry.getValue().getCustomHtmlCertificateTemplate());
                    dto.setCurrentHtmlCertificateTemplate(entry.getValue().getCurrentHtmlCertificateTemplate());
                    dto.setDefaultHtmlCertificateTemplate(entry.getValue().getDefaultHtmlCertificateTemplate());
                    dto.setPlaceHoldersMapping(entry.getValue().getPlaceHoldersMapping());
                    return dto;
                })
                .collect(Collectors.toList());

        CertificateSettingDataDto dataDto = new CertificateSettingDataDto();
        dataDto.setData(certificateSetting);
        return dataDto;
    }

    private String handleCaseWhereNoSettingPresent(Institute institute, Object settingRequest) {
        try{
            ObjectMapper objectMapper = new ObjectMapper();
            CertificateSettingRequest certificateSettingRequest = (CertificateSettingRequest) settingRequest;
            if(certificateSettingRequest==null) throw new VacademyException("Invalid Request");

            CertificateSettingDataDto data = createCertificateSettingFromRequest(certificateSettingRequest);


            InstituteSettingDto instituteSettingDto = new InstituteSettingDto();
            instituteSettingDto.setInstituteId(institute.getId());

            Map<String, SettingDto> settingMap = new HashMap<>();
            SettingDto settingDto = new SettingDto();
            settingDto.setKey(SettingKeyEnums.CERTIFICATE_SETTING.name());
            settingDto.setName("Certificate Setting");
            settingDto.setData(data);

            settingMap.put(SettingKeyEnums.CERTIFICATE_SETTING.name(), settingDto);

            instituteSettingDto.setSetting(settingMap);

            return objectMapper.writeValueAsString(instituteSettingDto);
        } catch (Exception e) {
            throw new VacademyException("Error Creating Setting: " +e.getMessage());
        }
    }

    @Override
    public String rebuildInstituteSetting(Institute institute, Object settingRequest, String key) {
        setKey(SettingKeyEnums.CERTIFICATE_SETTING.name());
        try {
            ObjectMapper objectMapper = new ObjectMapper();
            CertificateSettingRequest certificateSettingRequest = (CertificateSettingRequest) settingRequest;

            // Parse existing settings
            InstituteSettingDto instituteSettingDto = objectMapper.readValue(
                    institute.getSetting(), InstituteSettingDto.class
            );

            Map<String, SettingDto> settingMap = instituteSettingDto.getSetting();
            if (settingMap == null) throw new VacademyException("No Setting Found");

            CertificateSettingDataDto newData = null;

            if (!settingMap.containsKey(key) && certificateSettingRequest == null) {
                newData = createCertificateSettingFromRequest(createDefaultCertificateSetting());
            }
            else newData = createCertificateSettingFromRequest(certificateSettingRequest);


            SettingDto settingDto = settingMap.get(key);
            settingDto.setData(newData);

            // Replace and return updated JSON
            settingMap.put(key, settingDto);
            instituteSettingDto.setSetting(settingMap);

            return objectMapper.writeValueAsString(instituteSettingDto);
        } catch (Exception e) {
            throw new VacademyException("Error rebuilding setting: " + e.getMessage());
        }
    }

    public CertificateSettingRequest createDefaultCertificateSetting(){
        CertificateSettingRequest request = new CertificateSettingRequest();
        CertificateSettingDto settingDto = new CertificateSettingDto();

        Map<String, String> placeHolderValueMapping = new HashMap<>();
        placeHolderValueMapping.put("6", "Official Signatory");
        placeHolderValueMapping.put("7", "");

        settingDto.setKey(CertificateTypeEnum.COURSE_COMPLETION.name());
        settingDto.setIsDefaultCertificateSettingOn(false);
        settingDto.setDefaultHtmlCertificateTemplate(ConstantsSettingDefaultValue.getDefaultHtmlForType(CertificateTypeEnum.COURSE_COMPLETION.name()));
        settingDto.setCurrentHtmlCertificateTemplate(ConstantsSettingDefaultValue.getDefaultHtmlForType(CertificateTypeEnum.COURSE_COMPLETION.name()));
        settingDto.setPlaceHoldersMapping(placeHolderValueMapping);

        Map<String, CertificateSettingDto> settingDtoMap = new HashMap<>();
        settingDtoMap.put(CertificateTypeEnum.COURSE_COMPLETION.name(), settingDto);
        request.setRequest(settingDtoMap);

        return request;
    }
}

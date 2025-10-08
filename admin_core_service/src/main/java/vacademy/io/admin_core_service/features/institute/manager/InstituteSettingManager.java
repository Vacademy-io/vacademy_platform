package vacademy.io.admin_core_service.features.institute.manager;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.common.dto.CustomFieldDTO;
import vacademy.io.admin_core_service.features.common.entity.CustomFields;
import vacademy.io.admin_core_service.features.common.entity.InstituteCustomField;
import vacademy.io.admin_core_service.features.common.service.InstituteCustomFiledService;
import vacademy.io.admin_core_service.features.institute.dto.settings.GenericSettingRequest;
import vacademy.io.admin_core_service.features.institute.dto.settings.InstituteSettingDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.SettingDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.custom_field.CustomFieldSettingRequest;
import vacademy.io.admin_core_service.features.institute.dto.settings.naming.NameSettingRequest;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

@Component
public class InstituteSettingManager {

    @Autowired
    InstituteRepository instituteRepository;

    @Autowired
    InstituteSettingService instituteSettingService;

    @Autowired
    private InstituteCustomFiledService instituteCustomFiledService;

    public ResponseEntity<String> createNewNamingSetting(CustomUserDetails userDetails, String instituteId, NameSettingRequest request) {
        Optional<Institute> institute = instituteRepository.findById(instituteId);
        if(institute.isEmpty()) throw new VacademyException("Institute Not Found");

        instituteSettingService.createNewNamingSetting(institute.get(), request);
        return ResponseEntity.ok("Done");
    }

    public ResponseEntity<String> updateNamingSetting(CustomUserDetails userDetails, String instituteId, NameSettingRequest request) {
        Optional<Institute> institute = instituteRepository.findById(instituteId);
        if(institute.isEmpty()) throw new VacademyException("Institute Not Found");

        instituteSettingService.updateNamingSetting(institute.get(), request);
        return ResponseEntity.ok("Done");
    }

    // Generic methods for any setting type
    public ResponseEntity<String> createNewGenericSetting(CustomUserDetails userDetails, String instituteId, String settingKey, GenericSettingRequest request) {
        Optional<Institute> institute = instituteRepository.findById(instituteId);
        if(institute.isEmpty()) throw new VacademyException("Institute Not Found");

        instituteSettingService.createNewGenericSetting(institute.get(), settingKey, request.getSettingData());
        return ResponseEntity.ok("Done");
    }

    public ResponseEntity<String> updateGenericSetting(CustomUserDetails userDetails, String instituteId, String settingKey, GenericSettingRequest request) {
        Optional<Institute> institute = instituteRepository.findById(instituteId);
        if(institute.isEmpty()) throw new VacademyException("Institute Not Found");

        instituteSettingService.updateGenericSetting(institute.get(), settingKey, request.getSettingData());
        return ResponseEntity.ok("Done");
    }

    // Upsert method - creates if doesn't exist, updates if exists
    public ResponseEntity<String> saveGenericSetting(CustomUserDetails userDetails, String instituteId, String settingKey, GenericSettingRequest request) {
        Optional<Institute> institute = instituteRepository.findById(instituteId);
        if(institute.isEmpty()) throw new VacademyException("Institute Not Found");

        instituteSettingService.saveGenericSetting(institute.get(), settingKey, request);
        return ResponseEntity.ok("Setting saved successfully");
    }

    // GET methods for retrieving settings
    public ResponseEntity<InstituteSettingDto> getAllSettings(CustomUserDetails userDetails, String instituteId) {
        Optional<Institute> institute = instituteRepository.findById(instituteId);
        if(institute.isEmpty()) throw new VacademyException("Institute Not Found");

        InstituteSettingDto settings = instituteSettingService.getAllSettings(institute.get());
        return ResponseEntity.ok(settings);
    }

    public ResponseEntity<SettingDto> getSpecificSetting(CustomUserDetails userDetails, String instituteId, String settingKey) {
        Optional<Institute> institute = instituteRepository.findById(instituteId);
        if(institute.isEmpty()) throw new VacademyException("Institute Not Found");

        SettingDto setting = instituteSettingService.getSpecificSetting(institute.get(), settingKey);
        return ResponseEntity.ok(setting);
    }

    public ResponseEntity<Object> getSettingData(CustomUserDetails userDetails, String instituteId, String settingKey) {
        Optional<Institute> institute = instituteRepository.findById(instituteId);
        if(institute.isEmpty()) throw new VacademyException("Institute Not Found");

        Object settingData = instituteSettingService.getSettingData(institute.get(), settingKey);
        return ResponseEntity.ok(settingData);
    }

    public ResponseEntity<String> getSettingsAsRawJson(CustomUserDetails userDetails, String instituteId) {
        Optional<Institute> institute = instituteRepository.findById(instituteId);
        if(institute.isEmpty()) throw new VacademyException("Institute Not Found");

        String rawJson = instituteSettingService.getSettingsAsRawJson(institute.get());
        return ResponseEntity.ok(rawJson != null ? rawJson : "{}");
    }

    public ResponseEntity<String> updateCustomFieldSetting(CustomUserDetails userDetails, String instituteId, CustomFieldSettingRequest request, String isPresent) {
        Optional<Institute> institute = instituteRepository.findById(instituteId);
        if(institute.isEmpty()) throw new VacademyException("Institute Not Found");
        if(StringUtils.hasText(isPresent)){
            return ResponseEntity.ok(handleCaseCustomFieldSettingPresent(institute.get(), request));
        }
        return ResponseEntity.ok(handleCaseCustomFieldSettingNotPresent(institute.get()));
    }

    private String handleCaseCustomFieldSettingNotPresent(Institute institute) {
        instituteSettingService.createDefaultCustomFieldSetting(institute);
        return "Done";
    }

    private String handleCaseCustomFieldSettingPresent(Institute institute, CustomFieldSettingRequest customFieldSettingRequest) {
        if (customFieldSettingRequest.getCustomFieldsAndGroups() != null) {
            for (var fieldDto : customFieldSettingRequest.getCustomFieldsAndGroups()) {
                if (!StringUtils.hasText(fieldDto.getCustomFieldId())) {
                    // This is a new custom field that needs to be created
                    CustomFieldDTO newCustomFieldDto = new CustomFieldDTO();

                    newCustomFieldDto.setFieldKey(fieldDto.getFieldName().toLowerCase().replace(" ", "_") + "_" + System.currentTimeMillis());
                    newCustomFieldDto.setFieldName(fieldDto.getFieldName());
                    newCustomFieldDto.setFieldType(fieldDto.getFieldType());
                    newCustomFieldDto.setGroupName(fieldDto.getGroupName());
                    newCustomFieldDto.setGroupInternalOrder(fieldDto.getGroupInternalOrder());
                    newCustomFieldDto.setIndividualOrder(fieldDto.getIndividualOrder());

                    CustomFields savedCustomField = instituteCustomFiledService.createCustomFieldFromRequest(newCustomFieldDto);

                    InstituteCustomField savedMapping =
                            instituteCustomFiledService.createInstituteMappingFromCustomField(savedCustomField, institute, newCustomFieldDto);

                    fieldDto.setCustomFieldId(savedCustomField.getId());
                    fieldDto.setId(savedMapping.getId());
                }
            }
        }

        // Update the list of all custom field IDs
        if (customFieldSettingRequest.getCustomFieldsAndGroups() != null) {
            List<String> allCustomFieldIds = customFieldSettingRequest.getCustomFieldsAndGroups().stream()
                    .map(dto -> dto.getCustomFieldId())
                    .filter(Objects::nonNull)
                    .collect(Collectors.toList());
            customFieldSettingRequest.setAllCustomFields(allCustomFieldIds);
        }
        instituteSettingService.updateCustomFieldSetting(institute,customFieldSettingRequest);
        return "Done";
    }
}

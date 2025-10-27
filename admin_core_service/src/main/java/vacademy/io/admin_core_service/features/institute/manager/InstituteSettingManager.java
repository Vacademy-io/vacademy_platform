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
import vacademy.io.admin_core_service.features.institute.dto.settings.custom_field.CustomFieldDto;
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

    public ResponseEntity<String> createNewNamingSetting(CustomUserDetails userDetails, String instituteId,
            NameSettingRequest request) {
        Optional<Institute> institute = instituteRepository.findById(instituteId);
        if (institute.isEmpty())
            throw new VacademyException("Institute Not Found");

        instituteSettingService.createNewNamingSetting(institute.get(), request);
        return ResponseEntity.ok("Done");
    }

    public ResponseEntity<String> updateNamingSetting(CustomUserDetails userDetails, String instituteId,
            NameSettingRequest request) {
        Optional<Institute> institute = instituteRepository.findById(instituteId);
        if (institute.isEmpty())
            throw new VacademyException("Institute Not Found");

        instituteSettingService.updateNamingSetting(institute.get(), request);
        return ResponseEntity.ok("Done");
    }

    // Generic methods for any setting type
    public ResponseEntity<String> createNewGenericSetting(CustomUserDetails userDetails, String instituteId,
            String settingKey, GenericSettingRequest request) {
        Optional<Institute> institute = instituteRepository.findById(instituteId);
        if (institute.isEmpty())
            throw new VacademyException("Institute Not Found");

        instituteSettingService.createNewGenericSetting(institute.get(), settingKey, request.getSettingData());
        return ResponseEntity.ok("Done");
    }

    public ResponseEntity<String> updateGenericSetting(CustomUserDetails userDetails, String instituteId,
            String settingKey, GenericSettingRequest request) {
        Optional<Institute> institute = instituteRepository.findById(instituteId);
        if (institute.isEmpty())
            throw new VacademyException("Institute Not Found");

        instituteSettingService.updateGenericSetting(institute.get(), settingKey, request.getSettingData());
        return ResponseEntity.ok("Done");
    }

    // Upsert method - creates if doesn't exist, updates if exists
    public ResponseEntity<String> saveGenericSetting(CustomUserDetails userDetails, String instituteId,
            String settingKey, GenericSettingRequest request) {
        Optional<Institute> institute = instituteRepository.findById(instituteId);
        if (institute.isEmpty())
            throw new VacademyException("Institute Not Found");

        instituteSettingService.saveGenericSetting(institute.get(), settingKey, request);
        return ResponseEntity.ok("Setting saved successfully");
    }

    // GET methods for retrieving settings
    public ResponseEntity<InstituteSettingDto> getAllSettings(CustomUserDetails userDetails, String instituteId) {
        Optional<Institute> institute = instituteRepository.findById(instituteId);
        if (institute.isEmpty())
            throw new VacademyException("Institute Not Found");

        InstituteSettingDto settings = instituteSettingService.getAllSettings(institute.get());
        return ResponseEntity.ok(settings);
    }

    public ResponseEntity<SettingDto> getSpecificSetting(CustomUserDetails userDetails, String instituteId,
            String settingKey) {
        Optional<Institute> institute = instituteRepository.findById(instituteId);
        if (institute.isEmpty())
            throw new VacademyException("Institute Not Found");

        SettingDto setting = instituteSettingService.getSpecificSetting(institute.get(), settingKey);
        return ResponseEntity.ok(setting);
    }

    public ResponseEntity<Object> getSettingData(CustomUserDetails userDetails, String instituteId, String settingKey) {
        Optional<Institute> institute = instituteRepository.findById(instituteId);
        if (institute.isEmpty())
            throw new VacademyException("Institute Not Found");

        Object settingData = instituteSettingService.getSettingData(institute.get(), settingKey);
        return ResponseEntity.ok(settingData);
    }

    public ResponseEntity<String> getSettingsAsRawJson(CustomUserDetails userDetails, String instituteId) {
        Optional<Institute> institute = instituteRepository.findById(instituteId);
        if (institute.isEmpty())
            throw new VacademyException("Institute Not Found");

        String rawJson = instituteSettingService.getSettingsAsRawJson(institute.get());
        return ResponseEntity.ok(rawJson != null ? rawJson : "{}");
    }

    public ResponseEntity<String> updateCustomFieldSetting(CustomUserDetails userDetails, String instituteId,
            CustomFieldSettingRequest request, String isPresent) {
        Optional<Institute> institute = instituteRepository.findById(instituteId);
        if (institute.isEmpty())
            throw new VacademyException("Institute Not Found");
        if (StringUtils.hasText(isPresent)) {
            return ResponseEntity.ok(handleCaseCustomFieldSettingPresent(institute.get(), request));
        }
        return ResponseEntity.ok(handleCaseCustomFieldSettingNotPresent(institute.get()));
    }

    private String handleCaseCustomFieldSettingNotPresent(Institute institute) {
        instituteSettingService.createDefaultCustomFieldSetting(institute);
        return "Done";
    }

    private String handleCaseCustomFieldSettingPresent(Institute institute,
            CustomFieldSettingRequest customFieldSettingRequest) {
        if (customFieldSettingRequest.getCustomFieldsAndGroups() != null) {
            for (var fieldDto : customFieldSettingRequest.getCustomFieldsAndGroups()) {
                if (!StringUtils.hasText(fieldDto.getCustomFieldId())) {
                    // This is a new custom field that needs to be created
                    CustomFieldDTO newCustomFieldDto = new CustomFieldDTO();

                    newCustomFieldDto.setFieldName(fieldDto.getFieldName());
                    newCustomFieldDto.setFieldType(fieldDto.getFieldType());
                    newCustomFieldDto.setGroupName(fieldDto.getGroupName());
                    newCustomFieldDto.setGroupInternalOrder(fieldDto.getGroupInternalOrder());
                    newCustomFieldDto.setIndividualOrder(fieldDto.getIndividualOrder());
                    newCustomFieldDto.setConfig(fieldDto.getConfig());
                    // Use the new method that prevents duplicate keys for the institute
                    CustomFields savedCustomField = instituteCustomFiledService
                            .createOrFindCustomFieldByKey(newCustomFieldDto, institute.getId());

                    // Check if mapping already exists for this custom field and institute
                    Optional<InstituteCustomField> existingMapping = instituteCustomFiledService
                            .getByInstituteIdAndFieldIdAndTypeAndTypeId(
                                    institute.getId(), savedCustomField.getId(), "DEFAULT_CUSTOM_FIELD", null);

                    InstituteCustomField savedMapping;
                    if (existingMapping.isPresent()) {
                        // Update existing mapping with only provided fields
                        savedMapping = existingMapping.get();
                        patchInstituteCustomFieldMapping(savedMapping, fieldDto);
                        savedMapping = instituteCustomFiledService.createorupdateinstutefieldmapping(savedMapping);
                    } else {
                        // Create new mapping
                        savedMapping = instituteCustomFiledService
                                .createInstituteMappingFromCustomField(savedCustomField, institute, newCustomFieldDto);
                    }

                    fieldDto.setCustomFieldId(savedCustomField.getId());
                    fieldDto.setId(savedMapping.getId());
                } else {
                    // This is an existing custom field that needs to be updated
                    updateExistingCustomField(fieldDto, institute);
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

        instituteSettingService.updateCustomFieldSetting(institute, customFieldSettingRequest);
        return "Done";
    }

    /**
     * Updates an existing custom field with only the provided data (PATCH behavior)
     */
    private void updateExistingCustomField(CustomFieldDto fieldDto, Institute institute) {
        // Find the existing custom field
        Optional<CustomFields> existingCustomField = instituteCustomFiledService
                .getCustomFieldById(fieldDto.getCustomFieldId());
        if (existingCustomField.isEmpty()) {
            throw new VacademyException("Custom field with ID " + fieldDto.getCustomFieldId() + " not found");
        }

        CustomFields customField = existingCustomField.get();
        boolean customFieldUpdated = false;

        // Update custom field properties only if provided and different
        if (StringUtils.hasText(fieldDto.getFieldName())
                && !fieldDto.getFieldName().equals(customField.getFieldName())) {
            customField.setFieldName(fieldDto.getFieldName());
            customFieldUpdated = true;
        }

        if (StringUtils.hasText(fieldDto.getFieldType())
                && !fieldDto.getFieldType().equals(customField.getFieldType())) {
            customField.setFieldType(fieldDto.getFieldType());
            customFieldUpdated = true;
        }

        if (StringUtils.hasText(fieldDto.getStatus())){
            customField.setStatus(fieldDto.getStatus());
        }

        if (StringUtils.hasText(fieldDto.getConfig())){
            customField.setConfig(fieldDto.getConfig());
        }

        // Save custom field if it was updated
        if (customFieldUpdated) {
            instituteCustomFiledService.createOrSaveAllFields(List.of(customField));
        }

        // Update institute custom field mapping
        Optional<InstituteCustomField> existingMapping = instituteCustomFiledService
                .getByInstituteIdAndFieldIdAndTypeAndTypeId(
                        institute.getId(), fieldDto.getCustomFieldId(), "DEFAULT_CUSTOM_FIELD", null);

        if (existingMapping.isPresent()) {
            InstituteCustomField mapping = existingMapping.get();
            patchInstituteCustomFieldMapping(mapping, fieldDto);
            instituteCustomFiledService.createorupdateinstutefieldmapping(mapping);
        } else {
            // If mapping doesn't exist but custom field does, create the mapping
            createInstituteMappingForExistingField(customField, fieldDto, institute);
        }
    }

    /**
     * Creates institute mapping for an existing custom field
     */
    private void createInstituteMappingForExistingField(CustomFields customField, CustomFieldDto fieldDto,
            Institute institute) {
        CustomFieldDTO mappingDto = new CustomFieldDTO();
        mappingDto.setFieldName(customField.getFieldName());
        mappingDto.setFieldType(customField.getFieldType());
        mappingDto.setGroupName(fieldDto.getGroupName());
        mappingDto.setGroupInternalOrder(fieldDto.getGroupInternalOrder());
        mappingDto.setIndividualOrder(fieldDto.getIndividualOrder());

        instituteCustomFiledService.createInstituteMappingFromCustomField(customField, institute, mappingDto);
    }

    /**
     * Patches institute custom field mapping with only provided fields
     */
    private void patchInstituteCustomFieldMapping(InstituteCustomField mapping, CustomFieldDto fieldDto) {
        // Update group name if provided
        if (StringUtils.hasText(fieldDto.getGroupName())) {
            mapping.setGroupName(fieldDto.getGroupName());
        }

        // Update group internal order if provided
        if (fieldDto.getGroupInternalOrder() != null) {
            mapping.setGroupInternalOrder(fieldDto.getGroupInternalOrder());
        }

        // Update individual order if provided
        if (fieldDto.getIndividualOrder() != null) {
            mapping.setIndividualOrder(fieldDto.getIndividualOrder());
        }

        // Update status if provided
        if (StringUtils.hasText(fieldDto.getStatus())) {
            mapping.setStatus(fieldDto.getStatus());
        }
    }
}
